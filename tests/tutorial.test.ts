import { describe, expect, it } from 'vitest'
import { emptyData, reduce } from '../src/shared/planner'
import { advanceTutorial, nextTutorialStep, startTutorial, type TutorialState } from '../src/shared/tutorial'
import type { Action, PlannerData } from '../src/shared/types'

const apply = (d: PlannerData, ...actions: Action[]) => actions.reduce(reduce, d)
const todo = (id: string, date: string | null = null): Action => ({ type: 'todo/add', id, title: id, date })
const event = (id: string): Action => ({ type: 'event/add', id, title: id, date: '2026-11-04', start: '14:30' })

/** Runs a planner through the steps up to the one named. */
function at(step: TutorialState['step']): { state: TutorialState; data: PlannerData } {
  let data = emptyData()
  let state = startTutorial(data)
  const go = (next: PlannerData) => {
    data = next
    state = advanceTutorial(state, data, 'week')
  }
  if (step === 'add-todo') return { state, data }
  go(apply(data, todo('a')))
  if (step === 'drag-to-day') return { state, data }
  go(apply(data, { type: 'todo/move', id: 'a', date: '2026-11-05' }))
  if (step === 'read-tide') return { state, data }
  state = nextTutorialStep(state)
  if (step === 'tick-off') return { state, data }
  go(apply(data, { type: 'todo/toggle', id: 'a' }))
  if (step === 'add-event') return { state, data }
  go(apply(data, event('e')))
  return { state, data }
}

describe('first step', () => {
  it('starts by asking for a todo', () => {
    expect(startTutorial(emptyData()).step).toBe('add-todo')
  })
  it('moves on when a todo with no date is added, and remembers it', () => {
    const { state } = at('drag-to-day')
    expect(state).toMatchObject({ step: 'drag-to-day', todoId: 'a' })
  })
  it('explains and stays when text with a time made an event instead', () => {
    const data = emptyData()
    const state = advanceTutorial(startTutorial(data), apply(data, event('e')), 'week')
    expect(state).toMatchObject({ step: 'add-todo', note: 'made-event' })
  })
  it('skips the drag when the new todo already has a day', () => {
    const data = emptyData()
    const state = advanceTutorial(startTutorial(data), apply(data, todo('a', '2026-11-05')), 'week')
    expect(state).toMatchObject({ step: 'read-tide', todoId: 'a' })
  })
  it('ignores todos that existed before it started', () => {
    const data = apply(emptyData(), todo('old'))
    const state = startTutorial(data)
    expect(advanceTutorial(state, data, 'week')).toBe(state)
  })
})

describe('later steps', () => {
  it('moves on when the todo gets a day', () => {
    expect(at('read-tide').state.step).toBe('read-tide')
  })
  it('goes back to the start if the todo is deleted during the drag step', () => {
    const { state, data } = at('drag-to-day')
    const next = advanceTutorial(state, apply(data, { type: 'todo/delete', id: 'a' }), 'week')
    expect(next).toMatchObject({ step: 'add-todo', todoId: null })
  })
  it('waits on the tide step until asked', () => {
    const { state, data } = at('read-tide')
    expect(advanceTutorial(state, data, 'week')).toBe(state)
    expect(nextTutorialStep(state).step).toBe('tick-off')
  })
  it('moves on when the todo is ticked', () => {
    expect(at('add-event').state.step).toBe('add-event')
  })
  it('does not get stuck if the todo is deleted before it is ticked', () => {
    const { state, data } = at('tick-off')
    expect(advanceTutorial(state, apply(data, { type: 'todo/delete', id: 'a' }), 'week').step).toBe('add-event')
  })
  it('moves on when an event is added, and allows skipping that step', () => {
    expect(at('month').state.step).toBe('month')
    expect(nextTutorialStep(at('add-event').state).step).toBe('month')
  })
  it('finishes when the month view opens', () => {
    const { state, data } = at('month')
    expect(advanceTutorial(state, data, 'week')).toBe(state)
    expect(advanceTutorial(state, data, 'month').step).toBe('finish')
  })
})
