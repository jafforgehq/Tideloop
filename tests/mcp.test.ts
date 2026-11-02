import { mkdtempSync, rmSync, statSync } from 'node:fs'
import { request } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadOrCreateToken, mcpCommand, regenerateToken, startMcpServer } from '../src/main/mcp'
import { createStore, type Store } from '../src/main/store'
import { emptyData } from '../src/shared/planner'

const TOKEN = 'test-token'
let store: Store
let server: Awaited<ReturnType<typeof startMcpServer>>
let client: Client

const raw = (headers: Record<string, string>, method = 'POST') =>
  new Promise<number>((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: server.port, path: '/mcp', method, headers }, (res) => {
      res.resume()
      resolve(res.statusCode!)
    })
    req.on('error', reject)
    req.end('{}')
  })
const call = async (name: string, args: Record<string, unknown> = {}) => {
  const result = (await client.callTool({ name, arguments: args })) as { isError?: boolean; content: { text: string }[] }
  return { isError: result.isError === true, text: result.content[0].text }
}
const json = async (name: string, args: Record<string, unknown> = {}) => JSON.parse((await call(name, args)).text)

beforeEach(async () => {
  store = createStore({ data: emptyData(), save: () => {} })
  server = await startMcpServer({ store, port: 0, token: TOKEN, today: () => '2026-11-04' })
  client = new Client({ name: 'test', version: '0' })
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${server.port}/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${TOKEN}` } }
    })
  )
})
afterEach(async () => {
  await client.close()
  await server.close()
})

describe('access control', () => {
  const good = () => ({ Authorization: `Bearer ${TOKEN}`, Host: `127.0.0.1:${server.port}` })
  it('listens on loopback only', () => expect(server.address).toBe('127.0.0.1'))
  it('refuses a missing token', async () => expect(await raw({ Host: `127.0.0.1:${server.port}` })).toBe(401))
  it('refuses a wrong token', async () => expect(await raw({ ...good(), Authorization: 'Bearer nope' })).toBe(401))
  it('refuses a foreign Host, which stops DNS rebinding', async () => expect(await raw({ ...good(), Host: 'evil.example' })).toBe(403))
  it('refuses a foreign Origin, which stops web pages', async () => expect(await raw({ ...good(), Origin: 'https://evil.example' })).toBe(403))
  it('accepts its own origin', async () => expect(await raw({ ...good(), Origin: `http://127.0.0.1:${server.port}` })).not.toBe(403))
  it('answers GET with 405', async () => expect(await raw(good(), 'GET')).toBe(405))
  it('rejects when the port is taken', async () => {
    await expect(startMcpServer({ store, port: server.port, token: TOKEN })).rejects.toThrow()
  })
})

describe('tools', () => {
  it('offers reading and editing tools', async () => {
    const names = (await client.listTools()).tools.map((t) => t.name)
    expect(names).toEqual(expect.arrayContaining(['get_week', 'get_days', 'list_todos', 'list_lists', 'add_todo', 'update_todo', 'delete_todo', 'add_event', 'update_event', 'delete_event', 'add_list', 'rename_list', 'delete_list', 'move_overdue_to_today']))
  })
  it('adds a todo that reaches the store', async () => {
    const todo = await json('add_todo', { title: 'Buy milk', date: '2026-11-05', list: 'Home', minutes: 15 })
    expect(store.getState().todos[0]).toMatchObject({ id: todo.id, title: 'Buy milk', date: '2026-11-05', listId: 'home', minutes: 15 })
  })
  it('reports the week with loads and names', async () => {
    await call('add_todo', { title: 'Report', date: '2026-11-04', minutes: 60 })
    await call('add_event', { title: 'Dentist', date: '2026-11-04', start: '14:30', minutes: 45 })
    const week = await json('get_week')
    expect(week.today).toBe('2026-11-04')
    expect(week.title).toBe('Week 45, 2 to 8 November')
    expect(week.days).toHaveLength(7)
    expect(week.days[2]).toMatchObject({ date: '2026-11-04', day: 'Wednesday', loadMinutes: 105 })
    expect(week.days[2].events[0].title).toBe('Dentist')
    expect(week.days[2].todos[0]).toMatchObject({ title: 'Report', list: 'Work' })
  })
  it('moves a todo to another day and marks it done', async () => {
    const { id } = await json('add_todo', { title: 'Report' })
    await call('update_todo', { id, date: '2026-11-06', done: true })
    expect(store.getState().todos[0]).toMatchObject({ date: '2026-11-06', done: true })
    await call('update_todo', { id, date: null })
    expect(store.getState().todos[0].date).toBeNull()
  })
  it('filters todos', async () => {
    await call('add_todo', { title: 'No date' })
    await call('add_todo', { title: 'Dated', date: '2026-11-05', list: 'Home' })
    expect((await json('list_todos', { scheduled: false })).map((t: { title: string }) => t.title)).toEqual(['No date'])
    expect((await json('list_todos', { list: 'Home' })).map((t: { title: string }) => t.title)).toEqual(['Dated'])
  })
  it('deletes through the store, so undo still works', async () => {
    const { id } = await json('add_todo', { title: 'Report' })
    await call('delete_todo', { id })
    expect(store.getState().todos).toHaveLength(0)
    store.undo()
    expect(store.getState().todos).toHaveLength(1)
  })
  it.each([
    ['update_todo', { id: 'nope', title: 'x' }, /No todo/],
    ['add_todo', { title: '   ' }, /empty/],
    ['add_todo', { title: 'x', date: '2026-02-30' }, /real date/],
    ['add_todo', { title: 'x', list: 'Nope' }, /No list/],
    ['add_event', { title: 'x', date: '2026-11-04', start: '25:00' }, /HH:MM/],
    ['delete_event', { id: 'nope' }, /No event/]
  ])('%s with %j is a clean error and changes nothing', async (name, args, message) => {
    const before = store.getState()
    const result = await call(name, args)
    expect(result.isError).toBe(true)
    expect(result.text).toMatch(message)
    expect(store.getState()).toBe(before)
  })
  it('refuses a range longer than 62 days', async () => {
    expect((await call('get_days', { from: '2026-01-01', to: '2026-12-31' })).isError).toBe(true)
  })
  it('moves overdue todos to today', async () => {
    await call('add_todo', { title: 'Late', date: '2026-11-01' })
    expect((await json('move_overdue_to_today')).moved).toBe(1)
    expect(store.getState().todos[0].date).toBe('2026-11-04')
  })
})

describe('token', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tideloop-token-'))
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))
  it('is created private and stays the same', () => {
    const token = loadOrCreateToken(dir)
    expect(token).toMatch(/^[0-9a-f]{64}$/)
    expect(statSync(join(dir, 'mcp-token')).mode & 0o077).toBe(0)
    expect(loadOrCreateToken(dir)).toBe(token)
  })
  it('can be replaced', () => {
    const token = loadOrCreateToken(dir)
    const next = regenerateToken(dir)
    expect(next).not.toBe(token)
    expect(loadOrCreateToken(dir)).toBe(next)
  })
})

describe('mcpCommand', () => {
  it('gives the Claude Code command', () => {
    expect(mcpCommand(47613, 'abc')).toBe('claude mcp add --transport http --scope user tideloop http://127.0.0.1:47613/mcp --header "Authorization: Bearer abc"')
  })
})
