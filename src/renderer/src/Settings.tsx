import { useEffect, useRef, useState } from 'react'
import { tidePath } from '../../shared/tide'
import { THEMES, type Theme } from '../../shared/themes'
import type { McpInfo, Settings as SettingsData, ThemeId, UpdateStatus } from '../../shared/types'
import { THEME_IDS } from '../../shared/types'
import { api, useApp } from './context'

const PREVIEW_LOADS = [120, 150, 400, 240, 150, 300, 60]
const previewPath = tidePath(PREVIEW_LOADS, 140, 40, 480)

function ThemeCard({ theme, name, checked, onPick }: { theme: Theme; name: string; checked: boolean; onPick: () => void }) {
  const c = theme.colors
  return (
    <label className="theme-card" data-checked={checked}>
      <input type="radio" name={name} checked={checked} onChange={onPick} />
      <span className="theme-preview" style={{ background: c.ground, borderRadius: theme.radius }} aria-hidden="true">
        <svg viewBox="0 0 140 40" preserveAspectRatio="none"><path d={previewPath} fill={c.water} /></svg>
        <span className="theme-chips">
          <i style={{ background: c.event }} />
          <i style={{ background: c.surface }} />
          <i style={{ background: c.accent }} />
        </span>
      </span>
      <span className="theme-name" style={{ fontFamily: theme.font }}>{theme.name}</span>
    </label>
  )
}

function ThemePicker({ legend, name, ids, value, onPick }: { legend: string; name: string; ids: ThemeId[]; value: ThemeId; onPick: (id: ThemeId) => void }) {
  return (
    <fieldset className="theme-group">
      <legend>{legend}</legend>
      <div className="theme-cards">
        {ids.map((id) => <ThemeCard key={id} theme={THEMES[id]} name={name} checked={value === id} onPick={() => onPick(id)} />)}
      </div>
    </fieldset>
  )
}

const updateText = (status: UpdateStatus, version: string): string => {
  switch (status.state) {
    case 'unsupported': return `Version ${version}. Updates work in the installed app only.`
    case 'checking': return 'Checking for updates…'
    case 'current': return `Version ${version} is the latest.`
    case 'available': return `Version ${status.version} is available.`
    case 'downloading': return `Downloading version ${status.version}, ${status.percent}%.`
    case 'ready': return `Version ${status.version} is ready. It installs when you restart or quit.`
    case 'error': return status.message
    default: return `Version ${version}.`
  }
}

export function Settings({ update, version, dataFile, onClose, onReplay }: { update: UpdateStatus; version: string; dataFile: string; onClose: () => void; onReplay: () => void }) {
  const app = useApp()
  const s = app.data.settings
  const ref = useRef<HTMLDialogElement>(null)
  const [mcp, setMcp] = useState<McpInfo | null>(null)
  const [copied, setCopied] = useState(false)
  const set = (patch: Partial<SettingsData>) => void app.dispatch({ type: 'settings/update', patch })

  useEffect(() => {
    if (!ref.current?.open) ref.current?.showModal()
    void api.mcp.info().then(setMcp)
    return api.onMcp(setMcp)
  }, [])

  const light = THEME_IDS.filter((id) => THEMES[id].mode === 'light')
  const dark = THEME_IDS.filter((id) => THEMES[id].mode === 'dark')

  return (
    <dialog ref={ref} className="sheet wide" aria-label="Settings" onClose={onClose}>
      <div className="settings-head">
        <h2>Settings</h2>
        <button className="btn" onClick={onClose}>Done</button>
      </div>

      <section className="setting" aria-label="Appearance">
        <h3>Appearance</h3>
        <div className="row">
          <label className="check-row"><input type="radio" name="theme-mode" checked={s.themeMode === 'system'} onChange={() => set({ themeMode: 'system' })} /> Match system</label>
          <label className="check-row"><input type="radio" name="theme-mode" checked={s.themeMode === 'fixed'} onChange={() => set({ themeMode: 'fixed' })} /> One theme</label>
        </div>
        {s.themeMode === 'system' ? (
          <>
            <ThemePicker legend="When the system is light" name="light-theme" ids={light} value={s.lightTheme} onPick={(lightTheme) => set({ lightTheme })} />
            <ThemePicker legend="When the system is dark" name="dark-theme" ids={dark} value={s.darkTheme} onPick={(darkTheme) => set({ darkTheme })} />
          </>
        ) : (
          <ThemePicker legend="Theme" name="fixed-theme" ids={[...THEME_IDS]} value={s.fixedTheme} onPick={(fixedTheme) => set({ fixedTheme })} />
        )}
      </section>

      <section className="setting" aria-label="Planning">
        <h3>Planning</h3>
        <div className="field narrow">
          <label htmlFor="full-day">Hours in a full day</label>
          <input id="full-day" type="number" min={1} max={24} defaultValue={s.fullDayHours} aria-describedby="full-day-note" onBlur={(e) => {
            const hours = Number(e.target.value)
            if (Number.isInteger(hours) && hours >= 1 && hours <= 24) set({ fullDayHours: hours })
            else e.target.value = String(s.fullDayHours)
          }} />
          <p id="full-day-note" className="note">The tide reaches its top here. A day above it is flagged.</p>
        </div>
      </section>

      <section className="setting" aria-label="Updates">
        <h3>Updates</h3>
        <p role="status">{updateText(update, version)}</p>
        <label className="check-row"><input type="checkbox" checked={s.autoUpdate} onChange={(e) => set({ autoUpdate: e.target.checked })} /> Download updates automatically</label>
        <div className="row">
          {update.state === 'ready'
            ? <button className="btn primary" onClick={() => void api.update.install()}>Restart to update</button>
            : update.state === 'available'
              ? <button className="btn primary" onClick={() => void api.update.download()}>Download</button>
              : <button className="btn" disabled={update.state === 'unsupported' || update.state === 'checking' || update.state === 'downloading'} onClick={() => void api.update.check()}>Check for updates</button>}
        </div>
      </section>

      <section className="setting" aria-label="Claude Code">
        <h3>Claude Code</h3>
        <label className="check-row"><input type="checkbox" checked={s.mcpEnabled} onChange={(e) => set({ mcpEnabled: e.target.checked })} /> Let Claude Code read and edit this planner</label>
        <p className="note">An MCP server runs on this computer only, while Tideloop is open. Anything with the token can change your planner, and you can undo its edits with Cmd+Z.</p>
        {mcp?.error && <p className="error" role="alert">{mcp.error}</p>}
        {s.mcpEnabled && mcp?.running && (
          <>
            <p role="status">Listening on this computer, port {mcp.port}. Run this once in a terminal:</p>
            <code className="command">{mcp.command}</code>
            <div className="row">
              <button className="btn" onClick={() => void api.mcp.copyCommand().then(() => setCopied(true))}>{copied ? 'Copied' : 'Copy command'}</button>
              <button className="btn" onClick={() => void api.mcp.regenerate().then(() => setCopied(false))}>New token</button>
            </div>
          </>
        )}
      </section>

      <section className="setting" aria-label="Help">
        <h3>Help</h3>
        <div className="row"><button className="btn" onClick={onReplay}>Show the tutorial again</button></div>
      </section>

      <section className="setting" aria-label="Your data">
        <h3>Your data</h3>
        <p className="note path">{dataFile}</p>
        <div className="row"><button className="btn" onClick={() => api.revealData()}>Show in Finder</button></div>
      </section>
    </dialog>
  )
}
