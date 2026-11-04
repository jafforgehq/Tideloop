import { describe, expect, it } from 'vitest'
import { emptyData, reduce } from '../src/shared/planner'
import { monthRange, review, reviewFinding } from '../src/shared/review'
import type { PlannerData } from '../src/shared/types'

const build = (): PlannerData => {
  let d = emptyData()
  const add = (id: string, listId: string, date: string | null, minutes: number, done: boolean) => {
    d = reduce(d, { type: 'todo/add', id, title: id, listId, date, minutes })
    if (done) d = reduce(d, { type: 'todo/toggle', id })
  }
  add('w1', 'work', '2026-11-02', 120, true)
  add('w2', 'work', '2026-11-03', 60, true)
  add('w3', 'work', '2026-11-04', 90, false)
  add('h1', 'home', '2026-11-05', 30, true)
  add('old', 'home', '2026-10-30', 500, true)
  add('later', 'work', '2026-11-09', 500, true)
  add('loose', 'home', null, 45, true)
  d = reduce(d, { type: 'event/add', id: 'e', title: 'Sync', date: '2026-11-03', start: '10:00', minutes: 45 })
  d = reduce(d, { type: 'event/add', id: 'far', title: 'Far', date: '2026-12-03', start: '10:00', minutes: 45 })
  return d
}

describe('review', () => {
  const r = review(build(), '2026-11-02', '2026-11-08')
  it('counts only todos dated inside the range', () => {
    expect(r.planned).toEqual({ count: 4, minutes: 300 })
    expect(r.done).toEqual({ count: 3, minutes: 210 })
  })
  it('adds event time inside the range', () => expect(r.events).toBe(45))
  it('ranks lists by done minutes', () => {
    expect(r.rows.map((x) => [x.name, x.done, x.total, x.minutes])).toEqual([['Work', 2, 3, 180], ['Home', 1, 1, 30]])
  })
  it('lists the longest done todos first, at most five', () => expect(r.top.map((t) => t.id)).toEqual(['w1', 'w2', 'h1']))
  it('keeps a list that has only open todos', () => {
    const only = review(build(), '2026-11-04', '2026-11-04')
    expect(only.rows).toEqual([expect.objectContaining({ name: 'Work', done: 0, total: 1, minutes: 0 })])
  })
  it('is empty for a quiet range', () => {
    const quiet = review(build(), '2027-01-01', '2027-01-07')
    expect(quiet).toMatchObject({ planned: { count: 0, minutes: 0 }, done: { count: 0, minutes: 0 }, events: 0, rows: [], top: [] })
  })
})

describe('monthRange', () => {
  it('spans the first to the last day', () => expect(monthRange(2026, 11)).toEqual(['2026-11-01', '2026-11-30']))
  it('handles a leap February', () => expect(monthRange(2028, 2)).toEqual(['2028-02-01', '2028-02-29']))
})

describe('reviewFinding', () => {
  it('names the list that took most of the done time', () => {
    expect(reviewFinding(review(build(), '2026-11-02', '2026-11-08'))).toBe('Most focus went to Work: 3h across 2 todos, 86% of the time you finished.')
  })
  it('says so when nothing is done', () => {
    expect(reviewFinding(review(build(), '2027-01-01', '2027-01-07'))).toBe('Nothing finished in this period yet.')
  })
})
