import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { Action } from '../../shared/types'
import { newId, useApp, type EditTarget } from './context'

const PRESETS = [15, 30, 60, 120]

function Dialog({ title, onClose, error, children, onSubmit, onDelete, deleteNote }: { title: string; onClose: () => void; error: string | null; children: ReactNode; onSubmit: () => void; onDelete?: () => void; deleteNote?: string }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (!ref.current?.open) ref.current?.showModal()
  }, [])
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit()
  }
  return (
    <dialog ref={ref} className="sheet" aria-label={title} onClose={onClose}>
      <form onSubmit={submit}>
        <h2>{title}</h2>
        {children}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="sheet-actions">
          {onDelete && <button type="button" className="btn danger" onClick={onDelete}>Delete</button>}
          {deleteNote && <span className="note">{deleteNote}</span>}
          <span className="grow" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary">Save</button>
        </div>
      </form>
    </dialog>
  )
}

function useSave(onClose: () => void) {
  const app = useApp()
  const [error, setError] = useState<string | null>(null)
  const save = async (action: Action) => {
    const problem = await app.dispatch(action, true)
    if (problem) setError(problem)
    else onClose()
  }
  return { error, save }
}

function Minutes({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="field">
      <label htmlFor="edit-minutes">Minutes</label>
      <div className="row">
        <input id="edit-minutes" type="number" min={1} max={1440} value={value} onChange={(e) => onChange(e.target.value)} />
        {PRESETS.map((m) => <button key={m} type="button" className="btn small" aria-pressed={Number(value) === m} onClick={() => onChange(String(m))}>{m < 60 ? `${m}m` : `${m / 60}h`}</button>)}
      </div>
    </div>
  )
}

function TodoEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const app = useApp()
  const todo = app.data.todos.find((t) => t.id === id)!
  const { error, save } = useSave(onClose)
  const [title, setTitle] = useState(todo.title)
  const [listId, setListId] = useState(todo.listId)
  const [date, setDate] = useState(todo.date ?? '')
  const [minutes, setMinutes] = useState(String(todo.minutes))
  const [notes, setNotes] = useState(todo.notes)
  const [done, setDone] = useState(todo.done)
  return (
    <Dialog
      title="Edit todo"
      onClose={onClose}
      error={error}
      onSubmit={() => void save({ type: 'todo/update', id, patch: { title, listId, date: date || null, minutes: Number(minutes), notes, done } })}
      onDelete={() => {
        void app.dispatch({ type: 'todo/delete', id })
        app.toast(`Deleted ${todo.title}`, { undo: true })
        onClose()
      }}
    >
      <div className="field"><label htmlFor="edit-title">Title</label><input id="edit-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="two">
        <div className="field"><label htmlFor="edit-list">List</label><select id="edit-list" value={listId} onChange={(e) => setListId(e.target.value)}>{app.data.lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
        <div className="field"><label htmlFor="edit-date">Date, empty for none</label><input id="edit-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      </div>
      <Minutes value={minutes} onChange={setMinutes} />
      <div className="field"><label htmlFor="edit-notes">Notes</label><textarea id="edit-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <label className="check-row"><input type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} /> Done</label>
    </Dialog>
  )
}

function EventEditor({ id, date: initialDate, onClose }: { id: string | null; date?: string; onClose: () => void }) {
  const app = useApp()
  const event = id ? app.data.events.find((e) => e.id === id)! : null
  const { error, save } = useSave(onClose)
  const [title, setTitle] = useState(event?.title ?? '')
  const [date, setDate] = useState(event?.date ?? initialDate ?? app.today)
  const [start, setStart] = useState(event?.start ?? '09:00')
  const [minutes, setMinutes] = useState(String(event?.minutes ?? 60))
  const [notes, setNotes] = useState(event?.notes ?? '')
  const fields = { title, date, start, minutes: Number(minutes), notes }
  return (
    <Dialog
      title={event ? 'Edit event' : 'New event'}
      onClose={onClose}
      error={error}
      onSubmit={() => void save(event ? { type: 'event/update', id: event.id, patch: fields } : { type: 'event/add', id: newId(), ...fields })}
      onDelete={event ? () => {
        void app.dispatch({ type: 'event/delete', id: event.id })
        app.toast(`Deleted ${event.title}`, { undo: true })
        onClose()
      } : undefined}
    >
      <div className="field"><label htmlFor="edit-title">Title</label><input id="edit-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="two">
        <div className="field"><label htmlFor="edit-date">Date</label><input id="edit-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="field"><label htmlFor="edit-start">Starts</label><input id="edit-start" type="time" required value={start} onChange={(e) => setStart(e.target.value)} /></div>
      </div>
      <Minutes value={minutes} onChange={setMinutes} />
      <div className="field"><label htmlFor="edit-notes">Notes</label><textarea id="edit-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
    </Dialog>
  )
}

function ListEditor({ id, onClose }: { id: string | null; onClose: () => void }) {
  const app = useApp()
  const list = id ? app.data.lists.find((l) => l.id === id)! : null
  const { error, save } = useSave(onClose)
  const [name, setName] = useState(list?.name ?? '')
  const [color, setColor] = useState(list?.color ?? app.data.lists.length % 6)
  const others = app.data.lists.filter((l) => l.id !== id)
  return (
    <Dialog
      title={list ? 'Edit list' : 'New list'}
      onClose={onClose}
      error={error}
      onSubmit={() => void save(list ? { type: 'list/update', id: list.id, patch: { name, color } } : { type: 'list/add', id: newId(), name, color })}
      onDelete={list && others.length > 0 ? () => {
        void app.dispatch({ type: 'list/delete', id: list.id })
        app.toast(`Deleted ${list.name}. Its todos moved to ${others[0].name}.`, { undo: true })
        onClose()
      } : undefined}
      deleteNote={list && others.length > 0 ? `Its todos move to ${others[0].name}.` : undefined}
    >
      <div className="field"><label htmlFor="edit-name">Name</label><input id="edit-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} /></div>
      <fieldset className="swatches">
        <legend>Colour</legend>
        {[0, 1, 2, 3, 4, 5].map((c) => (
          <label key={c} className="swatch" style={{ background: `var(--list-${c})` }}>
            <input type="radio" name="colour" aria-label={`Colour ${c + 1}`} checked={color === c} onChange={() => setColor(c)} />
          </label>
        ))}
      </fieldset>
    </Dialog>
  )
}

export function Editor({ target, onClose }: { target: EditTarget; onClose: () => void }) {
  if (target.kind === 'todo') return <TodoEditor id={target.id} onClose={onClose} />
  if (target.kind === 'event') return <EventEditor id={target.id} onClose={onClose} />
  if (target.kind === 'new-event') return <EventEditor id={null} date={target.date} onClose={onClose} />
  return <ListEditor id={target.id} onClose={onClose} />
}
