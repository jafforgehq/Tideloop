import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { addDays, monthName, startOfWeek, todayISO, weekTitle } from '../../shared/dates'
import type { AppInfo, MenuCommand } from '../../shared/ipc'
import { reduce } from '../../shared/planner'
import { resolveTheme, type Theme } from '../../shared/themes'
import { monthFinding, overdueCount, weekFinding } from '../../shared/tide'
import { advanceTutorial, nextTutorialStep, startTutorial, type TutorialState } from '../../shared/tutorial'
import type { Action, PlannerData, UpdateStatus } from '../../shared/types'
import { api, Context, type AppContext, type EditTarget } from './context'
import { Dock } from './Dock'
import { Editor } from './Editor'
import { Chevron } from './icons'
import { Month } from './Month'
import { Settings } from './Settings'
import { Tutorial } from './Tutorial'
import { Week } from './Week'

const TOAST_MS = 6000

function applyTheme(theme: Theme): void {
  const root = document.documentElement
  root.dataset.theme = theme.id
  root.style.colorScheme = theme.mode
  root.style.setProperty('--font', theme.font)
  root.style.setProperty('--radius', `${theme.radius}px`)
  for (const [key, value] of Object.entries(theme.colors)) {
    root.style.setProperty(`--${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`, value)
  }
  theme.list.forEach((colour, i) => root.style.setProperty(`--list-${i}`, colour))
}

const isEditable = (el: Element | null) => el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement

export function App() {
  const [data, setData] = useState<PlannerData | null>(null)
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [update, setUpdate] = useState<UpdateStatus>({ state: 'idle' })
  const [today, setToday] = useState(todayISO())
  const [view, setView] = useState<'week' | 'month'>('week')
  const [anchor, setAnchor] = useState(todayISO())
  const [editing, setEditing] = useState<EditTarget | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [toastState, setToastState] = useState<{ message: string; undo: boolean; sticky: boolean } | null>(null)
  const [spoken, setSpoken] = useState('')
  const [over, setOver] = useState<AppContext['over']>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [tutorial, setTutorial] = useState<TutorialState | null>(null)
  const quickAdd = useRef<HTMLInputElement>(null)
  const pendingFocus = useRef<string | null>(null)

  useEffect(() => {
    void api.getState().then(setData)
    void api.appInfo().then((i) => {
      setInfo(i)
      if (i.notice) setToastState({ message: i.notice, undo: false, sticky: true })
    })
    void api.update.status().then(setUpdate)
    const offs = [
      api.onState(setData),
      api.onUpdate(setUpdate),
      api.onNotice((message) => setToastState({ message, undo: false, sticky: true }))
    ]
    const clock = setInterval(() => setToday(todayISO()), 30_000)
    return () => {
      offs.forEach((off) => off())
      clearInterval(clock)
    }
  }, [])

  const s = data?.settings
  useEffect(() => {
    if (!s) return
    const media = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const theme = resolveTheme(s, media.matches)
      applyTheme(theme)
      api.setNativeTheme(s.themeMode === 'system' ? 'system' : theme.mode, theme.colors.ground)
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [s?.themeMode, s?.lightTheme, s?.darkTheme, s?.fixedTheme]) // eslint-disable-line

  const loaded = data !== null
  useEffect(() => {
    if (!loaded) return
    api.ready()
    if (!data.settings.tutorialDone) setTutorial(startTutorial(data))
  }, [loaded]) // eslint-disable-line

  useEffect(() => {
    if (data) setTutorial((current) => current && advanceTutorial(current, data, view))
  }, [data, view])

  // These steps point at things only the week view shows.
  const tutorialStep = tutorial?.step
  useEffect(() => {
    if (tutorialStep === 'drag-to-day' || tutorialStep === 'read-tide' || tutorialStep === 'tick-off') setView('week')
  }, [tutorialStep])

  useEffect(() => {
    if (toastState && !toastState.sticky) {
      const timer = setTimeout(() => setToastState(null), TOAST_MS)
      return () => clearTimeout(timer)
    }
  }, [toastState])

  useEffect(() => {
    if (!pendingFocus.current) return
    const id = CSS.escape(pendingFocus.current)
    const el = document.querySelector<HTMLElement>(`[data-todo-id="${id}"],[data-event-id="${id}"]`)
    if (el) {
      el.focus()
      pendingFocus.current = null
    }
  }, [data])

  const dispatch = useCallback(async (action: Action, quiet = false) => {
    // Apply locally first so a drop or a tick never flickers back. The main process's state still wins.
    setData((current) => {
      try {
        return current && reduce(current, action)
      } catch {
        return current
      }
    })
    const problem = await api.dispatch(action)
    if (problem && !quiet) setToastState({ message: problem, undo: false, sticky: false })
    return problem
  }, [])

  const goTo = useCallback((date: string, nextView?: 'week' | 'month') => {
    setAnchor(date)
    if (nextView) setView(nextView)
  }, [])

  const step = useCallback((by: number) => {
    setAnchor((current) => {
      if (view === 'week') return addDays(current, by * 7)
      const y = Number(current.slice(0, 4))
      const m = Number(current.slice(5, 7)) - 1 + by
      return `${y + Math.floor(m / 12)}-${String(((m + 12) % 12) + 1).padStart(2, '0')}-01`
    })
  }, [view])

  useEffect(() => {
    const undo = () => {
      if (isEditable(document.activeElement)) document.execCommand('undo')
      else void api.undo()
    }
    const redo = () => {
      if (isEditable(document.activeElement)) document.execCommand('redo')
      else void api.redo()
    }
    const onKey = (e: KeyboardEvent) => {
      // In a field, or with a dialog open, Cmd+Z belongs to the text being edited.
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z' || isEditable(document.activeElement) || document.querySelector('dialog[open]')) return
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
    }
    const commands: Record<MenuCommand, () => void> = {
      undo,
      redo,
      'new-todo': () => quickAdd.current?.focus(),
      'new-event': () => setEditing({ kind: 'new-event', date: anchor >= today ? anchor : today }),
      settings: () => setSettingsOpen(true),
      today: () => goTo(todayISO()),
      previous: () => step(-1),
      next: () => step(1),
      'view-week': () => setView('week'),
      'view-month': () => setView('month')
    }
    window.addEventListener('keydown', onKey)
    const off = api.onMenu((command) => commands[command]())
    return () => {
      window.removeEventListener('keydown', onKey)
      off()
    }
  }, [anchor, today, goTo, step])

  const context = useMemo<AppContext | null>(() => data && {
    data,
    today,
    dispatch,
    edit: setEditing,
    toast: (message, options) => setToastState({ message, undo: options?.undo ?? false, sticky: options?.sticky ?? false }),
    announce: setSpoken,
    focusAfterRender: (id) => {
      pendingFocus.current = id
    },
    goTo,
    over,
    setOver,
    draggingId,
    setDraggingId
  }, [data, today, dispatch, goTo, over, draggingId])

  if (!data || !context) return null

  const monday = startOfWeek(anchor)
  const year = Number(anchor.slice(0, 4))
  const month = Number(anchor.slice(5, 7))
  const overdue = overdueCount(data, today)

  return (
    <Context.Provider value={context}>
      <div className="app" data-app-ready>
        <Dock ref={quickAdd} anchor={anchor} update={update} onSettings={() => setSettingsOpen(true)} />
        <main className="main">
          <header className="main-head">
            <div className="titles">
              <h1>{view === 'week' ? weekTitle(monday) : `${monthName(month)} ${year}`}</h1>
              <p>{view === 'week' ? weekFinding(data, monday) : monthFinding(data, year, month)}</p>
            </div>
            {overdue > 0 && (
              <button className="btn accent" onClick={() => void dispatch({ type: 'todo/rollover', today })}>
                Move {overdue} overdue to today
              </button>
            )}
            <div className="segmented" role="group" aria-label="View">
              <button aria-pressed={view === 'week'} onClick={() => setView('week')}>Week</button>
              <button aria-pressed={view === 'month'} data-tour="month" onClick={() => setView('month')}>Month</button>
            </div>
            <div className="nav-buttons">
              <button className="btn square" aria-label={view === 'week' ? 'Previous week' : 'Previous month'} onClick={() => step(-1)}><Chevron left /></button>
              <button className="btn" onClick={() => goTo(todayISO())}>Today</button>
              <button className="btn square" aria-label={view === 'week' ? 'Next week' : 'Next month'} onClick={() => step(1)}><Chevron /></button>
            </div>
          </header>
          {view === 'week' ? <Week monday={monday} /> : <Month year={year} month={month} />}
        </main>
      </div>
      {editing && <Editor key={JSON.stringify(editing)} target={editing} onClose={() => setEditing(null)} />}
      {settingsOpen && info && <Settings update={update} version={info.version} dataFile={info.dataFile} onClose={() => setSettingsOpen(false)} onReplay={() => {
        setSettingsOpen(false)
        setView('week')
        goTo(todayISO())
        setTutorial(startTutorial(data))
      }} />}
      {tutorial && <Tutorial state={tutorial} onNext={() => setTutorial(nextTutorialStep(tutorial))} onEnd={() => {
        setTutorial(null)
        setView('week')
        void dispatch({ type: 'settings/update', patch: { tutorialDone: true } })
      }} />}
      <div className="toasts" role="status">
        {toastState && (
          <div className="toast">
            <span>{toastState.message}</span>
            {toastState.undo && <button className="link" onClick={() => { void api.undo(); setToastState(null) }}>Undo</button>}
            {toastState.sticky && <button className="link" onClick={() => setToastState(null)}>Dismiss</button>}
          </div>
        )}
      </div>
      <div className="sr-only" role="status" aria-live="polite">{spoken}</div>
    </Context.Provider>
  )
}
