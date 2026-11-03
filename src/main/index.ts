import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow, clipboard, ipcMain, nativeTheme, shell, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import type { MenuCommand } from '../shared/ipc'
import { PlannerError } from '../shared/planner'
import { resolveTheme } from '../shared/themes'
import type { Action, McpInfo, UpdateStatus } from '../shared/types'
import { loadOrCreateToken, MCP_PORT, mcpCommand, regenerateToken, startMcpServer } from './mcp'
import { buildMenu } from './menu'
import { loadData, saveData } from './persistence'
import { createStore } from './store'
import { wireUpdater } from './updater'

const SIX_HOURS = 6 * 60 * 60 * 1000
const FIRST_CHECK_DELAY = 10_000

// A second copy must not touch the data file the first one is using.
if (!app.requestSingleInstanceLock()) app.exit(0)

const dir = app.getPath('userData')
const loaded = loadData(dir)
let window: BrowserWindow | null = null

const send = (channel: string, value: unknown) => {
  if (window && !window.isDestroyed()) window.webContents.send(channel, value)
}

const store = createStore({
  data: loaded.data,
  save: (data) => saveData(dir, data),
  onSaveError: (error) => send('notice', `Tideloop could not save your last change: ${error.message}. It will try again on your next change.`)
})

// Window size and position

const boundsFile = join(dir, 'window.json')
function readBounds(): Electron.Rectangle | undefined {
  try {
    const b = JSON.parse(readFileSync(boundsFile, 'utf8'))
    return [b.x, b.y, b.width, b.height].every(Number.isFinite) ? b : undefined
  } catch {
    return undefined
  }
}

function createWindow(): void {
  const settings = store.getState().settings
  const theme = resolveTheme(settings, nativeTheme.shouldUseDarkColors)
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    ...readBounds(),
    minWidth: 980,
    minHeight: 620,
    show: false,
    title: 'Tideloop',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: theme.colors.ground,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })
  window = win
  // Only this app's own page may load, and nothing may open a new window.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event) => event.preventDefault())
  win.webContents.on('will-redirect', (event) => event.preventDefault())
  win.webContents.session.setPermissionRequestHandler((_contents, _permission, allow) => allow(false))
  win.on('close', () => {
    try {
      writeFileSync(boundsFile, JSON.stringify(win.getNormalBounds()))
    } catch {
      // Losing the window position is not worth interrupting a quit.
    }
  })
  win.on('closed', () => {
    window = null
  })
  // A renderer that never reports ready must not leave the app invisible.
  setTimeout(() => {
    if (!win.isDestroyed() && !win.isVisible()) win.show()
  }, 3000)
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
}

// Updates

const noUpdates: UpdateStatus = { state: 'unsupported' }
type Updater = ReturnType<typeof wireUpdater>
let updater: Updater | null = null

function startUpdates(): void {
  if (!app.isPackaged) return
  // Loaded late: electron-updater reads app metadata that only exists once the app is ready.
  const { autoUpdater } = require('electron-updater') as typeof import('electron-updater')
  updater = wireUpdater(autoUpdater, {
    send: (status) => send('update:status', status),
    autoDownload: () => store.getState().settings.autoUpdate
  })
  setTimeout(() => void updater?.check(false), FIRST_CHECK_DELAY)
  setInterval(() => void updater?.check(false), SIX_HOURS)
}

// MCP

let mcp: Awaited<ReturnType<typeof startMcpServer>> | null = null
let mcpError: string | null = null
let mcpBusy = false
// Set when the token changes while a start is in flight, so the server that finishes starting restarts with the new one.
let tokenStale = false

function mcpInfo(): McpInfo {
  const enabled = store.getState().settings.mcpEnabled
  const masked = mcpCommand(MCP_PORT, '••••••••')
  return { enabled, running: mcp !== null, port: MCP_PORT, command: enabled ? masked : null, error: mcpError }
}

async function syncMcp(): Promise<void> {
  if (mcpBusy) return
  mcpBusy = true
  try {
    const wanted = store.getState().settings.mcpEnabled
    if (wanted && !mcp) {
      tokenStale = false
      try {
        mcp = await startMcpServer({ store, port: MCP_PORT, token: loadOrCreateToken(dir), version: app.getVersion() })
        mcpError = null
      } catch (error) {
        const inUse = (error as NodeJS.ErrnoException).code === 'EADDRINUSE'
        mcpError = inUse ? `Port ${MCP_PORT} is in use by another program.` : (error as Error).message
      }
    } else if (!wanted) {
      await mcp?.close()
      mcp = null
      mcpError = null
    }
  } finally {
    mcpBusy = false
  }
  if (tokenStale && mcp) {
    tokenStale = false
    await mcp.close()
    mcp = null
    return syncMcp()
  }
  // The setting may have changed while the server was starting or stopping.
  if (store.getState().settings.mcpEnabled !== (mcp !== null) && !mcpError) return syncMcp()
  send('mcp:info', mcpInfo())
}

// IPC

/** Requests count only from this app's own window. */
const trusted = (event: IpcMainInvokeEvent | IpcMainEvent) =>
  event.sender === window?.webContents && event.senderFrame === event.sender.mainFrame
const handle = (channel: string, fn: (...args: never[]) => unknown) =>
  ipcMain.handle(channel, (event, ...args) => {
    if (!trusted(event)) throw new Error('Refused')
    return (fn as (...a: unknown[]) => unknown)(...args)
  })
const on = (channel: string, fn: (...args: never[]) => void) =>
  ipcMain.on(channel, (event, ...args) => {
    if (trusted(event)) (fn as (...a: unknown[]) => void)(...args)
  })

handle('planner:get', () => store.getState())
handle('planner:dispatch', (action: Action) => {
  try {
    store.dispatch(action)
    return null
  } catch (error) {
    if (error instanceof PlannerError) return error.message
    throw error
  }
})
handle('planner:undo', () => store.undo())
handle('planner:redo', () => store.redo())
handle('app:info', () => ({ version: app.getVersion(), notice: loaded.notice, dataFile: join(dir, 'planner.json') }))
on('app:ready', () => window?.show())
on('theme:native', (source: 'system' | 'light' | 'dark', background: string) => {
  if (source !== 'system' && source !== 'light' && source !== 'dark') return
  nativeTheme.themeSource = source
  if (/^#[0-9a-fA-F]{6}$/.test(background)) window?.setBackgroundColor(background)
})
on('data:reveal', () => shell.showItemInFolder(join(dir, 'planner.json')))
handle('update:status', () => updater?.status() ?? noUpdates)
handle('update:check', () => updater?.check(true))
handle('update:download', () => updater?.download())
handle('update:install', () => updater?.install())
handle('mcp:info', () => mcpInfo())
handle('mcp:copy', () => clipboard.writeText(mcpCommand(MCP_PORT, loadOrCreateToken(dir))))
handle('mcp:regenerate', async () => {
  regenerateToken(dir)
  if (mcpBusy) {
    tokenStale = true
    return
  }
  // The running server holds the old token, so restart it to make the old one stop working at once.
  await mcp?.close()
  mcp = null
  await syncMcp()
})

// Lifecycle

store.subscribe((state) => {
  send('planner:state', state)
  if (state.settings.mcpEnabled !== (mcp !== null)) void syncMcp()
})

app.on('second-instance', () => {
  if (window?.isMinimized()) window.restore()
  window?.focus()
})
app.on('activate', () => {
  if (!window) createWindow()
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

void app.whenReady().then(() => {
  buildMenu((command: MenuCommand) => send('menu:command', command), () => {
    if (!window) createWindow()
    window?.show()
    send('menu:command', 'settings')
    void updater?.check(true)
  })
  createWindow()
  startUpdates()
  void syncMcp()
})
