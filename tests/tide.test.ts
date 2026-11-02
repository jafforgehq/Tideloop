import { describe, expect, it } from 'vitest'
import { emptyData, reduce } from '../src/shared/planner'
import { dayLoad, tidePath, weekSummary } from '../src/shared/tide'

const seeded = () => {
  let d = emptyData()
  const list = d.lists[0].id
  d = reduce(d, { type: 'todo/add', id: 'a', title: 'A', listId: list, date: '2026-11-04' })
  d = reduce(d, { type: 'todo/add', id: 'b', title: 'B', listId: list, date: '2026-11-04', minutes: 60 })
  d = reduce(d, { type: 'todo/toggle', id: 'b' })
  d = reduce(d, { type: 'todo/add', id: 'c', title: 'C', listId: list, date: '2026-11-05' })
  d = reduce(d, { type: 'event/add', id: 'e', title: 'Dentist', date: '2026-11-04', start: '14:30', minutes: 45 })
  return d
}

describe('dayLoad', () => {
  it('adds events and todos, done ones included', () => expect(dayLoad(seeded(), '2026-11-04')).toBe(135))
  it('is zero for an empty day', () => expect(dayLoad(seeded(), '2026-11-06')).toBe(0))
})

describe('tidePath', () => {
  const commands = (d: string) => d.replace(/[^A-Za-z]/g, '')
  it('keeps one command shape for any load, so the curve can animate', () => {
    const a = tidePath([0, 0, 0, 0, 0, 0, 0], 700, 110, 480)
    const b = tidePath([480, 30, 900, 10, 0, 60, 120], 700, 110, 480)
    expect(commands(a)).toBe(commands(b))
  })
  it('closes along the bottom edge', () => {
    expect(tidePath([0, 0, 0, 0, 0, 0, 0], 700, 110, 480).endsWith('L700 110 Z')).toBe(true)
  })
  it('rises with load and clamps above a full day', () => {
    const y = (m: number) => Number(tidePath([m, m, m, m, m, m, m], 700, 110, 480).split(' ')[3])
    expect(y(480)).toBeLessThan(y(60))
    expect(y(2000)).toBe(y(480))
    expect(y(480)).toBeGreaterThanOrEqual(0)
  })
})

describe('weekSummary', () => {
  it('names the high and low water days', () => {
    const s = weekSummary(seeded(), '2026-11-02')
    expect(s.loads).toEqual([0, 0, 135, 30, 0, 0, 0])
    expect(s.high).toBe('2026-11-04')
    expect(s.low).toBe('2026-11-02')
  })
  it('has no high water in an empty week', () => {
    expect(weekSummary(emptyData(), '2026-11-02').high).toBeNull()
  })
})
