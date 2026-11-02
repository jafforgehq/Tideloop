import { dayLabel, dayOfMonth, monthGrid } from '../../shared/dates'
import { dayLoad } from '../../shared/tide'
import type { ISODate } from '../../shared/types'
import { EventCard, TodoCard } from './Cards'
import { useApp, useDropZone } from './context'

const VISIBLE_ITEMS = 3
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function Cell({ date, inMonth }: { date: ISODate; inMonth: boolean }) {
  const app = useApp()
  const zone = useDropZone(`cell:${date}`, { date }, { ordered: false })
  const events = app.data.events.filter((e) => e.date === date).sort((a, b) => a.start.localeCompare(b.start))
  const todos = app.data.todos.filter((t) => t.date === date).sort((a, b) => a.order - b.order)
  const shownEvents = events.slice(0, VISIBLE_ITEMS)
  const shownTodos = todos.slice(0, VISIBLE_ITEMS - shownEvents.length)
  const hidden = events.length + todos.length - shownEvents.length - shownTodos.length
  const level = Math.min(100, (dayLoad(app.data, date) / (app.data.settings.fullDayHours * 60)) * 100)
  return (
    <section aria-label={dayLabel(date)} className="cell" data-in-month={inMonth} data-today={date === app.today} data-drop={zone.active} {...zone.props}>
      <div className="level" style={{ height: `${level}%` }} />
      <button className="date" aria-label={`Open the week of ${dayLabel(date)}`} onClick={() => app.goTo(date, 'week')}>
        {dayOfMonth(date)}
      </button>
      <ul className="stack tight">
        {shownEvents.map((e) => <EventCard key={e.id} event={e} />)}
        {shownTodos.map((t) => <TodoCard key={t.id} todo={t} showCheck={false} />)}
      </ul>
      {hidden > 0 && (
        <button className="more" onClick={() => app.goTo(date, 'week')}>
          {hidden} more
        </button>
      )}
    </section>
  )
}

export function Month({ year, month }: { year: number; month: number }) {
  return (
    <div className="week-scroll">
      <div className="month">
        <div className="seven heads">
          {DOW.map((d) => <div key={d} className="head"><span className="dow">{d}</span></div>)}
        </div>
        <div className="seven month-grid">
          {monthGrid(year, month).map((c) => <Cell key={c.date} date={c.date} inMonth={c.inMonth} />)}
        </div>
      </div>
    </div>
  )
}
