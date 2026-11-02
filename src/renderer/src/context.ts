import { createContext, useContext, type DragEvent } from 'react'
import { dayLabel } from '../../shared/dates'
import { parseQuickAdd } from '../../shared/quickAdd'
import type { Action, ISODate, PlannerData } from '../../shared/types'

export const api = window.tideloop

export type EditTarget =
  | { kind: 'todo'; id: string }
  | { kind: 'event'; id: string }
  | { kind: 'new-event'; date: ISODate }
  | { kind: 'list'; id: string | null }

export interface AppContext {
  data: PlannerData
  today: ISODate
  dispatch: (action: Action, quiet?: boolean) => Promise<string | null>
  edit: (target: EditTarget) => void
  toast: (message: string, options?: { undo?: boolean; sticky?: boolean }) => void
  announce: (message: string) => void
  /** Focuses this todo or event after the next render, so keyboard moves keep their place. */
  focusAfterRender: (id: string) => void
  goTo: (date: ISODate, view?: 'week' | 'month') => void
  over: { key: string; index: number } | null
  setOver: (over: { key: string; index: number } | null) => void
  draggingId: string | null
  setDraggingId: (id: string | null) => void
}

export const Context = createContext<AppContext | null>(null)
export const useApp = () => useContext(Context)!

export const TODO_TYPE = 'application/x-tideloop-todo'
export const EVENT_TYPE = 'application/x-tideloop-event'
export const newId = () => crypto.randomUUID()

/** Adds from free text. Returns false only when the text was empty or refused. */
export async function addFromText(app: AppContext, text: string, defaultDate: ISODate | null): Promise<boolean> {
  if (!text.trim()) return false
  const parsed = parseQuickAdd(text, app.today)
  const wanted = parsed.listName?.toLowerCase()
  const list = wanted ? app.data.lists.find((l) => l.name.toLowerCase() === wanted) : undefined
  if (wanted && !list) app.toast(`No list named ${parsed.listName}, so it went to ${app.data.lists[0].name}.`)
  const date = parsed.date ?? defaultDate
  const error =
    parsed.kind === 'event'
      ? await app.dispatch({ type: 'event/add', id: newId(), title: parsed.title, date: date ?? app.today, start: parsed.start!, minutes: parsed.minutes })
      : await app.dispatch({ type: 'todo/add', id: newId(), title: parsed.title, date, listId: list?.id, minutes: parsed.minutes })
  // From the New todo field an item can land outside the lists, so say where it went.
  const placed = parsed.kind === 'event' ? (date ?? app.today) : date
  if (error === null && defaultDate === null && placed) app.toast(`Added to ${dayLabel(placed)}`, { undo: true })
  return error === null
}

/** Finds where a drop lands among a zone's cards. The dragged card and a list's folded done cards do not count. */
function dropTarget(zone: HTMLElement, y: number, draggingId: string | null): { index: number; beforeId?: string } {
  const cards = [...zone.querySelectorAll<HTMLElement>('[data-todo-id]')].filter((c) => c.dataset.todoId !== draggingId && !c.closest('.done'))
  const next = cards.findIndex((c) => {
    const box = c.getBoundingClientRect()
    return y < box.top + box.height / 2
  })
  return next < 0 ? { index: cards.length } : { index: next, beforeId: cards[next].dataset.todoId }
}

/** Drop behaviour for a day or a list. */
export function useDropZone(key: string, target: { date: ISODate | null; listId?: string }, options: { ordered?: boolean } = {}) {
  const app = useApp()
  const ordered = options.ordered ?? true
  const accepts = (e: DragEvent) => e.dataTransfer.types.includes(TODO_TYPE) || (target.date !== null && e.dataTransfer.types.includes(EVENT_TYPE))
  return {
    active: app.over?.key === key,
    index: app.over?.key === key ? app.over.index : null,
    props: {
      onDragOver(e: DragEvent<HTMLElement>) {
        if (!accepts(e)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        const index = ordered && e.dataTransfer.types.includes(TODO_TYPE) ? dropTarget(e.currentTarget, e.clientY, app.draggingId).index : -1
        if (app.over?.key !== key || app.over.index !== index) app.setOver({ key, index })
      },
      onDragLeave(e: DragEvent<HTMLElement>) {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null) && app.over?.key === key) app.setOver(null)
      },
      onDrop(e: DragEvent<HTMLElement>) {
        e.preventDefault()
        const todo = e.dataTransfer.getData(TODO_TYPE)
        const event = e.dataTransfer.getData(EVENT_TYPE)
        const beforeId = ordered ? dropTarget(e.currentTarget, e.clientY, todo || null).beforeId : undefined
        app.setOver(null)
        app.setDraggingId(null)
        if (todo) void app.dispatch({ type: 'todo/move', id: todo, date: target.date, listId: target.listId, beforeId })
        else if (event && target.date) void app.dispatch({ type: 'event/update', id: event, patch: { date: target.date } })
      }
    }
  }
}
