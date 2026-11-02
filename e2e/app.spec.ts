import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { expect, test } from '@playwright/test'
import { dayLabel } from '../src/shared/dates'
import { day, launch, seed, tempDir, today } from './helpers'

const region = (page: import('@playwright/test').Page, date: string) => page.getByRole('region', { name: dayLabel(date), exact: true })
const tide = (page: import('@playwright/test').Page) => page.locator('[data-tide-front]').getAttribute('d')

test('quick add puts a todo in its list and an event on its day', async () => {
  const { app, page } = await launch(tempDir())
  await page.getByLabel('New todo').fill('Buy milk #home')
  await page.getByLabel('New todo').press('Enter')
  await expect(page.getByRole('region', { name: 'Home list' }).getByText('Buy milk')).toBeVisible()
  await page.getByLabel('New todo').fill('Dentist today 14:30 45m')
  await page.getByLabel('New todo').press('Enter')
  await expect(region(page, today).getByText('Dentist')).toBeVisible()
  await app.close()
})

test('a todo dragged onto a day raises the tide and survives a restart', async () => {
  const dir = tempDir()
  seed(dir, [{ type: 'todo/add', id: 'milk', title: 'Buy milk' }])
  let { app, page } = await launch(dir)
  const before = await tide(page)
  await page.getByText('Buy milk').dragTo(region(page, day(3)))
  await expect(region(page, day(3)).getByText('Buy milk')).toBeVisible()
  await expect.poll(() => tide(page)).not.toBe(before)
  await app.close()
  ;({ app, page } = await launch(dir))
  await expect(region(page, day(3)).getByText('Buy milk')).toBeVisible()
  await app.close()
})

test('a todo drags back to its list, and between days', async () => {
  const dir = tempDir()
  seed(dir, [{ type: 'todo/add', id: 'a', title: 'Task A', date: day(1) }])
  const { app, page } = await launch(dir)
  await page.getByText('Task A').dragTo(region(page, day(4)))
  await expect(region(page, day(4)).getByText('Task A')).toBeVisible()
  await page.getByText('Task A').dragTo(page.getByRole('region', { name: 'Work list' }))
  await expect(page.getByRole('region', { name: 'Work list' }).getByText('Task A')).toBeVisible()
  await app.close()
})

test('a drop between two cards lands between them', async () => {
  const dir = tempDir()
  seed(dir, [
    { type: 'todo/add', id: 'a', title: 'First', date: day(1) },
    { type: 'todo/add', id: 'b', title: 'Second', date: day(1) },
    { type: 'todo/add', id: 'c', title: 'Third', date: day(2) }
  ])
  const { app, page } = await launch(dir)
  const target = await page.locator('[data-todo-id="b"]').boundingBox()
  await page.locator('[data-todo-id="c"]').dragTo(page.locator('[data-todo-id="b"]'), { targetPosition: { x: 10, y: 2 } })
  expect(target).not.toBeNull()
  await expect(region(page, day(1)).locator('[data-todo-id]')).toHaveText([/First/, /Third/, /Second/])
  await app.close()
})

test('a drop in a list lands where the line shows, with done todos in the list', async () => {
  const dir = tempDir()
  seed(dir, [
    { type: 'todo/add', id: 'a', title: 'Alpha' },
    { type: 'todo/add', id: 'b', title: 'Bravo' },
    { type: 'todo/toggle', id: 'b' },
    { type: 'todo/add', id: 'c', title: 'Charlie' },
    { type: 'todo/add', id: 'd', title: 'Delta' },
    { type: 'todo/add', id: 'x', title: 'Xray', date: day(1) }
  ])
  const { app, page } = await launch(dir)
  await page.locator('[data-todo-id="x"]').dragTo(page.locator('[data-todo-id="d"]'), { targetPosition: { x: 10, y: 2 } })
  const open = page.getByRole('region', { name: 'Work list' }).locator('[data-todo-id][data-done="false"]')
  await expect(open).toHaveText([/Alpha/, /Charlie/, /Xray/, /Delta/])
  await app.close()
})

test('keyboard reordering in a list skips done todos', async () => {
  const dir = tempDir()
  seed(dir, [
    { type: 'todo/add', id: 'a', title: 'Alpha' },
    { type: 'todo/add', id: 'b', title: 'Bravo' },
    { type: 'todo/toggle', id: 'b' },
    { type: 'todo/add', id: 'c', title: 'Charlie' },
    { type: 'todo/add', id: 'd', title: 'Delta' }
  ])
  const { app, page } = await launch(dir)
  await page.locator('[data-todo-id="a"]').focus()
  await page.keyboard.press('Alt+ArrowDown')
  const open = page.getByRole('region', { name: 'Work list' }).locator('[data-todo-id][data-done="false"]')
  await expect(open).toHaveText([/Charlie/, /Alpha/, /Delta/])
  await expect(page.locator('[data-todo-id="a"]')).toBeFocused()
  await app.close()
})

test('the keyboard can move, finish and open a todo', async () => {
  const dir = tempDir()
  seed(dir, [{ type: 'todo/add', id: 'a', title: 'Task A', date: day(1) }])
  const { app, page } = await launch(dir)
  await page.locator('[data-todo-id="a"]').focus()
  await page.keyboard.press('Alt+ArrowRight')
  await expect(region(page, day(2)).getByText('Task A')).toBeVisible()
  await expect(page.locator('[data-todo-id="a"]')).toBeFocused()
  await page.keyboard.press('Space')
  await expect(page.locator('[data-todo-id="a"]')).toHaveAttribute('data-done', 'true')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByLabel('Title')).toHaveValue('Task A')
  await app.close()
})

test('the editor saves changes', async () => {
  const dir = tempDir()
  seed(dir, [{ type: 'todo/add', id: 'a', title: 'Task A', date: day(1) }])
  const { app, page } = await launch(dir)
  await page.getByRole('button', { name: 'Edit Task A' }).click()
  await page.getByLabel('Title').fill('Task B')
  await page.getByLabel('Minutes').fill('90')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(region(page, day(1)).getByText('Task B')).toBeVisible()
  await expect(page.getByRole('dialog')).toBeHidden()
  await app.close()
})

test('the month view shows items and takes a drop', async () => {
  const dir = tempDir()
  seed(dir, [
    { type: 'todo/add', id: 'milk', title: 'Buy milk' },
    { type: 'event/add', id: 'e', title: 'Dentist', date: day(2), start: '14:30', minutes: 45 }
  ])
  const { app, page } = await launch(dir)
  await page.getByRole('button', { name: 'Month', exact: true }).click()
  await expect(region(page, day(2)).getByText('Dentist')).toBeVisible()
  await page.getByText('Buy milk').dragTo(region(page, day(4)))
  await expect(region(page, day(4)).getByText('Buy milk')).toBeVisible()
  await app.close()
})

test('undo restores a deleted todo', async () => {
  const dir = tempDir()
  seed(dir, [{ type: 'todo/add', id: 'a', title: 'Task A', date: day(1) }])
  const { app, page } = await launch(dir)
  await page.locator('[data-todo-id="a"]').focus()
  await page.keyboard.press('Backspace')
  await expect(region(page, day(1)).getByText('Task A')).toBeHidden()
  await page.keyboard.press('ControlOrMeta+z')
  await expect(region(page, day(1)).getByText('Task A')).toBeVisible()
  await app.close()
})

test('overdue todos can be moved to today', async () => {
  const dir = tempDir()
  seed(dir, [{ type: 'todo/add', id: 'a', title: 'Late task', date: '2020-01-01' }])
  const { app, page } = await launch(dir)
  await page.getByRole('button', { name: 'Move 1 overdue to today' }).click()
  await expect(region(page, today).getByText('Late task')).toBeVisible()
  await app.close()
})

test('a chosen theme applies and persists', async () => {
  const dir = tempDir()
  let { app, page } = await launch(dir)
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByLabel('One theme').check()
  await page.getByLabel('Terminal').check()
  const ground = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ground').trim())
  await expect.poll(ground).toBe('#000000')
  await app.close()
  ;({ app, page } = await launch(dir))
  await expect.poll(ground).toBe('#000000')
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('terminal')
  await app.close()
})

test('Claude Code can read and edit over MCP, live in the window', async () => {
  const dir = tempDir()
  const { app, page } = await launch(dir)
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByLabel('Let Claude Code read and edit this planner').check()
  await expect(page.getByText('Listening on this computer')).toBeVisible()
  const token = readFileSync(join(dir, 'mcp-token'), 'utf8').trim()
  expect(await page.content()).not.toContain(token)

  const saved = await app.evaluate(({ clipboard }) => clipboard.readText())
  await page.getByRole('button', { name: 'Copy command' }).click()
  expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toContain(`Bearer ${token}`)
  await app.evaluate(({ clipboard }, text) => clipboard.writeText(text), saved)
  await page.keyboard.press('Escape')

  const client = new Client({ name: 'e2e', version: '0' })
  const url = new URL('http://127.0.0.1:47613/mcp')
  await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers: { Authorization: `Bearer ${token}` } } }))
  await client.callTool({ name: 'add_todo', arguments: { title: 'From Claude', date: today } })
  await expect(region(page, today).getByText('From Claude')).toBeVisible()
  await page.keyboard.press('ControlOrMeta+z')
  await expect(page.getByText('From Claude')).toBeHidden()
  await client.close()

  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByLabel('Let Claude Code read and edit this planner').uncheck()
  await expect.poll(() => fetch(url, { method: 'POST' }).then(() => 'open', () => 'closed')).toBe('closed')
  await app.close()
})

test('a damaged data file is kept and the owner is told', async () => {
  const dir = tempDir()
  writeFileSync(join(dir, 'planner.json'), '{ broken')
  const { app, page } = await launch(dir)
  await expect(page.getByRole('status').getByText(/could not be read/)).toBeVisible()
  await app.close()
})

test('the page has no Node access and cannot leave the app', async () => {
  const { app, page } = await launch(tempDir())
  expect(await page.evaluate(() => typeof (window as unknown as { require: unknown }).require)).toBe('undefined')
  expect(await page.evaluate(() => typeof (window as unknown as { process: unknown }).process)).toBe('undefined')
  expect(await page.evaluate(() => window.open('https://example.com'))).toBeNull()
  const url = page.url()
  await page.evaluate(() => {
    location.href = 'https://example.com'
  })
  await page.waitForTimeout(300)
  expect(page.url()).toBe(url)
  await app.close()
})
