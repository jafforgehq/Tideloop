import { addDays, weekdayIndex } from './dates'
import type { ISODate } from './types'

export interface QuickAdd {
  kind: 'todo' | 'event'
  title: string
  date?: ISODate
  start?: string
  minutes?: number
  listName?: string
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const pad = (n: number) => String(n).padStart(2, '0')

function readTime(t: string): string | null {
  const h24 = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(t)
  if (h24) return `${pad(Number(h24[1]))}:${h24[2]}`
  const h12 = /^(\d{1,2})(?::([0-5]\d))?(am|pm)$/i.exec(t)
  if (!h12) return null
  const hour = Number(h12[1])
  if (hour < 1 || hour > 12) return null
  return `${pad((hour % 12) + (h12[3].toLowerCase() === 'pm' ? 12 : 0))}:${h12[2] ?? '00'}`
}

function readDuration(t: string): number | null {
  const hm = /^(\d+)h(\d+)m?$/i.exec(t)
  const hours = /^(\d+(?:\.\d+)?)h$/i.exec(t)
  const mins = /^(\d+)m(?:in)?$/i.exec(t)
  const value = hm ? Number(hm[1]) * 60 + Number(hm[2]) : hours ? Number(hours[1]) * 60 : mins ? Number(mins[1]) : null
  return value !== null && Number.isInteger(value) && value >= 1 && value <= 1440 ? value : null
}

function readDay(word: string, today: ISODate, allowShort: boolean): ISODate | null {
  const w = word.toLowerCase()
  if (w === 'today') return today
  if (w === 'tomorrow') return addDays(today, 1)
  const i = DAYS.findIndex((d) => d === w || (allowShort && d.slice(0, 3) === w))
  return i < 0 ? null : addDays(today, (i - weekdayIndex(today) + 7) % 7)
}

/** Reads "Dentist fri 14:30 45m #health". Words that are not clearly tokens stay in the title. */
export function parseQuickAdd(text: string, today: ISODate): QuickAdd {
  const clean = text.trim().replace(/\s+/g, ' ')
  const out: QuickAdd = { kind: 'todo', title: clean }
  const words: string[] = []
  for (const token of clean.split(' ')) {
    const tag = /^#(\S+)$/.exec(token)
    const time = readTime(token)
    const duration = readDuration(token)
    if (tag && !out.listName) out.listName = tag[1]
    else if (time && !out.start) out.start = time
    else if (duration && !out.minutes) out.minutes = duration
    else words.push(token)
  }
  // Day words count only at the edges, and short ones only at the end, so "Buy sun cream" stays a title.
  const last = words.length > 1 ? readDay(words.at(-1)!, today, true) : null
  const first = words.length > 1 && !last ? readDay(words[0], today, false) : null
  if (last) out.date = last
  if (first) out.date = first
  const title = (last ? words.slice(0, -1) : first ? words.slice(1) : words).join(' ')
  if (!title) return { kind: 'todo', title: clean }
  out.title = title
  if (out.start) {
    out.kind = 'event'
    out.minutes ??= 60
  }
  return out
}
