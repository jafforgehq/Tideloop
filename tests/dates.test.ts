import { describe, expect, it } from 'vitest'
import { addDays, isoWeek, isValidDate, longDay, monthGrid, startOfWeek, weekTitle } from '../src/shared/dates'

describe('addDays', () => {
  it('crosses a month end', () => expect(addDays('2026-10-31', 1)).toBe('2026-11-01'))
  it('crosses a year end', () => expect(addDays('2026-12-31', 1)).toBe('2027-01-01'))
  it('goes backwards', () => expect(addDays('2026-03-01', -1)).toBe('2026-02-28'))
  it('does not drift over European DST', () => expect(addDays('2026-03-28', 2)).toBe('2026-03-30'))
  it('does not drift over US DST', () => expect(addDays('2026-11-01', 1)).toBe('2026-11-02'))
})

describe('startOfWeek', () => {
  it('keeps a Monday', () => expect(startOfWeek('2026-11-02')).toBe('2026-11-02'))
  it('finds Monday from a Wednesday', () => expect(startOfWeek('2026-11-04')).toBe('2026-11-02'))
  it('treats Sunday as the end of the week', () => expect(startOfWeek('2026-11-08')).toBe('2026-11-02'))
})

describe('isoWeek', () => {
  it('numbers an ordinary week', () => expect(isoWeek('2026-11-02')).toBe(45))
  it('finds week 53 at the end of 2026', () => expect(isoWeek('2026-12-31')).toBe(53))
  it('keeps early January 2027 in week 53', () => expect(isoWeek('2027-01-03')).toBe(53))
  it('starts week 1 of 2027 on the first Monday', () => expect(isoWeek('2027-01-04')).toBe(1))
})

describe('monthGrid', () => {
  it('always gives six Monday-first weeks', () => {
    const grid = monthGrid(2026, 11)
    expect(grid).toHaveLength(42)
    expect(grid[0]).toEqual({ date: '2026-10-26', inMonth: false })
    expect(grid[6]).toEqual({ date: '2026-11-01', inMonth: true })
    expect(grid[41]).toEqual({ date: '2026-12-06', inMonth: false })
  })
  it('starts on the 1st when the month begins on a Monday', () => {
    expect(monthGrid(2027, 2)[0]).toEqual({ date: '2027-02-01', inMonth: true })
  })
})

describe('isValidDate', () => {
  it('accepts a real date', () => expect(isValidDate('2028-02-29')).toBe(true))
  it.each(['2026-02-30', '2026-13-01', '2026-1-1', 'soon', ''])('rejects %s', (v) => expect(isValidDate(v)).toBe(false))
})

describe('labels', () => {
  it('names a week inside one month', () => expect(weekTitle('2026-11-02')).toBe('Week 45, 2 to 8 November'))
  it('names a week across two months', () => expect(weekTitle('2026-11-30')).toBe('Week 49, 30 November to 6 December'))
  it('names a day', () => expect(longDay('2026-11-04')).toBe('Wednesday'))
})
