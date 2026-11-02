import '@fontsource-variable/familjen-grotesk'
import './style.css'
import { addDays, dayLabel, dayOfMonth, longDay, shortDay, startOfWeek, todayISO } from '../src/shared/dates'
import { emptyData, reduce } from '../src/shared/planner'
import { parseQuickAdd } from '../src/shared/quickAdd'
import { formatMinutes, tidePath, weekFinding, weekSummary } from '../src/shared/tide'
import type { Action, PlannerData } from '../src/shared/types'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const TODAY = todayISO()
const MONDAY = startOfWeek(TODAY)
const on = (i: number) => addDays(MONDAY, i)

// The hero runs the app's real planner rules on a sample week.

const sample: Action[] = [
  { type: 'event/add', id: 'e1', title: 'Standup', date: on(0), start: '09:30', minutes: 30 },
  { type: 'event/add', id: 'e2', title: 'Client call', date: on(1), start: '14:00', minutes: 60 },
  { type: 'event/add', id: 'e3', title: 'Design review', date: on(2), start: '11:00', minutes: 60 },
  { type: 'event/add', id: 'e4', title: 'Accountant', date: on(3), start: '16:00', minutes: 60 },
  { type: 'event/add', id: 'e5', title: 'Lunch with Sara', date: on(4), start: '12:30', minutes: 60 },
  { type: 'event/add', id: 'e6', title: 'Climbing', date: on(5), start: '10:00', minutes: 120 },
  { type: 'event/add', id: 'e7', title: 'Call parents', date: on(6), start: '18:00', minutes: 30 },
  { type: 'todo/add', id: 't1', title: 'Send invoice', date: on(0), minutes: 60 },
  { type: 'todo/add', id: 't2', title: 'Review contract', date: on(1), minutes: 120 },
  { type: 'todo/add', id: 't3', title: 'Prepare slides', date: on(2), minutes: 180 },
  { type: 'todo/add', id: 't4', title: 'Write release notes', date: on(2), minutes: 150 },
  { type: 'todo/add', id: 't5', title: 'Submit tax form', date: on(3), minutes: 120 },
  { type: 'todo/add', id: 't6', title: 'Pay rent', date: on(4), minutes: 15 },
  { type: 'todo/add', id: 't7', title: 'Fix bike brakes', date: on(5), minutes: 60 },
  { type: 'todo/add', id: 't8', title: 'Draft Q4 roadmap', minutes: 120 },
  { type: 'todo/add', id: 't9', title: 'Record demo video', minutes: 120 },
  { type: 'todo/add', id: 't10', title: 'Call plumber', minutes: 30 }
]
let data: PlannerData = sample.reduce(reduce, emptyData())
let picked: string | null = null

function escapeHtml(text: string): string {
  const span = document.createElement('span')
  span.textContent = text
  return span.innerHTML
}

function renderHero(): void {
  const { dates, loads } = weekSummary(data, MONDAY)
  const full = data.settings.fullDayHours * 60
  $('water').setAttribute('d', tidePath(loads, 700, 120, full))
  $('swell').setAttribute('d', tidePath(loads.map((m, i) => (m + (loads[i - 1] ?? m)) / 2), 700, 120, full))
  $('finding').textContent = weekFinding(data, MONDAY)

  const tray = data.todos.filter((t) => t.date === null)
  $('tray').innerHTML = tray.length
    ? tray.map((t) => `<button type="button" class="chip" draggable="true" data-todo="${t.id}" aria-pressed="${picked === t.id}">${escapeHtml(t.title)} <span>${formatMinutes(t.minutes)}</span></button>`).join('')
    : '<span class="tray-empty">All scheduled. Watch the water.</span>'

  $('heads').innerHTML = dates.map((date, i) => `
    <button type="button" class="head" data-day="${date}" aria-label="Move the picked todo to ${dayLabel(date)}" data-over="${loads[i] > full}">
      <span>${shortDay(date)}</span><b data-today="${date === TODAY}">${dayOfMonth(date)}</b><em>${formatMinutes(loads[i])}</em>
    </button>`).join('')

  $('days').innerHTML = dates.map((date) => {
    const events = data.events.filter((e) => e.date === date)
    const todos = data.todos.filter((t) => t.date === date).sort((a, b) => a.order - b.order)
    return `<div class="day" data-day="${date}" data-today="${date === TODAY}">
      ${events.map((e) => `<div class="event"><small>${e.start}</small>${escapeHtml(e.title)}</div>`).join('')}
      ${todos.map((t) => `<button type="button" class="card" draggable="true" data-todo="${t.id}" aria-pressed="${picked === t.id}">${escapeHtml(t.title)}</button>`).join('')}
    </div>`
  }).join('')
}

function moveTo(id: string, date: string): void {
  data = reduce(data, { type: 'todo/move', id, date })
  picked = null
  renderHero()
}

const fragment = $('tide-fragment')
// Tap a todo, then tap a day. This is the phone and keyboard path, and it also works with a mouse.
fragment.addEventListener('click', (e) => {
  const target = e.target as HTMLElement
  const todo = target.closest<HTMLElement>('[data-todo]')?.dataset.todo
  const day = target.closest<HTMLElement>('[data-day]')?.dataset.day
  if (todo) {
    picked = picked === todo ? null : todo
    renderHero()
  } else if (picked && day) {
    moveTo(picked, day)
  }
})
fragment.addEventListener('dragstart', (e) => {
  const todo = (e.target as HTMLElement).closest<HTMLElement>('[data-todo]')?.dataset.todo
  if (todo && e.dataTransfer) {
    e.dataTransfer.setData('text/plain', todo)
    e.dataTransfer.effectAllowed = 'move'
  }
})
fragment.addEventListener('dragover', (e) => {
  const zone = (e.target as HTMLElement).closest<HTMLElement>('[data-day]')
  fragment.querySelectorAll('[data-drop]').forEach((el) => el.removeAttribute('data-drop'))
  if (zone) {
    e.preventDefault()
    zone.setAttribute('data-drop', 'true')
  }
})
fragment.addEventListener('drop', (e) => {
  const day = (e.target as HTMLElement).closest<HTMLElement>('[data-day]')?.dataset.day
  const todo = e.dataTransfer?.getData('text/plain')
  e.preventDefault()
  if (day && todo) moveTo(todo, day)
})
renderHero()

// Quick add runs the app's real parser.

const typed = $<HTMLInputElement>('typed')
function renderAnswer(): void {
  const parsed = parseQuickAdd(typed.value, TODAY)
  const rows: [string, string][] = [
    ['Type', parsed.kind === 'event' ? 'Event' : 'Todo'],
    ['Title', parsed.title || 'Nothing yet'],
    ['When', parsed.date ? `${longDay(parsed.date)}, ${dayLabel(parsed.date).split(' ').slice(1).join(' ')}` : parsed.kind === 'event' ? 'Today' : 'No date, waits in its list'],
    ['Starts', parsed.start ?? 'Any time'],
    ['Length', formatMinutes(parsed.minutes ?? 30)],
    ['List', parsed.listName ?? 'First list']
  ]
  $('answer').replaceChildren(...rows.flatMap(([k, v]) => {
    const dt = document.createElement('dt')
    const dd = document.createElement('dd')
    dt.textContent = k
    dd.textContent = v
    return [dt, dd]
  }))
}
typed.addEventListener('input', renderAnswer)
$('examples').addEventListener('click', (e) => {
  const button = (e.target as HTMLElement).closest('button')
  if (!button) return
  typed.value = button.textContent ?? ''
  renderAnswer()
})
renderAnswer()

// Command list: the app's real shortcuts.

const COMMANDS: [string, string[], string][] = [
  ['Move to the next day', ['⌥', '→'], 'Any focused todo or event moves, and focus stays on it.'],
  ['Reorder within a day', ['⌥', '↓'], 'The keyboard does everything dragging does.'],
  ['New todo', ['⌘', 'N'], 'Jumps to quick add from anywhere in the app.'],
  ['New event', ['⇧', '⌘', 'N'], 'Opens the event form on the day you are looking at.'],
  ['Undo, even after Claude', ['⌘', 'Z'], 'Up to 100 steps back, including edits made over MCP.'],
  ['Jump to today', ['⌘', 'T'], 'Back to this week from wherever you wandered.'],
  ['Next week or month', ['⌘', ']'], 'And ⌘[ goes back the other way.'],
  ['Switch to the month', ['⌘', '2'], 'And ⌘1 returns to the week.']
]
let selected = 0
const commandList = $('command-list')
const search = $<HTMLInputElement>('command-search')
function renderCommands(): void {
  const q = search.value.trim().toLowerCase()
  const shown = COMMANDS.filter(([name, , note]) => `${name} ${note}`.toLowerCase().includes(q))
  selected = Math.min(selected, Math.max(0, shown.length - 1))
  commandList.innerHTML = shown.length
    ? shown.map(([name, keys, note], i) => `
      <li data-index="${i}" data-selected="${i === selected}">
        <span class="command-name">${escapeHtml(name)}</span>
        <span class="keys" aria-label="Shortcut">${keys.map((k) => `<kbd>${k}</kbd>`).join('')}</span>
        ${i === selected ? `<p>${escapeHtml(note)}</p>` : ''}
      </li>`).join('')
    : '<li class="none">No command by that name.</li>'
}
search.addEventListener('input', () => {
  selected = 0
  renderCommands()
})
search.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
  e.preventDefault()
  const count = commandList.querySelectorAll('[data-index]').length
  if (count) selected = (selected + (e.key === 'ArrowDown' ? 1 : -1) + count) % count
  renderCommands()
})
const pickCommand = (e: Event) => {
  const index = (e.target as HTMLElement).closest<HTMLElement>('[data-index]')?.dataset.index
  if (index !== undefined && Number(index) !== selected) {
    selected = Number(index)
    renderCommands()
  }
}
commandList.addEventListener('mouseover', pickCommand)
commandList.addEventListener('click', pickCommand)
renderCommands()

// Themes, with real screenshots.

const THEME_TILES: [string, string, string, string, string, string][] = [
  ['week-tide', 'Tide', 'Light', 'Familjen Grotesk', '#0F5C66', '#F4FBF9'],
  ['week-chart-paper', 'Chart Paper', 'Light', 'IBM Plex Sans', '#E6EEFA', '#123F86'],
  ['week-almanac', 'Almanac', 'Light', 'Archivo', '#0A0A0A', '#FFFFFF'],
  ['week-deep-water', 'Deep Water', 'Dark', 'Familjen Grotesk', '#6FD9C0', '#071A1C'],
  ['week-kelp', 'Kelp', 'Dark', 'IBM Plex Sans', '#F2C14E', '#12211B'],
  ['week-terminal', 'Terminal', 'Dark', 'JetBrains Mono', '#FFB000', '#000000'] // taste-skill-ignore: names the theme's font
]
$('tiles').innerHTML = THEME_TILES.map(([file, name, mode, font, bg, ink]) => `
  <figure class="tile-print reveal">
    <img src="./shots/${file}.jpg" alt="Tideloop week view in the ${name} theme" width="1600" height="886" loading="lazy">
    <figcaption style="background:${bg};color:${ink}">
      <b>${name}</b>
      <span>${mode}</span>
      <span>${font}</span>
    </figcaption>
  </figure>`).join('')

// Questions: one answer pane.

const FAQ: [string, string][] = [
  ['Where does my planner live?', 'In one file on your Mac. Tideloop has no account and no server. The only thing it asks the internet for is whether a new version exists.'],
  ['Will macOS warn me about it?', 'Only the usual first-launch question for anything downloaded. Every build is signed with a Developer ID and notarized by Apple, and the release pipeline refuses to publish one that is not.'],
  ['How do updates work?', 'Tideloop checks in the background and downloads new versions by itself. It installs when you restart or quit. You can turn automatic downloads off in Settings.'],
  ['Does it sync with my calendar or phone?', 'Not in this version. There is no calendar sync, no sync between devices, and no recurring items yet.'],
  ['What can Claude Code touch?', 'Your todos, events and lists, through the same rules the app itself uses. It cannot read anything else on your Mac through Tideloop, and it only works after you switch it on and add the token.'],
  ['Which Macs does it run on?', 'Apple silicon and Intel, on macOS 13 or later.']
]
let question = 0
const faqList = $('faq-list')
function renderFaq(): void {
  faqList.innerHTML = FAQ.map(([q], i) => `
    <li>
      <button type="button" data-q="${i}" aria-expanded="${i === question}"><i></i>${escapeHtml(q)}</button>
      <p class="faq-inline" ${i === question ? '' : 'hidden'}>${escapeHtml(FAQ[i][1])}</p>
    </li>`).join('')
  $('faq-answer').textContent = FAQ[question][1]
}
const pickQuestion = (e: Event) => {
  const q = (e.target as HTMLElement).closest<HTMLElement>('[data-q]')?.dataset.q
  if (q === undefined || Number(q) === question) return
  question = Number(q)
  const focused = document.activeElement === e.target
  renderFaq()
  if (focused) faqList.querySelector<HTMLElement>(`[data-q="${q}"]`)?.focus()
}
faqList.addEventListener('click', pickQuestion)
faqList.addEventListener('mouseover', pickQuestion)
renderFaq()

// Entrances. Content stays visible if script or the observer is missing, because only JS adds the hidden state.

document.documentElement.classList.add('motion')
const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue
    entry.target.classList.add('in')
    observer.unobserve(entry.target)
  }
}, { rootMargin: '0px 0px -8% 0px' })
document.querySelectorAll('.reveal, .shutter').forEach((el, i) => {
  ;(el as HTMLElement).style.setProperty('--delay', `${(i % 4) * 70}ms`)
  observer.observe(el)
})

