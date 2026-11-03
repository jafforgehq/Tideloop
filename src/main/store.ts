import { reduce } from '../shared/planner'
import type { Action, PlannerData } from '../shared/types'

const HISTORY_LIMIT = 100

export interface StoreOptions {
  data: PlannerData
  save: (data: PlannerData) => void
  onSaveError?: (error: Error) => void
}

export type Store = ReturnType<typeof createStore>

/** The one owner of planner state. The window and MCP clients both change it through here. */
export function createStore({ data, save, onSaveError }: StoreOptions) {
  let state = data
  const past: PlannerData[] = []
  const future: PlannerData[] = []
  const subscribers = new Set<(state: PlannerData) => void>()

  const commit = (next: PlannerData) => {
    state = next
    try {
      save(state)
    } catch (error) {
      // State stays good in memory and the next change retries the whole file.
      onSaveError?.(error as Error)
    }
    subscribers.forEach((fn) => fn(state))
  }

  return {
    getState: () => state,
    subscribe(fn: (state: PlannerData) => void) {
      subscribers.add(fn)
      return () => void subscribers.delete(fn)
    },
    dispatch(action: Action) {
      const next = reduce(state, action)
      if (next === state) return
      if (action.type !== 'settings/update') {
        past.push(state)
        if (past.length > HISTORY_LIMIT) past.shift()
        future.length = 0
      }
      commit(next)
    },
    undo() {
      const previous = past.pop()
      if (!previous) return
      future.push(state)
      commit({ ...previous, settings: state.settings })
    },
    redo() {
      const next = future.pop()
      if (!next) return
      past.push(state)
      commit({ ...next, settings: state.settings })
    }
  }
}
