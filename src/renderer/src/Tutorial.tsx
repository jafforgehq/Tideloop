import { useEffect, useState } from 'react'
import { formatMinutes } from '../../shared/tide'
import type { TutorialState, TutorialStepId } from '../../shared/tutorial'
import { useApp } from './context'

const NUMBERED: TutorialStepId[] = ['add-todo', 'drag-to-day', 'read-tide', 'tick-off', 'add-event', 'month']

function copy(state: TutorialState, title: string, minutes: number, fullDayHours: number): { heading: string; body: string } {
  switch (state.step) {
    case 'add-todo':
      return {
        heading: 'Add your first todo',
        body: state.note === 'made-event'
          ? 'That had a time in it, so it went on the calendar as an event. Now try one with no time or day, like Buy milk.'
          : 'Type something in New todo, like Buy milk, and press Enter. It waits in a list until you give it a day.'
      }
    case 'drag-to-day':
      return { heading: 'Drag it onto a day', body: `Drag ${title} from the list onto any day. From the keyboard, select it and press ⌥→.` }
    case 'read-tide':
      return { heading: 'Watch the tide', body: `The water shows how full each day is. ${title} added ${formatMinutes(minutes)}, and a full ${fullDayHours}h day reaches the top.` }
    case 'tick-off':
      return { heading: 'Tick it off', body: `Click the circle beside ${title}. If you change your mind, ⌘Z undoes it.` }
    case 'add-event':
      return { heading: 'Add something with a time', body: 'Type Dentist fri 14:30 in New todo and press Enter. A time makes it an event, and a day word picks the day.' }
    case 'month':
      return { heading: 'Look further ahead', body: 'Click Month to see the whole month. You can drop todos onto any date there too.' }
    case 'finish':
      return { heading: "You're set", body: 'Themes and the Claude Code connection are in Settings, and so is this tutorial if you want it again.' }
  }
}

function targets(state: TutorialState): string[] {
  const card = state.todoId ? `[data-todo-id="${CSS.escape(state.todoId)}"]` : ''
  switch (state.step) {
    case 'add-todo':
    case 'add-event':
      return ['#quick-add']
    case 'drag-to-day':
      return [card, '.day[data-today="true"]']
    case 'read-tide':
      return ['.tide']
    case 'tick-off':
      return [`${card} .check`]
    case 'month':
      return ['[data-tour="month"]']
    case 'finish':
      return ['[aria-label="Settings"]']
  }
}

/** Tracks where the highlighted elements are. Polling is simplest, because drags and renders move them. */
function useRects(selectors: string[]): DOMRect[] {
  const [rects, setRects] = useState<DOMRect[]>([])
  const key = selectors.join('|')
  useEffect(() => {
    const update = () => {
      const next = key.split('|').flatMap((s) => {
        const el = s ? document.querySelector(s) : null
        return el ? [el.getBoundingClientRect()] : []
      })
      setRects((old) => (JSON.stringify(old) === JSON.stringify(next) ? old : next))
    }
    update()
    const timer = setInterval(update, 200)
    return () => clearInterval(timer)
  }, [key])
  return rects
}

export function Tutorial({ state, onNext, onEnd }: { state: TutorialState; onNext: () => void; onEnd: () => void }) {
  const app = useApp()
  const todo = app.data.todos.find((t) => t.id === state.todoId)
  const { heading, body } = copy(state, todo?.title ?? 'your todo', todo?.minutes ?? 30, app.data.settings.fullDayHours)
  const rects = useRects(targets(state))
  const position = NUMBERED.indexOf(state.step)
  return (
    <>
      {rects.map((r, i) => (
        <div key={i} className="tour-ring" aria-hidden="true" style={{ left: r.left, top: r.top, width: r.width, height: r.height }} />
      ))}
      <section className="tour-card" aria-label="Tutorial" aria-live="polite">
        {position >= 0 && <p className="tour-count">Step {position + 1} of {NUMBERED.length}</p>}
        <h2>{heading}</h2>
        <p>{body}</p>
        <div className="tour-actions">
          {state.step !== 'finish' && <button className="link" onClick={onEnd}>Skip tutorial</button>}
          <span className="grow" />
          {state.step === 'read-tide' && <button className="btn primary" onClick={onNext}>Next</button>}
          {state.step === 'add-event' && <button className="btn" onClick={onNext}>Skip this</button>}
          {state.step === 'finish' && <button className="btn primary" onClick={onEnd}>Done</button>}
        </div>
      </section>
    </>
  )
}
