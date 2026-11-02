import type { ISODate } from './types'

const DAY = 86_400_000
const LONG_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// Dates are plain calendar days, so all arithmetic runs in UTC and cannot drift across DST.
const toUtc = (d: ISODate): number => {
  const [y, m, day] = d.split('-').map(Number)
  return Date.UTC(y, m - 1, day)
}
const fromUtc = (t: number): ISODate => new Date(t).toISOString().slice(0, 10)
/** 0 is Monday, 6 is Sunday. */
export const weekdayIndex = (d: ISODate): number => (new Date(toUtc(d)).getUTCDay() + 6) % 7

export const addDays = (d: ISODate, n: number): ISODate => fromUtc(toUtc(d) + n * DAY)
export const startOfWeek = (d: ISODate): ISODate => addDays(d, -weekdayIndex(d))
export const longDay = (d: ISODate): string => LONG_DAYS[weekdayIndex(d)]
export const shortDay = (d: ISODate): string => longDay(d).slice(0, 3)
export const dayOfMonth = (d: ISODate): number => Number(d.slice(8))
export const monthName = (month: number): string => MONTHS[month - 1]

export function isoWeek(d: ISODate): number {
  const thursday = toUtc(addDays(d, 3 - weekdayIndex(d)))
  const yearStart = Date.UTC(new Date(thursday).getUTCFullYear(), 0, 1)
  return Math.floor((thursday - yearStart) / DAY / 7) + 1
}

export function monthGrid(year: number, month: number): { date: ISODate; inMonth: boolean }[] {
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  const first = startOfWeek(`${prefix}-01`)
  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(first, i)
    return { date, inMonth: date.startsWith(prefix) }
  })
}

export function isValidDate(s: unknown): s is ISODate {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const t = toUtc(s)
  return !Number.isNaN(t) && fromUtc(t) === s
}

export function todayISO(now: Date = new Date()): ISODate {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function weekTitle(monday: ISODate): string {
  const sunday = addDays(monday, 6)
  const month = (d: ISODate) => monthName(Number(d.slice(5, 7)))
  const from = month(monday) === month(sunday) ? dayOfMonth(monday) : `${dayOfMonth(monday)} ${month(monday)}`
  return `Week ${isoWeek(monday)}, ${from} to ${dayOfMonth(sunday)} ${month(sunday)}`
}
