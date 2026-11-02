import { useState } from 'react'
import { dayLabel, dayOfMonth, shortDay } from '../../shared/dates'
import { formatMinutes, tidePath, weekSummary } from '../../shared/tide'
import type { ISODate } from '../../shared/types'
import { EventCard, TodoCard } from './Cards'
import { addFromText, useApp, useDropZone } from './context'

const TIDE_W = 700
const TIDE_H = 110

function AddInline({ date }: { date: ISODate }) {
  const app = useApp()
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <button className="add" aria-label={`Add to ${dayLabel(date)}`} onClick={() => setOpen(true)}>
        + Add
      </button>
    )
  }
  return (
    <input
      className="add-input"
      autoFocus
      aria-label={`New item on ${dayLabel(date)}`}
      placeholder="Todo, or 14:30 Call"
      onBlur={(e) => {
        if (!e.target.value.trim()) setOpen(false)
      }}
      onKeyDown={(e) => {
        const input = e.currentTarget
        if (e.key === 'Escape') setOpen(false)
        if (e.key === 'Enter') void addFromText(app, input.value, date).then((ok) => ok && (input.value = ''))
      }}
    />
  )
}

function DayColumn({ date }: { date: ISODate }) {
  const app = useApp()
  const zone = useDropZone(`day:${date}`, { date })
  const events = app.data.events.filter((e) => e.date === date).sort((a, b) => a.start.localeCompare(b.start))
  const todos = app.data.todos.filter((t) => t.date === date).sort((a, b) => a.order - b.order)
  const placed = todos.filter((t) => t.id !== app.draggingId)
  return (
    <section
      aria-label={dayLabel(date)}
      className="day"
      data-today={date === app.today}
      data-past={date < app.today}
      data-drop={zone.active}
      {...zone.props}
    >
      <ul className="stack">
        {events.map((e) => <EventCard key={e.id} event={e} />)}
        {todos.map((t) => <TodoCard key={t.id} todo={t} dropBefore={zone.index !== null && placed[zone.index]?.id === t.id} />)}
        {zone.index === placed.length && <li className="drop-end" aria-hidden="true" />}
      </ul>
      <AddInline date={date} />
    </section>
  )
}

export function Week({ monday }: { monday: ISODate }) {
  const app = useApp()
  const { dates, loads } = weekSummary(app.data, monday)
  const full = app.data.settings.fullDayHours * 60
  const d = tidePath(loads, TIDE_W, TIDE_H, full)
  // A second swell, half a day behind the first. Same command shape, so it animates too.
  const swell = tidePath(loads.map((m, i) => (m + (loads[i - 1] ?? m)) / 2), TIDE_W, TIDE_H, full)
  const todayIndex = dates.indexOf(app.today)
  return (
    <div className="week-scroll">
      <div className="week">
        <div className="seven heads">
          {dates.map((date, i) => (
            <div key={date} className="head" data-over={loads[i] > full}>
              <span className="dow">{shortDay(date)}</span>
              <span className="num" data-today={date === app.today}>{dayOfMonth(date)}</span>
              <span className="hours">{loads[i] > 0 ? formatMinutes(loads[i]) : '0m'}</span>
            </div>
          ))}
        </div>
        <svg className="tide" viewBox={`0 0 ${TIDE_W} ${TIDE_H}`} preserveAspectRatio="none" role="img" aria-label={`Booked time this week: ${dates.map((date, i) => `${shortDay(date)} ${formatMinutes(loads[i])}`).join(', ')}`}>
          <path className="back" d={swell} transform="translate(0 -7)" />
          <path className="front" data-tide-front d={d} />
          {todayIndex >= 0 && <line className="now" x1={((todayIndex + 0.5) * TIDE_W) / 7} x2={((todayIndex + 0.5) * TIDE_W) / 7} y1="0" y2={TIDE_H} vectorEffect="non-scaling-stroke" />}
        </svg>
        <div className="seven columns">
          {dates.map((date) => <DayColumn key={date} date={date} />)}
        </div>
      </div>
    </div>
  )
}
