import { addDays, dayLabel, longDay, monthGrid } from './dates'
import type { ISODate, PlannerData } from './types'

/** Booked minutes on a day. Done todos count, so finishing work does not rewrite the shape of the day. */
export function dayLoad(data: PlannerData, date: ISODate): number {
  const sum = (items: { date: ISODate | null; minutes: number }[]) =>
    items.reduce((total, x) => (x.date === date ? total + x.minutes : total), 0)
  return sum(data.events) + sum(data.todos)
}

/** Closed curve through seven daily loads. The command shape never changes, so CSS can animate `d`. */
export function tidePath(loads: number[], width: number, height: number, maxMinutes: number): string {
  const pts = loads.map((m, i) => [((i + 0.5) * width) / loads.length, height - 6 - (Math.min(m, maxMinutes) / maxMinutes) * (height - 16)])
  let d = `M0 ${height} L0 ${pts[0][1]} L${pts[0][0]} ${pts[0][1]}`
  for (let i = 1; i < pts.length; i++) {
    const mid = (pts[i - 1][0] + pts[i][0]) / 2
    d += ` C${mid} ${pts[i - 1][1]} ${mid} ${pts[i][1]} ${pts[i][0]} ${pts[i][1]}`
  }
  return `${d} L${width} ${pts.at(-1)![1]} L${width} ${height} Z`
}

export function weekSummary(data: PlannerData, monday: ISODate) {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const loads = dates.map((d) => dayLoad(data, d))
  const max = Math.max(...loads)
  return {
    dates,
    loads,
    high: max > 0 ? dates[loads.indexOf(max)] : null,
    low: dates[loads.indexOf(Math.min(...loads))]
  }
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m}m`
  return m ? `${h}h ${m}m` : `${h}h`
}

/** The one sentence under the week title. A day over the limit outranks high water. */
export function weekFinding(data: PlannerData, monday: ISODate): string {
  const { dates, loads, high, low } = weekSummary(data, monday)
  if (!high) return 'Nothing booked yet. Drag a todo onto a day.'
  const lowText = `Low water is ${longDay(low)} at ${formatMinutes(Math.min(...loads))}.`
  const full = data.settings.fullDayHours * 60
  const peak = Math.max(...loads)
  if (peak > full) return `${longDay(dates[loads.indexOf(peak)])} is ${formatMinutes(peak - full)} over a full day. ${lowText}`
  return `High tide is ${longDay(high)} at ${formatMinutes(peak)}. ${lowText}`
}

export function monthFinding(data: PlannerData, year: number, month: number): string {
  const days = monthGrid(year, month).filter((c) => c.inMonth).map((c) => c.date)
  const loads = days.map((d) => dayLoad(data, d))
  const peak = Math.max(...loads)
  if (peak === 0) return 'Nothing booked this month.'
  return `Busiest day is ${dayLabel(days[loads.indexOf(peak)])} at ${formatMinutes(peak)}.`
}

export const overdueCount = (data: PlannerData, today: ISODate): number =>
  data.todos.filter((t) => t.date !== null && t.date < today && !t.done).length
