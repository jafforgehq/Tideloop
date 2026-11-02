import { describe, expect, it } from 'vitest'
import { emptyData, reduce } from '../src/shared/planner'
import { dayLoad, formatMinutes, monthFinding, overdueCount, tidePath, weekFinding, weekSummary } from '../src/shared/tide'

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

describe('formatMinutes', () => {
  it.each([[0, '0m'], [45, '45m'], [60, '1h'], [135, '2h 15m']])('%i is %s', (m, text) => expect(formatMinutes(m)).toBe(text))
})

describe('weekFinding', () => {
  it('invites a first move in an empty week', () => {
    expect(weekFinding(emptyData(), '2026-11-02')).toBe('Nothing booked yet. Drag a todo onto a day.')
  })
  it('names high and low water', () => {
    expect(weekFinding(seeded(), '2026-11-02')).toBe('High tide is Wednesday at 2h 15m. Low water is Monday at 0m.')
  })
  it('leads with a day over the full day limit', () => {
    let d = seeded()
    d = reduce(d, { type: 'todo/add', id: 'big', title: 'Big', date: '2026-11-05', minutes: 480 })
    expect(weekFinding(d, '2026-11-02')).toBe('Thursday is 30m over a full day. Low water is Monday at 0m.')
  })
})

describe('monthFinding', () => {
  it('names the busiest day of the month', () => {
    expect(monthFinding(seeded(), 2026, 11)).toBe('Busiest day is Wednesday 4 November at 2h 15m.')
  })
  it('says when a month is empty', () => expect(monthFinding(emptyData(), 2026, 11)).toBe('Nothing booked this month.'))
})

describe('overdueCount', () => {
  it('counts unfinished todos on past days', () => {
    expect(overdueCount(seeded(), '2026-11-05')).toBe(1)
    expect(overdueCount(seeded(), '2026-11-04')).toBe(0)
  })
})
