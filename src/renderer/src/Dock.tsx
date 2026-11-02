import { forwardRef, useEffect, useState } from 'react'
import { addDays, dayLabel, dayOfMonth, monthGrid, monthName, startOfWeek } from '../../shared/dates'
import type { List, UpdateStatus } from '../../shared/types'
import { TodoCard } from './Cards'
import { addFromText, api, useApp, useDropZone } from './context'
import { Chevron, Gear, Mark } from './icons'

function ListSection({ list }: { list: List }) {
  const app = useApp()
  const zone = useDropZone(`list:${list.id}`, { date: null, listId: list.id })
  const all = app.data.todos.filter((t) => t.listId === list.id && t.date === null).sort((a, b) => a.order - b.order)
  const open = all.filter((t) => !t.done)
  const done = all.filter((t) => t.done)
  const placed = open.filter((t) => t.id !== app.draggingId)
  return (
    <section aria-label={`${list.name} list`} className="list" data-drop={zone.active} {...zone.props}>
      <button className="list-head" aria-label={`Edit list ${list.name}`} onClick={() => app.edit({ kind: 'list', id: list.id })}>
        <span className="dot" style={{ background: `var(--list-${list.color % 6})` }} />
        <span className="list-name">{list.name}</span>
        <span className="count">{open.length}</span>
      </button>
      <ul className="stack">
        {open.map((t) => <TodoCard key={t.id} todo={t} dropBefore={zone.index !== null && placed[zone.index]?.id === t.id} />)}
        {zone.index === placed.length && <li className="drop-end" aria-hidden="true" />}
      </ul>
      {open.length === 0 && zone.index === null && <p className="empty">Nothing waiting</p>}
      {done.length > 0 && (
        <details className="done">
          <summary>{done.length} done</summary>
          <ul className="stack">{done.map((t) => <TodoCard key={t.id} todo={t} />)}</ul>
        </details>
      )}
    </section>
  )
}

function MiniMonth({ anchor }: { anchor: string }) {
  const app = useApp()
  const [shown, setShown] = useState({ year: Number(anchor.slice(0, 4)), month: Number(anchor.slice(5, 7)) })
  useEffect(() => setShown({ year: Number(anchor.slice(0, 4)), month: Number(anchor.slice(5, 7)) }), [anchor])
  const step = (by: number) => setShown(({ year, month }) => {
    const m = month - 1 + by
    return { year: year + Math.floor(m / 12), month: ((m + 12) % 12) + 1 }
  })
  const week = startOfWeek(anchor)
  const weekEnd = addDays(week, 6)
  return (
    <nav className="mini" aria-label="Calendar">
      <div className="mini-head">
        <span>{monthName(shown.month)} {shown.year}</span>
        <button className="icon" aria-label="Previous month" onClick={() => step(-1)}><Chevron left /></button>
        <button className="icon" aria-label="Next month" onClick={() => step(1)}><Chevron /></button>
      </div>
      <div className="mini-grid">
        {monthGrid(shown.year, shown.month).map((c) => (
          <button
            key={c.date}
            className="mini-day"
            data-in-month={c.inMonth}
            data-today={c.date === app.today}
            data-in-week={c.date >= week && c.date <= weekEnd}
            aria-label={`Go to ${dayLabel(c.date)}`}
            onClick={() => app.goTo(c.date)}
          >
            {dayOfMonth(c.date)}
          </button>
        ))}
      </div>
    </nav>
  )
}

function UpdatePill({ status }: { status: UpdateStatus }) {
  if (status.state === 'ready') return <button className="pill" onClick={() => void api.update.install()}>Restart to update to {status.version}</button>
  if (status.state === 'available') return <button className="pill quiet" onClick={() => void api.update.download()}>Download version {status.version}</button>
  if (status.state === 'downloading') return <p className="pill-note" role="status">Downloading {status.version}, {status.percent}%</p>
  return null
}

export const Dock = forwardRef<HTMLInputElement, { anchor: string; update: UpdateStatus; onSettings: () => void }>(function Dock({ anchor, update, onSettings }, ref) {
  const app = useApp()
  return (
    <aside className="dock">
      <div className="dock-top">
        <span className="brand"><Mark /> Tideloop</span>
        <button className="icon" aria-label="Settings" onClick={onSettings}><Gear /></button>
      </div>
      <div className="quick">
        <label htmlFor="quick-add">New todo</label>
        <input
          id="quick-add"
          ref={ref}
          placeholder="Report fri 1h, or Dentist 14:30"
          onKeyDown={(e) => {
            const input = e.currentTarget
            if (e.key === 'Enter') void addFromText(app, input.value, null).then((ok) => ok && (input.value = ''))
          }}
        />
      </div>
      <div className="lists">
        {app.data.lists.map((l) => <ListSection key={l.id} list={l} />)}
        <button className="add" onClick={() => app.edit({ kind: 'list', id: null })}>+ New list</button>
      </div>
      <MiniMonth anchor={anchor} />
      <UpdatePill status={update} />
    </aside>
  )
})
