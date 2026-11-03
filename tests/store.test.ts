import { describe, expect, it, vi } from 'vitest'
import { createStore } from '../src/main/store'
import { emptyData, PlannerError } from '../src/shared/planner'

const make = () => {
  const save = vi.fn()
  const onSaveError = vi.fn()
  return { save, onSaveError, store: createStore({ data: emptyData(), save, onSaveError }) }
}
const add = (id: string) => ({ type: 'todo/add', id, title: id }) as const

describe('store', () => {
  it('applies an action, saves it and tells subscribers', () => {
    const { store, save } = make()
    const seen = vi.fn()
    store.subscribe(seen)
    store.dispatch(add('a'))
    expect(store.getState().todos).toHaveLength(1)
    expect(save).toHaveBeenCalledWith(store.getState())
    expect(seen).toHaveBeenCalledTimes(1)
  })
  it('leaves state alone and saves nothing on a bad action', () => {
    const { store, save } = make()
    expect(() => store.dispatch({ type: 'todo/toggle', id: 'nope' })).toThrow(PlannerError)
    expect(store.getState().todos).toHaveLength(0)
    expect(save).not.toHaveBeenCalled()
  })
  it('stops notifying after unsubscribe', () => {
    const { store } = make()
    const seen = vi.fn()
    store.subscribe(seen)()
    store.dispatch(add('a'))
    expect(seen).not.toHaveBeenCalled()
  })
  it('undoes and redoes', () => {
    const { store, save } = make()
    store.dispatch(add('a'))
    store.undo()
    expect(store.getState().todos).toHaveLength(0)
    expect(save).toHaveBeenLastCalledWith(store.getState())
    store.redo()
    expect(store.getState().todos).toHaveLength(1)
  })
  it('does nothing when there is nothing to undo or redo', () => {
    const { store, save } = make()
    store.undo()
    store.redo()
    expect(save).not.toHaveBeenCalled()
  })
  it('clears redo after a new action', () => {
    const { store } = make()
    store.dispatch(add('a'))
    store.undo()
    store.dispatch(add('b'))
    store.redo()
    expect(store.getState().todos.map((t) => t.id)).toEqual(['b'])
  })
  it('does not put settings in the undo history', () => {
    const { store } = make()
    store.dispatch(add('a'))
    store.dispatch({ type: 'settings/update', patch: { fullDayHours: 6 } })
    store.undo()
    expect(store.getState().todos).toHaveLength(0)
    expect(store.getState().settings.fullDayHours).toBe(6)
    store.redo()
    expect(store.getState().todos).toHaveLength(1)
    expect(store.getState().settings.fullDayHours).toBe(6)
  })
  it('keeps the newest 100 undo steps', () => {
    const { store } = make()
    for (let i = 0; i < 105; i++) store.dispatch(add(`t${i}`))
    for (let i = 0; i < 200; i++) store.undo()
    expect(store.getState().todos).toHaveLength(5)
  })
  it('keeps working in memory when a save fails, and reports it', () => {
    const { store, save, onSaveError } = make()
    save.mockImplementation(() => {
      throw new Error('disk full')
    })
    store.dispatch(add('a'))
    expect(store.getState().todos).toHaveLength(1)
    expect(onSaveError).toHaveBeenCalledWith(expect.objectContaining({ message: 'disk full' }))
  })
  it('ignores an action that changes nothing: no save, no history', () => {
    const { store, save } = make()
    store.dispatch(add('a'))
    save.mockClear()
    store.dispatch({ type: 'todo/rollover', today: '2026-11-04' })
    expect(save).not.toHaveBeenCalled()
    store.undo()
    expect(store.getState().todos).toHaveLength(0)
  })

})
