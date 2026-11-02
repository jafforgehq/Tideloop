import type { DragEvent, KeyboardEvent } from 'react'
import { addDays, dayLabel } from '../../shared/dates'
import { formatMinutes } from '../../shared/tide'
import type { CalEvent, Todo } from '../../shared/types'
import { EVENT_TYPE, TODO_TYPE, useApp, type AppContext } from './context'

export const listColor = (app: AppContext, listId: string) => {
  const list = app.data.lists.find((l) => l.id === listId)
  return `var(--list-${(list?.color ?? 0) % 6})`
}

function dragHandlers(app: AppContext, type: string, id: string) {
  return {
    draggable: true,
    onDragStart(e: DragEvent) {
      e.dataTransfer.setData(type, id)
      e.dataTransfer.effectAllowed = 'move'
      // Changing the dragged element during dragstart can cancel the drag in Chromium.
      setTimeout(() => app.setDraggingId(id), 0)
    },
    onDragEnd() {
      app.setDraggingId(null)
      app.setOver(null)
    }
  }
}

function todoKeys(app: AppContext, todo: Todo) {
  return (e: KeyboardEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return
    const move = (date: string | null) => {
      app.focusAfterRender(todo.id)
      void app.dispatch({ type: 'todo/move', id: todo.id, date })
      app.announce(date ? `Moved ${todo.title} to ${dayLabel(date)}` : `Moved ${todo.title} to its list`)
    }
    if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault()
      const step = e.key === 'ArrowLeft' ? -1 : 1
      if (todo.date) move(addDays(todo.date, step))
      else if (step === 1) move(app.today)
    } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault()
      // A list folds its done todos away, so reordering steps over them.
      const visible = app.data.todos
        .filter((t) => t.date === todo.date && (todo.date !== null || (t.listId === todo.listId && t.done === todo.done)))
        .sort((a, b) => a.order - b.order)
      const at = visible.findIndex((t) => t.id === todo.id)
      const up = e.key === 'ArrowUp'
      if (up ? at > 0 : at < visible.length - 1) {
        app.focusAfterRender(todo.id)
        void app.dispatch({ type: 'todo/move', id: todo.id, date: todo.date, beforeId: up ? visible[at - 1].id : visible[at + 2]?.id })
      }
    } else if (e.key === ' ') {
      e.preventDefault()
      void app.dispatch({ type: 'todo/toggle', id: todo.id })
    } else if (e.key === 'Enter') {
      e.preventDefault()
      app.edit({ kind: 'todo', id: todo.id })
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      void app.dispatch({ type: 'todo/delete', id: todo.id })
      app.toast(`Deleted ${todo.title}`, { undo: true })
    }
  }
}

export function TodoCard({ todo, dropBefore = false, showCheck = true }: { todo: Todo; dropBefore?: boolean; showCheck?: boolean }) {
  const app = useApp()
  return (
    <li
      className="card todo"
      data-todo-id={todo.id}
      data-done={todo.done}
      data-dragging={app.draggingId === todo.id}
      data-drop-before={dropBefore || undefined}
      tabIndex={0}
      onKeyDown={todoKeys(app, todo)}
      {...dragHandlers(app, TODO_TYPE, todo.id)}
    >
      {showCheck && (
        <button
          className="check"
          aria-label={todo.done ? `Mark ${todo.title} not done` : `Mark ${todo.title} done`}
          aria-pressed={todo.done}
          style={{ '--dot': listColor(app, todo.listId) } as React.CSSProperties}
          onClick={() => void app.dispatch({ type: 'todo/toggle', id: todo.id })}
        >
          <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.5 5 9l4.5-5.5" /></svg>
        </button>
      )}
      <button className="title" aria-label={`Edit ${todo.title}`} onClick={() => app.edit({ kind: 'todo', id: todo.id })}>
        {todo.title}
        {todo.minutes !== 30 && <span className="estimate"> {formatMinutes(todo.minutes)}</span>}
      </button>
    </li>
  )
}

export function EventCard({ event }: { event: CalEvent }) {
  const app = useApp()
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return
    if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault()
      const date = addDays(event.date, e.key === 'ArrowLeft' ? -1 : 1)
      app.focusAfterRender(event.id)
      void app.dispatch({ type: 'event/update', id: event.id, patch: { date } })
      app.announce(`Moved ${event.title} to ${dayLabel(date)}`)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      app.edit({ kind: 'event', id: event.id })
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      void app.dispatch({ type: 'event/delete', id: event.id })
      app.toast(`Deleted ${event.title}`, { undo: true })
    }
  }
  return (
    <li className="card event" data-event-id={event.id} data-dragging={app.draggingId === event.id} tabIndex={0} onKeyDown={onKeyDown} {...dragHandlers(app, EVENT_TYPE, event.id)}>
      <button className="title" aria-label={`Edit ${event.title}`} onClick={() => app.edit({ kind: 'event', id: event.id })}>
        <span className="time">{event.start}</span>
        <span className="name">{event.title}</span>
      </button>
    </li>
  )
}
