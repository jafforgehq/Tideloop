import type { PlannerData } from './types'

export type TutorialStepId = 'add-todo' | 'drag-to-day' | 'read-tide' | 'tick-off' | 'add-event' | 'month' | 'finish'

export interface TutorialState {
  step: TutorialStepId
  /** Ids that existed before the current step, so only what the person just made counts. */
  knownTodos: string[]
  knownEvents: string[]
  todoId: string | null
  note: 'made-event' | null
}

const ids = (items: { id: string }[]) => items.map((x) => x.id)

export const startTutorial = (data: PlannerData): TutorialState => ({
  step: 'add-todo',
  knownTodos: ids(data.todos),
  knownEvents: ids(data.events),
  todoId: null,
  note: null
})

/** Moves on when the person has done what the step asks. Returns the same object when nothing changed. */
export function advanceTutorial(state: TutorialState, data: PlannerData, view: 'week' | 'month'): TutorialState {
  const todo = data.todos.find((t) => t.id === state.todoId)
  switch (state.step) {
    case 'add-todo': {
      const added = data.todos.find((t) => !state.knownTodos.includes(t.id))
      if (added) return { ...state, step: added.date ? 'read-tide' : 'drag-to-day', todoId: added.id, note: null }
      if (data.events.some((e) => !state.knownEvents.includes(e.id))) return { ...state, knownEvents: ids(data.events), note: 'made-event' }
      return state
    }
    case 'drag-to-day':
      if (!todo) return startTutorial(data)
      return todo.date ? { ...state, step: 'read-tide' } : state
    case 'tick-off':
      return !todo || todo.done ? { ...state, step: 'add-event', knownEvents: ids(data.events) } : state
    case 'add-event':
      return data.events.some((e) => !state.knownEvents.includes(e.id)) ? { ...state, step: 'month' } : state
    case 'month':
      return view === 'month' ? { ...state, step: 'finish' } : state
    default:
      return state
  }
}

/** For the steps that move on from a button rather than an action. */
export function nextTutorialStep(state: TutorialState): TutorialState {
  if (state.step === 'read-tide') return { ...state, step: 'tick-off' }
  if (state.step === 'add-event') return { ...state, step: 'month' }
  return state
}
