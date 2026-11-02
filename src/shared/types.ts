export type ISODate = string

export const THEME_IDS = ['tide', 'chart-paper', 'almanac', 'deep-water', 'kelp', 'terminal'] as const
export type ThemeId = (typeof THEME_IDS)[number]

export interface List {
  id: string
  name: string
  /** Index into the active theme's list colours. */
  color: number
}

export interface Todo {
  id: string
  title: string
  listId: string
  date: ISODate | null
  done: boolean
  minutes: number
  order: number
  notes: string
}

export interface CalEvent {
  id: string
  title: string
  date: ISODate
  /** 24 hour HH:MM. */
  start: string
  minutes: number
  notes: string
}

export interface Settings {
  themeMode: 'system' | 'fixed'
  lightTheme: ThemeId
  darkTheme: ThemeId
  fixedTheme: ThemeId
  fullDayHours: number
  autoUpdate: boolean
  mcpEnabled: boolean
}

export interface PlannerData {
  version: 1
  lists: List[]
  todos: Todo[]
  events: CalEvent[]
  settings: Settings
}

export type Action =
  | { type: 'todo/add'; id: string; title: string; listId?: string; date?: ISODate | null; minutes?: number; notes?: string }
  | { type: 'todo/update'; id: string; patch: Partial<Pick<Todo, 'title' | 'listId' | 'date' | 'minutes' | 'notes' | 'done'>> }
  | { type: 'todo/move'; id: string; date: ISODate | null; listId?: string; index?: number }
  | { type: 'todo/toggle'; id: string }
  | { type: 'todo/delete'; id: string }
  | { type: 'todo/rollover'; today: ISODate }
  | { type: 'event/add'; id: string; title: string; date: ISODate; start: string; minutes?: number; notes?: string }
  | { type: 'event/update'; id: string; patch: Partial<Pick<CalEvent, 'title' | 'date' | 'start' | 'minutes' | 'notes'>> }
  | { type: 'event/delete'; id: string }
  | { type: 'list/add'; id: string; name: string; color?: number }
  | { type: 'list/update'; id: string; patch: Partial<Pick<List, 'name' | 'color'>> }
  | { type: 'list/delete'; id: string }
  | { type: 'settings/update'; patch: Partial<Settings> }
