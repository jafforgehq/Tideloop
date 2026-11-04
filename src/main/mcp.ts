import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import { addDays, isValidDate, longDay, startOfWeek, todayISO, weekTitle } from '../shared/dates'
import { PlannerError } from '../shared/planner'
import { dayLoad } from '../shared/tide'
import type { ISODate, PlannerData } from '../shared/types'
import type { Store } from './store'

export const MCP_PORT = 47613
const MAX_RANGE_DAYS = 62
const TOKEN_FILE = 'mcp-token'

export const mcpCommand = (port: number, token: string): string =>
  `claude mcp add --transport http --scope user tideloop http://127.0.0.1:${port}/mcp --header "Authorization: Bearer ${token}"`

export function regenerateToken(dir: string): string {
  const path = join(dir, TOKEN_FILE)
  const token = randomBytes(32).toString('hex')
  writeFileSync(path, token, { mode: 0o600 })
  chmodSync(path, 0o600)
  return token
}

export function loadOrCreateToken(dir: string): string {
  const path = join(dir, TOKEN_FILE)
  const existing = existsSync(path) ? readFileSync(path, 'utf8').trim() : ''
  return /^[0-9a-f]{64}$/.test(existing) ? existing : regenerateToken(dir)
}

const listName = (state: PlannerData, id: string) => state.lists.find((l) => l.id === id)?.name ?? id

const todoView = (state: PlannerData, t: PlannerData['todos'][number]) => ({
  id: t.id,
  title: t.title,
  list: listName(state, t.listId),
  date: t.date,
  done: t.done,
  doneAt: t.doneAt,
  minutes: t.minutes,
  notes: t.notes
})

function dayView(state: PlannerData, date: ISODate) {
  return {
    date,
    day: longDay(date),
    loadMinutes: dayLoad(state, date),
    events: state.events.filter((e) => e.date === date).sort((a, b) => a.start.localeCompare(b.start)),
    todos: state.todos.filter((t) => t.date === date).sort((a, b) => a.order - b.order).map((t) => todoView(state, t))
  }
}

/** Accepts a list's id or its name in any case. */
function resolveList(state: PlannerData, name: string): string {
  const wanted = name.trim().toLowerCase()
  const list = state.lists.find((l) => l.id === name || l.name.toLowerCase() === wanted)
  if (!list) throw new PlannerError(`No list named ${name}`)
  return list.id
}

const defined = <T extends object>(value: T): T => Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T

function buildServer(store: Store, today: () => ISODate, version: string): McpServer {
  const server = new McpServer(
    { name: 'tideloop', version },
    { instructions: 'Tideloop is the owner\'s week planner. Dates are YYYY-MM-DD and times are 24 hour HH:MM. Todos with no date sit in a list until scheduled. Every edit appears live in the app and can be undone there with Cmd+Z.' }
  )

  const tool = <S extends z.ZodRawShape>(
    name: string,
    description: string,
    inputSchema: S,
    run: (args: z.infer<z.ZodObject<S>>) => unknown,
    annotations: { readOnlyHint?: boolean; destructiveHint?: boolean } = {}
  ) => {
    const handler = async (args: z.infer<z.ZodObject<S>>) => {
      try {
        return { content: [{ type: 'text' as const, text: JSON.stringify(run(args), null, 2) }] }
      } catch (error) {
        if (error instanceof PlannerError) return { isError: true, content: [{ type: 'text' as const, text: error.message }] }
        throw error
      }
    }
    // The SDK's generics cannot follow a shape through this wrapper. Inputs are still validated at runtime.
    ;(server.registerTool as (...a: unknown[]) => void)(name, { description, inputSchema, annotations }, handler)
  }
  const read = { readOnlyHint: true }
  const destroys = { destructiveHint: true }

  tool('get_week', 'The week containing a date, by default this week: each day with its events, todos and booked minutes.', { date: z.string().optional() }, ({ date }) => {
    if (date !== undefined && !isValidDate(date)) throw new PlannerError(`Not a real date: ${date}`)
    const state = store.getState()
    const monday = startOfWeek(date ?? today())
    return {
      today: today(),
      title: weekTitle(monday),
      fullDayMinutes: state.settings.fullDayHours * 60,
      days: Array.from({ length: 7 }, (_, i) => dayView(state, addDays(monday, i)))
    }
  }, read)

  tool('get_days', `Days from one date to another, inclusive, up to ${MAX_RANGE_DAYS} days.`, { from: z.string(), to: z.string() }, ({ from, to }) => {
    if (!isValidDate(from) || !isValidDate(to)) throw new PlannerError('from and to must be real dates')
    const days: ISODate[] = []
    for (let d = from; d <= to; d = addDays(d, 1)) {
      if (days.length === MAX_RANGE_DAYS) throw new PlannerError(`A range can cover at most ${MAX_RANGE_DAYS} days`)
      days.push(d)
    }
    const state = store.getState()
    return days.map((d) => dayView(state, d))
  }, read)

  tool('list_todos', 'Todos, optionally filtered by list, by whether they have a date, and by done state.', { list: z.string().optional(), scheduled: z.boolean().optional(), done: z.boolean().optional() }, ({ list, scheduled, done }) => {
    const state = store.getState()
    const listId = list === undefined ? undefined : resolveList(state, list)
    return state.todos
      .filter((t) => (listId === undefined || t.listId === listId) && (scheduled === undefined || (t.date !== null) === scheduled) && (done === undefined || t.done === done))
      .map((t) => todoView(state, t))
  }, read)

  tool('list_lists', 'All todo lists with their count of open todos.', {}, () => {
    const state = store.getState()
    return state.lists.map((l) => ({ id: l.id, name: l.name, open: state.todos.filter((t) => t.listId === l.id && !t.done).length }))
  }, read)

  tool('add_todo', 'Adds a todo. With no date it waits in its list. With no list it goes in the first list.', { title: z.string(), date: z.string().nullable().optional(), list: z.string().optional(), minutes: z.number().optional(), notes: z.string().optional() }, ({ title, date, list, minutes, notes }) => {
    const id = randomUUID()
    const listId = list === undefined ? undefined : resolveList(store.getState(), list)
    store.dispatch(defined({ type: 'todo/add', id, title, date, listId, minutes, notes }))
    const state = store.getState()
    return todoView(state, state.todos.find((t) => t.id === id)!)
  })

  tool('update_todo', 'Changes a todo. Set date to move it to a day, or date to null to take it off the calendar.', { id: z.string(), title: z.string().optional(), date: z.string().nullable().optional(), list: z.string().optional(), minutes: z.number().optional(), notes: z.string().optional(), done: z.boolean().optional() }, ({ id, list, ...rest }) => {
    const listId = list === undefined ? undefined : resolveList(store.getState(), list)
    store.dispatch({ type: 'todo/update', id, patch: defined({ ...rest, listId }) })
    const state = store.getState()
    return todoView(state, state.todos.find((t) => t.id === id)!)
  })

  tool('delete_todo', 'Deletes a todo.', { id: z.string() }, ({ id }) => {
    store.dispatch({ type: 'todo/delete', id })
    return { deleted: id }
  }, destroys)

  tool('move_overdue_to_today', 'Moves every unfinished todo from past days to today.', {}, () => {
    const now = today()
    const moved = store.getState().todos.filter((t) => t.date !== null && t.date < now && !t.done).length
    store.dispatch({ type: 'todo/rollover', today: now })
    return { moved, today: now }
  })

  tool('add_event', 'Adds a calendar event at a fixed time. Minutes default to 60.', { title: z.string(), date: z.string(), start: z.string(), minutes: z.number().optional(), notes: z.string().optional() }, ({ title, date, start, minutes, notes }) => {
    const id = randomUUID()
    store.dispatch(defined({ type: 'event/add', id, title, date, start, minutes, notes }))
    return store.getState().events.find((e) => e.id === id)
  })

  tool('update_event', 'Changes a calendar event.', { id: z.string(), title: z.string().optional(), date: z.string().optional(), start: z.string().optional(), minutes: z.number().optional(), notes: z.string().optional() }, ({ id, ...rest }) => {
    store.dispatch({ type: 'event/update', id, patch: defined(rest) })
    return store.getState().events.find((e) => e.id === id)
  })

  tool('delete_event', 'Deletes a calendar event.', { id: z.string() }, ({ id }) => {
    store.dispatch({ type: 'event/delete', id })
    return { deleted: id }
  }, destroys)

  tool('add_list', 'Adds a todo list.', { name: z.string() }, ({ name }) => {
    const id = randomUUID()
    store.dispatch({ type: 'list/add', id, name })
    return store.getState().lists.find((l) => l.id === id)
  })

  tool('rename_list', 'Renames a todo list.', { list: z.string(), name: z.string() }, ({ list, name }) => {
    const id = resolveList(store.getState(), list)
    store.dispatch({ type: 'list/update', id, patch: { name } })
    return store.getState().lists.find((l) => l.id === id)
  })

  tool('delete_list', 'Deletes a list and moves its todos to the first remaining list.', { list: z.string() }, ({ list }) => {
    const id = resolveList(store.getState(), list)
    store.dispatch({ type: 'list/delete', id })
    return { deleted: id, todosMovedTo: store.getState().lists[0].name }
  }, destroys)

  return server
}

const digest = (value: string) => createHash('sha256').update(value).digest()
const refuse = (res: ServerResponse, code: number, headers: Record<string, string> = {}) => {
  res.writeHead(code, headers)
  res.end()
}

export interface McpOptions {
  store: Store
  port: number
  token: string
  today?: () => ISODate
  version?: string
}

/** Loopback only, token required. Host and Origin checks stop web pages and DNS rebinding reaching it. */
export function startMcpServer({ store, port, token, today = todayISO, version = '0.0.0' }: McpOptions) {
  const expected = digest(`Bearer ${token}`)

  const handle = async (req: IncomingMessage, res: ServerResponse, actualPort: number) => {
    const hosts = [`127.0.0.1:${actualPort}`, `localhost:${actualPort}`]
    if (!hosts.includes(req.headers.host ?? '')) return refuse(res, 403)
    const origin = req.headers.origin
    if (origin !== undefined && !hosts.some((h) => origin === `http://${h}`)) return refuse(res, 403)
    if (!timingSafeEqual(digest(req.headers.authorization ?? ''), expected)) return refuse(res, 401, { 'WWW-Authenticate': 'Bearer' })
    if (req.url !== '/mcp') return refuse(res, 404)
    if (req.method !== 'POST') return refuse(res, 405, { Allow: 'POST' })

    // Stateless: a fresh server and transport for each request. All state lives in the store.
    const server = buildServer(store, today, version)
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    res.on('close', () => {
      void transport.close()
      void server.close()
    })
    await server.connect(transport)
    await transport.handleRequest(req, res)
  }

  return new Promise<{ port: number; address: string; close: () => Promise<void> }>((resolve, reject) => {
    const http = createServer((req, res) => {
      handle(req, res, (http.address() as AddressInfo).port).catch(() => {
        if (!res.headersSent) refuse(res, 500)
        else res.end()
      })
    })
    http.once('error', reject)
    http.listen(port, '127.0.0.1', () => {
      http.off('error', reject)
      const info = http.address() as AddressInfo
      resolve({
        port: info.port,
        address: info.address,
        close: () =>
          new Promise((done) => {
            http.close(() => done())
            http.closeAllConnections()
          })
      })
    })
  })
}
