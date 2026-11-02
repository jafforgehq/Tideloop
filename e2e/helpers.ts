import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { addDays, startOfWeek, todayISO } from '../src/shared/dates'
import { emptyData, reduce } from '../src/shared/planner'
import type { Action, PlannerData } from '../src/shared/types'

export const today = todayISO()
export const monday = startOfWeek(today)
export const day = (i: number) => addDays(monday, i)

export const tempDir = () => mkdtempSync(join(tmpdir(), 'tideloop-e2e-'))

export const seed = (dir: string, actions: Action[], base: PlannerData = emptyData()) => {
  writeFileSync(join(dir, 'planner.json'), JSON.stringify(actions.reduce(reduce, base)))
}

export async function launch(dir: string): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    // TIDELOOP_APP runs the suite against a packaged build instead of the source tree.
    executablePath: process.env.TIDELOOP_APP,
    args: [...(process.env.TIDELOOP_APP ? [] : ['.']), `--user-data-dir=${dir}`, ...(process.env.CI ? ['--no-sandbox'] : [])]
  })
  const page = await app.firstWindow()
  await page.locator('[data-app-ready]').waitFor()
  return { app, page }
}
