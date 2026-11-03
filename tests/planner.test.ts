import { describe, expect, it } from 'vitest'
import { emptyData, normalize, PlannerError, reduce } from '../src/shared/planner'
import type { PlannerData } from '../src/shared/types'

const base = () => {
  let d = emptyData()
  const list = d.lists[0].id
  for (const id of ['a', 'b', 'c']) d = reduce(d, { type: 'todo/add', id, title: id, listId: list, date: '2026-11-04' })
  return d
}
const order = (d: PlannerData, date: string | null) =>
  d.todos.filter((t) => t.date === date).sort((x, y) => x.order - y.order).map((t) => t.id)

describe('todos', () => {
  it('adds with defaults', () => {
    const d = reduce(emptyData(), { type: 'todo/add', id: 'x', title: '  Milk ' })
    expect(d.todos[0]).toMatchObject({ id: 'x', title: 'Milk', date: null, done: false, minutes: 30, notes: '' })
    expect(d.todos[0].listId).toBe(d.lists[0].id)
  })
  it('does not change the state it was given', () => {
    const d = emptyData()
    reduce(d, { type: 'todo/add', id: 'x', title: 'Milk' })
    expect(d.todos).toHaveLength(0)
  })
  it.each([
    ['an empty title', { title: '   ' }],
    ['an impossible date', { title: 'x', date: '2026-02-30' }],
    ['an unknown list', { title: 'x', listId: 'nope' }],
    ['too few minutes', { title: 'x', minutes: 0 }],
    ['a fractional estimate', { title: 'x', minutes: 1.5 }],
    ['too many minutes', { title: 'x', minutes: 1441 }]
  ])('rejects %s', (_, extra) => {
    expect(() => reduce(emptyData(), { type: 'todo/add', id: 'x', ...extra } as never)).toThrow(PlannerError)
  })
  it('moves to the end of another day by default', () => {
    let d = reduce(base(), { type: 'todo/add', id: 'z', title: 'z', date: '2026-11-05' })
    d = reduce(d, { type: 'todo/move', id: 'a', date: '2026-11-05' })
    expect(order(d, '2026-11-05')).toEqual(['z', 'a'])
    expect(order(d, '2026-11-04')).toEqual(['b', 'c'])
  })
  it('reorders inside a day, before a named todo', () => {
    const d = reduce(base(), { type: 'todo/move', id: 'c', date: '2026-11-04', beforeId: 'a' })
    expect(order(d, '2026-11-04')).toEqual(['c', 'a', 'b'])
  })
  it('moves down inside a day', () => {
    const d = reduce(base(), { type: 'todo/move', id: 'a', date: '2026-11-04', beforeId: 'c' })
    expect(order(d, '2026-11-04')).toEqual(['b', 'a', 'c'])
  })
  it('lands beside the named todo even with done todos in between', () => {
    let d = emptyData()
    for (const id of ['a', 'done', 'c', 'x']) d = reduce(d, { type: 'todo/add', id, title: id })
    d = reduce(d, { type: 'todo/toggle', id: 'done' })
    d = reduce(d, { type: 'todo/move', id: 'x', date: null, beforeId: 'c' })
    expect(order(d, null)).toEqual(['a', 'done', 'x', 'c'])
  })
  it('goes to the end when the named todo has gone', () => {
    const d = reduce(base(), { type: 'todo/move', id: 'a', date: '2026-11-04', beforeId: 'gone' })
    expect(order(d, '2026-11-04')).toEqual(['b', 'c', 'a'])
  })
  it('moves back to no date and can change list', () => {
    let d = reduce(base(), { type: 'list/add', id: 'l2', name: 'Other' })
    d = reduce(d, { type: 'todo/move', id: 'a', date: null, listId: 'l2' })
    expect(d.todos.find((t) => t.id === 'a')).toMatchObject({ date: null, listId: 'l2' })
  })
  it('toggles and deletes', () => {
    let d = reduce(base(), { type: 'todo/toggle', id: 'a' })
    expect(d.todos.find((t) => t.id === 'a')?.done).toBe(true)
    d = reduce(d, { type: 'todo/delete', id: 'a' })
    expect(d.todos.map((t) => t.id)).toEqual(['b', 'c'])
  })
  it('updates fields with the same rules as add', () => {
    const d = reduce(base(), { type: 'todo/update', id: 'a', patch: { title: 'New', minutes: 45, notes: 'n' } })
    expect(d.todos.find((t) => t.id === 'a')).toMatchObject({ title: 'New', minutes: 45, notes: 'n' })
    expect(() => reduce(base(), { type: 'todo/update', id: 'a', patch: { title: ' ' } })).toThrow(PlannerError)
    expect(() => reduce(base(), { type: 'todo/update', id: 'a', patch: { date: 'soon' } })).toThrow(PlannerError)
  })
  it('rejects an unknown id', () => {
    expect(() => reduce(base(), { type: 'todo/toggle', id: 'nope' })).toThrow(PlannerError)
  })
  it('rolls undone past todos to today, keeping done and future ones', () => {
    let d = reduce(base(), { type: 'todo/toggle', id: 'a' })
    d = reduce(d, { type: 'todo/add', id: 'future', title: 'f', date: '2026-11-09' })
    d = reduce(d, { type: 'todo/add', id: 'now', title: 'n', date: '2026-11-06' })
    d = reduce(d, { type: 'todo/rollover', today: '2026-11-06' })
    expect(order(d, '2026-11-06')).toEqual(['now', 'b', 'c'])
    expect(order(d, '2026-11-04')).toEqual(['a'])
    expect(order(d, '2026-11-09')).toEqual(['future'])
  })
})

describe('events', () => {
  const ev = { type: 'event/add', id: 'e', title: 'Dentist', date: '2026-11-04', start: '14:30', minutes: 45 } as const
  it('adds, updates and deletes', () => {
    let d = reduce(emptyData(), ev)
    expect(d.events[0]).toMatchObject({ title: 'Dentist', start: '14:30', minutes: 45, notes: '' })
    d = reduce(d, { type: 'event/update', id: 'e', patch: { start: '09:05' } })
    expect(d.events[0].start).toBe('09:05')
    d = reduce(d, { type: 'event/delete', id: 'e' })
    expect(d.events).toHaveLength(0)
  })
  it.each([['25:00'], ['9:30'], ['noon']])('rejects the start time %s', (start) => {
    expect(() => reduce(emptyData(), { ...ev, start })).toThrow(PlannerError)
  })
  it('requires a real date', () => {
    expect(() => reduce(emptyData(), { ...ev, date: '2026-02-30' })).toThrow(PlannerError)
  })
})

describe('lists', () => {
  it('adds and renames', () => {
    let d = reduce(emptyData(), { type: 'list/add', id: 'l2', name: 'Side project' })
    d = reduce(d, { type: 'list/update', id: 'l2', patch: { name: 'Side' } })
    expect(d.lists.at(-1)).toMatchObject({ id: 'l2', name: 'Side' })
  })
  it('moves todos to another list when one is deleted', () => {
    let d = reduce(base(), { type: 'list/add', id: 'l2', name: 'Other' })
    d = reduce(d, { type: 'todo/add', id: 'x', title: 'x', listId: 'l2' })
    d = reduce(d, { type: 'list/delete', id: 'l2' })
    expect(d.todos.find((t) => t.id === 'x')?.listId).toBe(d.lists[0].id)
  })
  it('never deletes the last list', () => {
    let d = emptyData()
    while (d.lists.length > 1) d = reduce(d, { type: 'list/delete', id: d.lists[0].id })
    expect(() => reduce(d, { type: 'list/delete', id: d.lists[0].id })).toThrow(PlannerError)
  })
  it('rejects an empty name', () => {
    expect(() => reduce(emptyData(), { type: 'list/add', id: 'l', name: ' ' })).toThrow(PlannerError)
  })
})

describe('settings', () => {
  it('merges a patch', () => {
    const d = reduce(emptyData(), { type: 'settings/update', patch: { fullDayHours: 6 } })
    expect(d.settings.fullDayHours).toBe(6)
    expect(d.settings.autoUpdate).toBe(true)
  })
  it('keeps MCP off until asked', () => expect(emptyData().settings.mcpEnabled).toBe(false))
  it('rejects a full day outside 1 to 24 hours', () => {
    expect(() => reduce(emptyData(), { type: 'settings/update', patch: { fullDayHours: 0 } })).toThrow(PlannerError)
  })
})

describe('normalize', () => {
  it('round-trips valid data', () => {
    const d = base()
    expect(normalize(JSON.parse(JSON.stringify(d)))).toEqual(d)
  })
  it('fills settings added in later versions', () => {
    const raw = JSON.parse(JSON.stringify(base()))
    delete raw.settings.autoUpdate
    expect(normalize(raw).settings.autoUpdate).toBe(true)
  })
  it.each([[null], [[]], ['x'], [{ version: 1 }]])('rejects %j', (raw) => {
    expect(() => normalize(raw)).toThrow(PlannerError)
  })
  it('offers the tutorial to someone new', () => {
    const raw = JSON.parse(JSON.stringify(emptyData()))
    delete raw.settings.tutorialDone
    expect(normalize(raw).settings.tutorialDone).toBe(false)
  })
  it('does not offer the tutorial to someone who already has plans', () => {
    const raw = JSON.parse(JSON.stringify(base()))
    delete raw.settings.tutorialDone
    expect(normalize(raw).settings.tutorialDone).toBe(true)
  })
  it('rejects a newer file version', () => {
    expect(() => normalize({ ...base(), version: 2 })).toThrow(/newer/)
  })
  it('rejects a todo with a broken date', () => {
    const raw = JSON.parse(JSON.stringify(base()))
    raw.todos[0].date = 'soon'
    expect(() => normalize(raw)).toThrow(PlannerError)
  })
})
