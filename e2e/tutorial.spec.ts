import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { dayLabel } from '../src/shared/dates'
import { emptyData, reduce } from '../src/shared/planner'
import { day, launch, seed, tempDir, today } from './helpers'

const tour = (page: Page) => page.getByRole('region', { name: 'Tutorial' })
const region = (page: Page, date: string) => page.getByRole('region', { name: dayLabel(date), exact: true })
const add = async (page: Page, text: string) => {
  await page.getByLabel('New todo').fill(text)
  await page.getByLabel('New todo').press('Enter')
}

test('a new person is walked through with real actions, and only once', async () => {
  const dir = tempDir()
  let { app, page } = await launch(dir, { firstRun: true })
  await expect(tour(page).getByText('Add your first todo')).toBeVisible()
  await expect(page.locator('.tour-ring')).toHaveCount(1)

  await add(page, 'Buy milk')
  await expect(tour(page).getByText('Drag it onto a day')).toBeVisible()
  await expect(page.locator('.tour-ring')).toHaveCount(2)

  await page.locator('.dock [data-todo-id]').dragTo(region(page, today))
  await expect(region(page, today).getByText('Buy milk')).toBeVisible()
  await expect(tour(page).getByText('Watch the tide')).toBeVisible()

  await tour(page).getByRole('button', { name: 'Next' }).click()
  await expect(tour(page).getByText('Tick it off')).toBeVisible()
  await page.getByRole('button', { name: 'Mark Buy milk done' }).click()

  await expect(tour(page).getByText('Add something with a time')).toBeVisible()
  await add(page, 'Dentist today 14:30')

  await expect(tour(page).getByText('Look further ahead')).toBeVisible()
  await page.getByRole('button', { name: 'Month', exact: true }).click()

  await expect(tour(page).getByText("You're set")).toBeVisible()
  await tour(page).getByRole('button', { name: 'Done' }).click()
  await expect(tour(page)).toBeHidden()
  await expect(page.locator('.tour-ring')).toHaveCount(0)
  await expect(region(page, today).getByText('Buy milk')).toBeVisible()
  await app.close()

  ;({ app, page } = await launch(dir, { firstRun: true }))
  await expect(tour(page)).toBeHidden()
  await app.close()
})

test('the drag step can be done from the keyboard', async () => {
  const { app, page } = await launch(tempDir(), { firstRun: true })
  await add(page, 'Buy milk')
  await page.locator('.dock [data-todo-id]').focus()
  await page.keyboard.press('Alt+ArrowRight')
  await expect(tour(page).getByText('Watch the tide')).toBeVisible()
  await app.close()
})

test('text with a time goes on the calendar, and the tutorial says why', async () => {
  const { app, page } = await launch(tempDir(), { firstRun: true })
  await add(page, 'Dentist today 14:30')
  await expect(region(page, today).getByText('Dentist')).toBeVisible()
  await expect(tour(page).getByText(/had a time in it/)).toBeVisible()
  await expect(tour(page).getByText('Add your first todo')).toBeVisible()
  await app.close()
})

test('skipping sticks after a restart', async () => {
  const dir = tempDir()
  let { app, page } = await launch(dir, { firstRun: true })
  await tour(page).getByRole('button', { name: 'Skip tutorial' }).click()
  await expect(tour(page)).toBeHidden()
  await app.close()
  expect(JSON.parse(readFileSync(join(dir, 'planner.json'), 'utf8')).settings.tutorialDone).toBe(true)
  ;({ app, page } = await launch(dir, { firstRun: true }))
  await expect(tour(page)).toBeHidden()
  await app.close()
})

test('it can be replayed from Settings', async () => {
  const dir = tempDir()
  seed(dir, [])
  const { app, page } = await launch(dir)
  await expect(tour(page)).toBeHidden()
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Show the tutorial again' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(tour(page).getByText('Add your first todo')).toBeVisible()
  await app.close()
})

test('someone updating with plans already is not interrupted', async () => {
  const dir = tempDir()
  const data = reduce(emptyData(), { type: 'todo/add', id: 'a', title: 'Old plan', date: day(1) })
  const old = JSON.parse(JSON.stringify(data))
  delete old.settings.tutorialDone
  writeFileSync(join(dir, 'planner.json'), JSON.stringify(old))
  const { app, page } = await launch(dir, { firstRun: true })
  await expect(page.getByText('Old plan')).toBeVisible()
  await expect(tour(page)).toBeHidden()
  await app.close()
})

test('quick add says where a dated item went', async () => {
  const { app, page } = await launch(tempDir())
  await add(page, 'Dentist today 14:30')
  await expect(page.getByRole('status').getByText(`Added to ${dayLabel(today)}`)).toBeVisible()
  await app.close()
})
