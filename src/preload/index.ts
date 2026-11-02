import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { TideloopApi } from '../shared/ipc'

const listen = <T>(channel: string) => (fn: (value: T) => void) => {
  const handler = (_: IpcRendererEvent, value: T) => fn(value)
  ipcRenderer.on(channel, handler)
  return () => void ipcRenderer.removeListener(channel, handler)
}

const api: TideloopApi = {
  getState: () => ipcRenderer.invoke('planner:get'),
  dispatch: (action) => ipcRenderer.invoke('planner:dispatch', action),
  undo: () => ipcRenderer.invoke('planner:undo'),
  redo: () => ipcRenderer.invoke('planner:redo'),
  appInfo: () => ipcRenderer.invoke('app:info'),
  ready: () => ipcRenderer.send('app:ready'),
  setNativeTheme: (source, background) => ipcRenderer.send('theme:native', source, background),
  revealData: () => ipcRenderer.send('data:reveal'),
  update: {
    status: () => ipcRenderer.invoke('update:status'),
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install')
  },
  mcp: {
    info: () => ipcRenderer.invoke('mcp:info'),
    copyCommand: () => ipcRenderer.invoke('mcp:copy'),
    regenerate: () => ipcRenderer.invoke('mcp:regenerate')
  },
  onState: listen('planner:state'),
  onUpdate: listen('update:status'),
  onMcp: listen('mcp:info'),
  onMenu: listen('menu:command'),
  onNotice: listen('notice')
}

contextBridge.exposeInMainWorld('tideloop', api)
