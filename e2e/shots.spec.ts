import { mkdirSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { addDays } from '../src/shared/dates'
import { emptyData } from '../src/shared/planner'
import { THEME_IDS, type Action, type ThemeId } from '../src/shared/types'
import { launch, seed, tempDir } from './helpers'

// Sample week for screenshots only. Run with: SHOTS=dir npx playwright test shots
const OUT = process.env.SHOTS
const NOW = '2026-11-04T10:40:00'
const MON = '2026-11-02'
const on = (i: number) => addDays(MON, i)

const lists: Action[] = [
  { type: 'list/update', id: 'work', patch: { name: 'Work', color: 0 } },
  { type: 'list/add', id: 'side', name: 'Side project', color: 1 },
  { type: 'list/update', id: 'home', patch: { name: 'Home', color: 2 } },
  { type: 'list/add', id: 'health', name: 'Health', color: 3 }
]
const rows: [string, string, number | null, boolean, number?][] = [
  ['Send October invoice', 'work', 0, true], ['Renew domain', 'side', 0, true], ['Laundry', 'home', 0, true],
  ['Review contract draft', 'work', 1, true, 60], ['Fix login crash', 'side', 1, true, 90],
  ['Prepare review slides', 'work', 2, false, 90], ['Write release notes', 'side', 2, false, 45], ['Book train tickets', 'home', 2, false, 15], ['Run 5 km', 'health', 2, false, 45], ['Buy groceries', 'home', 2, false],
  ['Submit tax form', 'work', 3, false, 60], ['Ship build 0.4 to testers', 'side', 3, false, 60],
  ['Clean up inbox', 'work', 4, false], ['Pay rent', 'home', 4, false, 15],
  ['Fix bike brakes', 'home', 5, false, 60], ['Plan next week', 'home', 6, false],
  ['Draft Q4 roadmap', 'work', null, false], ['Update portfolio', 'work', null, false],
  ['Record demo video', 'side', null, false], ['Write onboarding email', 'side', null, false],
  ['Call plumber', 'home', null, false], ['Return parcel', 'home', null, false], ['Book eye test', 'health', null, false]
]
const events: [number, string, string, number][] = [
  [0, '09:30', 'Standup', 30], [1, '14:00', 'Client call', 60], [2, '11:00', 'Design review', 60], [2, '14:30', 'Dentist', 45],
  [3, '09:30', 'Standup', 30], [3, '16:00', 'Accountant', 60], [4, '12:30', 'Lunch with Sara', 60], [5, '10:00', 'Climbing', 120], [6, '18:00', 'Call parents', 30],
  [10, '09:00', 'Workshop', 180], [12, '19:30', 'Concert', 120], [18, '10:00', 'Board meeting', 60], [27, '08:15', 'Train to Graz', 240]
]
const actions = (theme: ThemeId): Action[] => [
  { type: 'settings/update', patch: { themeMode: 'fixed', fixedTheme: theme } },
  ...lists,
  ...rows.flatMap(([title, listId, day, done, minutes], i): Action[] => {
    const id = `t${i}`
    const add: Action = { type: 'todo/add', id, title, listId, date: day === null ? null : on(day), minutes }
    return done ? [add, { type: 'todo/toggle', id }] : [add]
  }),
  ...events.map(([day, start, title, minutes], i): Action => ({ type: 'event/add', id: `e${i}`, title, date: on(day), start, minutes }))
]

test.describe('screenshots', () => {
  test.skip(!OUT, 'Set SHOTS to a folder to take screenshots')
  for (const theme of THEME_IDS) {
    test(theme, async () => {
      mkdirSync(OUT!, { recursive: true })
      const dir = tempDir()
      seed(dir, actions(theme), emptyData())
      const { app, page } = await launch(dir)
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1440, 900))
      await page.clock.setFixedTime(new Date(NOW))
      await page.reload()
      await page.locator('[data-app-ready]').waitFor()
      await page.waitForTimeout(800)
      await page.screenshot({ path: `${OUT}/week-${theme}.png` })
      await page.getByRole('button', { name: 'Month', exact: true }).click()
      await page.waitForTimeout(700)
      await page.screenshot({ path: `${OUT}/month-${theme}.png` })
      await page.getByRole('button', { name: 'Week', exact: true }).click()
      await page.getByRole('button', { name: 'Settings' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.waitForTimeout(200)
      await page.screenshot({ path: `${OUT}/settings-${theme}.png` })
      await app.close()
    })
  }

  test('tutorial', async () => {
    mkdirSync(OUT!, { recursive: true })
    const dir = tempDir()
    seed(dir, [...actions('tide'), { type: 'settings/update', patch: { tutorialDone: false } }], emptyData())
    const { app, page } = await launch(dir)
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1440, 900))
    await page.clock.setFixedTime(new Date(NOW))
    await page.reload()
    await page.locator('[data-app-ready]').waitFor()
    await expect(page.getByRole('region', { name: 'Tutorial' })).toBeVisible()
    await page.waitForTimeout(800)
    await page.screenshot({ path: `${OUT}/tutorial-tide.png` })
    await app.close()
  })

  test('review', async () => {
    mkdirSync(OUT!, { recursive: true })
    const dir = tempDir()
    const more: Action[] = ['t5', 't6', 't8', 't10', 't12', 't14'].map((id) => ({ type: 'todo/toggle', id }))
    seed(dir, [...actions('tide'), ...more], emptyData())
    const { app, page } = await launch(dir)
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1440, 900))
    await page.clock.setFixedTime(new Date(NOW))
    await page.reload()
    await page.locator('[data-app-ready]').waitFor()
    await page.getByRole('button', { name: 'Review', exact: true }).click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${OUT}/review-tide.png` })
    await app.close()
  })
})
