import { monthGrid } from './dates'
import { formatMinutes } from './tide'
import type { ISODate, PlannerData, Todo } from './types'

export interface ReviewRow {
  listId: string
  name: string
  color: number
  done: number
  total: number
  /** Minutes of the todos finished in the range. */
  minutes: number
}

export interface Review {
  planned: { count: number; minutes: number }
  done: { count: number; minutes: number }
  /** Calendar event minutes in the range. */
  events: number
  rows: ReviewRow[]
  top: Todo[]
}

const TOP = 5

export function monthRange(year: number, month: number): [ISODate, ISODate] {
  const days = monthGrid(year, month).filter((c) => c.inMonth)
  return [days[0].date, days.at(-1)!.date]
}

/** Where the time went between two dates, both included. A todo counts on the day it is planned for. */
export function review(data: PlannerData, from: ISODate, to: ISODate): Review {
  const inRange = (date: ISODate | null): date is ISODate => date !== null && date >= from && date <= to
  const todos = data.todos.filter((t) => inRange(t.date))
  const finished = todos.filter((t) => t.done)
  const sum = (items: { minutes: number }[]) => items.reduce((total, x) => total + x.minutes, 0)
  const rows = data.lists
    .map((list): ReviewRow => {
      const own = todos.filter((t) => t.listId === list.id)
      const ownDone = own.filter((t) => t.done)
      return { listId: list.id, name: list.name, color: list.color, done: ownDone.length, total: own.length, minutes: sum(ownDone) }
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.minutes - a.minutes || b.done - a.done || a.name.localeCompare(b.name))
  return {
    planned: { count: todos.length, minutes: sum(todos) },
    done: { count: finished.length, minutes: sum(finished) },
    events: sum(data.events.filter((e) => inRange(e.date))),
    rows,
    top: [...finished].sort((a, b) => b.minutes - a.minutes || a.order - b.order).slice(0, TOP)
  }
}

export function reviewFinding(r: Review): string {
  const lead = r.rows[0]
  if (!lead || lead.done === 0) return 'Nothing finished in this period yet.'
  const share = Math.round((lead.minutes / r.done.minutes) * 100)
  return `Most focus went to ${lead.name}: ${formatMinutes(lead.minutes)} across ${lead.done} ${lead.done === 1 ? 'todo' : 'todos'}, ${share}% of the time you finished.`
}
