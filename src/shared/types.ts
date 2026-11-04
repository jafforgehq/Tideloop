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
  /** The day it was ticked off. Null while open, and for todos finished before this was recorded. */
  doneAt: ISODate | null
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
  tutorialDone: boolean
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
  | { type: 'todo/update'; id: string; patch: Partial<Pick<Todo, 'title' | 'listId' | 'date' | 'minutes' | 'notes' | 'done'>>; today?: ISODate }
  | { type: 'todo/move'; id: string; date: ISODate | null; listId?: string; beforeId?: string }
  | { type: 'todo/toggle'; id: string; today?: ISODate }
  | { type: 'todo/delete'; id: string }
  | { type: 'todo/rollover'; today: ISODate }
  | { type: 'event/add'; id: string; title: string; date: ISODate; start: string; minutes?: number; notes?: string }
  | { type: 'event/update'; id: string; patch: Partial<Pick<CalEvent, 'title' | 'date' | 'start' | 'minutes' | 'notes'>> }
  | { type: 'event/delete'; id: string }
  | { type: 'list/add'; id: string; name: string; color?: number }
  | { type: 'list/update'; id: string; patch: Partial<Pick<List, 'name' | 'color'>> }
  | { type: 'list/delete'; id: string }
  | { type: 'settings/update'; patch: Partial<Settings> }

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'unsupported' }
  | { state: 'checking' }
  | { state: 'current' }
  | { state: 'available'; version: string }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'ready'; version: string }
  | { state: 'error'; message: string }

export interface McpInfo {
  enabled: boolean
  running: boolean
  port: number
  /** The `claude mcp add` command with its token masked. The real one is only ever copied by the main process. */
  command: string | null
  error: string | null
}
