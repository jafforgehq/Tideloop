import { describe, expect, it } from 'vitest'
import { parseQuickAdd } from '../src/shared/quickAdd'

const TODAY = '2026-11-04' // a Wednesday
const p = (s: string) => parseQuickAdd(s, TODAY)

describe('parseQuickAdd', () => {
  it('makes a plain todo', () => expect(p('Buy milk')).toEqual({ kind: 'todo', title: 'Buy milk' }))
  it('makes an event from a 24 hour time and duration', () =>
    expect(p('Dentist 14:30 45m')).toEqual({ kind: 'event', title: 'Dentist', start: '14:30', minutes: 45 }))
  it('reads am and pm', () => {
    expect(p('Call 2pm').start).toBe('14:00')
    expect(p('2:30pm Call').start).toBe('14:30')
    expect(p('Lunch 12pm').start).toBe('12:00')
    expect(p('Flight 12am').start).toBe('00:00')
  })
  it('reads durations on todos', () => {
    expect(p('Report 1h')).toEqual({ kind: 'todo', title: 'Report', minutes: 60 })
    expect(p('Report 1h30').minutes).toBe(90)
    expect(p('Report 1.5h').minutes).toBe(90)
  })
  it('leaves numbers that are not times alone', () => {
    expect(p('Run 5 km').title).toBe('Run 5 km')
    expect(p('Ship build 0.4 to testers').title).toBe('Ship build 0.4 to testers')
    expect(p('Fix 25:00 bug')).toEqual({ kind: 'todo', title: 'Fix 25:00 bug' })
  })
  it('reads day words at the start or end', () => {
    expect(p('Pay rent tomorrow')).toEqual({ kind: 'todo', title: 'Pay rent', date: '2026-11-05' })
    expect(p('today Water plants').date).toBe(TODAY)
    expect(p('Standup friday 9:00').date).toBe('2026-11-06')
    expect(p('Friday standup 9:00').date).toBe('2026-11-06')
    expect(p('Review today notes').date).toBeUndefined()
  })
  it('takes short day names only at the end', () => {
    expect(p('Pay rent fri').date).toBe('2026-11-06')
    expect(p('Buy sun cream').date).toBeUndefined()
    expect(p('Sat nav fix').title).toBe('Sat nav fix')
  })
  it('reads the same weekday as today and an earlier one as next week', () => {
    expect(p('Gym wed').date).toBe(TODAY)
    expect(p('Gym mon').date).toBe('2026-11-09')
  })
  it('reads a list tag', () => expect(p('#work Draft plan')).toEqual({ kind: 'todo', title: 'Draft plan', listName: 'work' }))
  it('keeps the words when nothing else would remain', () => expect(p('tomorrow')).toEqual({ kind: 'todo', title: 'tomorrow' }))
  it('trims whitespace', () => expect(p('  Buy   milk ').title).toBe('Buy milk'))
})
