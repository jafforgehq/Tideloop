import { closeSync, copyFileSync, existsSync, fsyncSync, openSync, readFileSync, renameSync, writeSync } from 'node:fs'
import { join } from 'node:path'
import { emptyData, normalize, PlannerError } from '../shared/planner'
import type { PlannerData } from '../shared/types'

const FILE = 'planner.json'

/** Atomic and synchronous, so a change is on disk before anything can quit. The file stays small. */
export function saveData(dir: string, data: PlannerData): void {
  const file = join(dir, FILE)
  const temp = `${file}.tmp`
  const fd = openSync(temp, 'w', 0o600)
  try {
    writeSync(fd, JSON.stringify(data, null, 2))
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
  if (existsSync(file)) copyFileSync(file, `${file}.bak`)
  renameSync(temp, file)
}

const read = (path: string): PlannerData => normalize(JSON.parse(readFileSync(path, 'utf8')))

/** An unreadable file is moved aside and never overwritten. `notice` tells the owner what happened. */
export function loadData(dir: string): { data: PlannerData; notice: string | null } {
  const file = join(dir, FILE)
  if (!existsSync(file)) return { data: emptyData(), notice: null }
  let reason: string
  try {
    return { data: read(file), notice: null }
  } catch (error) {
    // Only a file that was read and is wrong gets moved aside. A read that failed (permissions, a busy disk) may succeed next time.
    if (!(error instanceof SyntaxError || error instanceof PlannerError)) throw error
    reason = /newer/.test((error as Error).message)
      ? 'Your planner file was made by a newer version of Tideloop'
      : 'Your planner file could not be read'
  }
  const aside = `planner.unreadable-${Date.now()}.json`
  renameSync(file, join(dir, aside))
  try {
    const data = read(`${file}.bak`)
    saveData(dir, data)
    return { data, notice: `${reason}, so Tideloop restored the last backup. The original is kept as ${aside}.` }
  } catch {
    return { data: emptyData(), notice: `${reason}, so Tideloop started empty. The original is kept as ${aside}.` }
  }
}
