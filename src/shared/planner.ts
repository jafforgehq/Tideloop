import { isValidDate } from './dates'
import { THEME_IDS, type Action, type CalEvent, type ISODate, type List, type PlannerData, type Settings, type Todo } from './types'

export class PlannerError extends Error {}

const fail = (message: string): never => {
  throw new PlannerError(message)
}

export const DEFAULT_SETTINGS: Settings = {
  themeMode: 'system',
  lightTheme: 'tide',
  darkTheme: 'deep-water',
  fixedTheme: 'tide',
  fullDayHours: 8,
  autoUpdate: true,
  mcpEnabled: false
}

export const emptyData = (): PlannerData => ({
  version: 1,
  lists: [
    { id: 'work', name: 'Work', color: 0 },
    { id: 'home', name: 'Home', color: 1 }
  ],
  todos: [],
  events: [],
  settings: { ...DEFAULT_SETTINGS }
})

const text = (value: unknown, what: string): string => {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed || fail(`${what} cannot be empty`)
}
const minutesOf = (value: unknown): number =>
  Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 1440 ? (value as number) : fail('Minutes must be a whole number from 1 to 1440')
const dateOf = (value: unknown): ISODate => (isValidDate(value) ? value : fail(`Not a real date: ${String(value)}`))
const startOf = (value: unknown): string =>
  typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fail(`Start must be HH:MM in 24 hours: ${String(value)}`)
const listOf = (data: PlannerData, id: unknown): string => (data.lists.some((l) => l.id === id) ? (id as string) : fail(`No list with id ${String(id)}`))

const findTodo = (data: PlannerData, id: string): Todo => data.todos.find((t) => t.id === id) ?? fail(`No todo with id ${id}`)
const findEvent = (data: PlannerData, id: string): CalEvent => data.events.find((e) => e.id === id) ?? fail(`No event with id ${id}`)
const findList = (data: PlannerData, id: string): List => data.lists.find((l) => l.id === id) ?? fail(`No list with id ${id}`)

/** Dated todos share an order per day. Undated ones share an order per list. */
const sameGroup = (t: Todo, date: ISODate | null, listId: string) => t.date === date && (date !== null || t.listId === listId)
const group = (todos: Todo[], date: ISODate | null, listId: string) =>
  todos.filter((t) => sameGroup(t, date, listId)).sort((a, b) => a.order - b.order)
const nextOrder = (todos: Todo[], date: ISODate | null, listId: string) =>
  group(todos, date, listId).reduce((max, t) => Math.max(max, t.order + 1), 0)

function checkSettings(patch: Partial<Settings>): Partial<Settings> {
  const hours = patch.fullDayHours
  if (hours !== undefined && !(Number.isInteger(hours) && hours >= 1 && hours <= 24)) fail('A full day must be 1 to 24 hours')
  if (patch.themeMode !== undefined && patch.themeMode !== 'system' && patch.themeMode !== 'fixed') fail('Unknown theme mode')
  for (const theme of [patch.lightTheme, patch.darkTheme, patch.fixedTheme]) {
    if (theme !== undefined && !THEME_IDS.includes(theme)) fail(`Unknown theme: ${String(theme)}`)
  }
  return patch
}

/** Applies one action and returns new state. Throws PlannerError and changes nothing when input is bad. */
export function reduce(data: PlannerData, action: Action): PlannerData {
  switch (action.type) {
    case 'todo/add': {
      const date = action.date == null ? null : dateOf(action.date)
      const listId = action.listId === undefined ? data.lists[0].id : listOf(data, action.listId)
      const todo: Todo = {
        id: action.id,
        title: text(action.title, 'Title'),
        listId,
        date,
        done: false,
        minutes: action.minutes === undefined ? 30 : minutesOf(action.minutes),
        order: nextOrder(data.todos, date, listId),
        notes: action.notes ?? ''
      }
      return { ...data, todos: [...data.todos, todo] }
    }
    case 'todo/update': {
      const current = findTodo(data, action.id)
      const { patch } = action
      const next: Todo = {
        ...current,
        ...patch,
        title: patch.title === undefined ? current.title : text(patch.title, 'Title'),
        minutes: patch.minutes === undefined ? current.minutes : minutesOf(patch.minutes),
        listId: patch.listId === undefined ? current.listId : listOf(data, patch.listId),
        date: patch.date === undefined || patch.date === null ? (patch.date === null ? null : current.date) : dateOf(patch.date)
      }
      if (!sameGroup(current, next.date, next.listId)) next.order = nextOrder(data.todos, next.date, next.listId)
      return { ...data, todos: data.todos.map((t) => (t.id === action.id ? next : t)) }
    }
    case 'todo/move': {
      const current = findTodo(data, action.id)
      const date = action.date === null ? null : dateOf(action.date)
      const listId = action.listId === undefined ? current.listId : listOf(data, action.listId)
      const siblings = group(data.todos.filter((t) => t.id !== action.id), date, listId)
      const index = Math.max(0, Math.min(action.index ?? siblings.length, siblings.length))
      siblings.splice(index, 0, { ...current, date, listId })
      const updated = new Map(siblings.map((t, order) => [t.id, { ...t, order }]))
      return { ...data, todos: data.todos.map((t) => updated.get(t.id) ?? t) }
    }
    case 'todo/toggle': {
      const current = findTodo(data, action.id)
      return { ...data, todos: data.todos.map((t) => (t.id === action.id ? { ...current, done: !current.done } : t)) }
    }
    case 'todo/delete':
      findTodo(data, action.id)
      return { ...data, todos: data.todos.filter((t) => t.id !== action.id) }
    case 'todo/rollover': {
      const today = dateOf(action.today)
      const late = data.todos
        .filter((t) => t.date !== null && t.date < today && !t.done)
        .sort((a, b) => a.date!.localeCompare(b.date!) || a.order - b.order)
      let order = nextOrder(data.todos, today, '')
      const moved = new Map(late.map((t) => [t.id, { ...t, date: today, order: order++ }]))
      return { ...data, todos: data.todos.map((t) => moved.get(t.id) ?? t) }
    }
    case 'event/add': {
      const event: CalEvent = {
        id: action.id,
        title: text(action.title, 'Title'),
        date: dateOf(action.date),
        start: startOf(action.start),
        minutes: action.minutes === undefined ? 60 : minutesOf(action.minutes),
        notes: action.notes ?? ''
      }
      return { ...data, events: [...data.events, event] }
    }
    case 'event/update': {
      const current = findEvent(data, action.id)
      const { patch } = action
      const next: CalEvent = {
        ...current,
        ...patch,
        title: patch.title === undefined ? current.title : text(patch.title, 'Title'),
        date: patch.date === undefined ? current.date : dateOf(patch.date),
        start: patch.start === undefined ? current.start : startOf(patch.start),
        minutes: patch.minutes === undefined ? current.minutes : minutesOf(patch.minutes)
      }
      return { ...data, events: data.events.map((e) => (e.id === action.id ? next : e)) }
    }
    case 'event/delete':
      findEvent(data, action.id)
      return { ...data, events: data.events.filter((e) => e.id !== action.id) }
    case 'list/add':
      return { ...data, lists: [...data.lists, { id: action.id, name: text(action.name, 'List name'), color: action.color ?? data.lists.length }] }
    case 'list/update': {
      const current = findList(data, action.id)
      const name = action.patch.name === undefined ? current.name : text(action.patch.name, 'List name')
      return { ...data, lists: data.lists.map((l) => (l.id === action.id ? { ...current, ...action.patch, name } : l)) }
    }
    case 'list/delete': {
      findList(data, action.id)
      const rest = data.lists.filter((l) => l.id !== action.id)
      if (rest.length === 0) fail('The last list cannot be deleted')
      let order = nextOrder(data.todos, null, rest[0].id)
      const todos = data.todos.map((t) =>
        t.listId === action.id ? { ...t, listId: rest[0].id, order: t.date === null ? order++ : t.order } : t
      )
      return { ...data, lists: rest, todos }
    }
    case 'settings/update':
      return { ...data, settings: { ...data.settings, ...checkSettings(action.patch) } }
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0

/** Validates data read from disk. Throws rather than guessing, so a damaged file is never silently rewritten. */
export function normalize(raw: unknown): PlannerData {
  if (!isObject(raw)) return fail('Planner data is not an object')
  if (typeof raw.version === 'number' && raw.version > 1) return fail('Planner data was saved by a newer version of Tideloop')
  if (raw.version !== 1) return fail('Planner data has no known version')
  const { lists, todos, events } = raw
  if (!Array.isArray(lists) || !Array.isArray(todos) || !Array.isArray(events) || lists.length === 0) return fail('Planner data is missing lists, todos or events')

  const checkedLists: List[] = lists.map((l: Record<string, unknown>) => {
    if (!isId(l?.id)) fail('A list has no id')
    return { id: l.id as string, name: text(l.name, 'List name'), color: Number.isInteger(l.color) ? (l.color as number) : 0 }
  })
  const checkedTodos: Todo[] = todos.map((t: Record<string, unknown>) => {
    if (!isId(t?.id)) fail('A todo has no id')
    return {
      id: t.id as string,
      title: text(t.title, 'Title'),
      listId: listOf({ lists: checkedLists } as PlannerData, t.listId),
      date: t.date === null ? null : dateOf(t.date),
      done: t.done === true,
      minutes: minutesOf(t.minutes),
      order: typeof t.order === 'number' ? t.order : 0,
      notes: typeof t.notes === 'string' ? t.notes : ''
    }
  })
  const checkedEvents: CalEvent[] = events.map((e: Record<string, unknown>) => {
    if (!isId(e?.id)) fail('An event has no id')
    return {
      id: e.id as string,
      title: text(e.title, 'Title'),
      date: dateOf(e.date),
      start: startOf(e.start),
      minutes: minutesOf(e.minutes),
      notes: typeof e.notes === 'string' ? e.notes : ''
    }
  })
  const settings = { ...DEFAULT_SETTINGS }
  if (isObject(raw.settings)) {
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
      const value = raw.settings[key]
      if (value === undefined) continue
      try {
        Object.assign(settings, checkSettings({ [key]: value }))
      } catch {
        // A bad preference falls back to its default. It is not worth refusing the whole file for.
      }
    }
  }
  return { version: 1, lists: checkedLists, todos: checkedTodos, events: checkedEvents, settings }
}
