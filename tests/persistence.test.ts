import { chmodSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadData, saveData } from '../src/main/persistence'
import { emptyData, reduce } from '../src/shared/planner'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'tideloop-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const file = () => join(dir, 'planner.json')
const withTodo = (id: string) => reduce(emptyData(), { type: 'todo/add', id, title: id })

describe('saveData', () => {
  it('writes a file that loads back the same', () => {
    const data = withTodo('a')
    saveData(dir, data)
    expect(loadData(dir)).toEqual({ data, notice: null })
  })
  it('leaves no temporary file', () => {
    saveData(dir, withTodo('a'))
    expect(readdirSync(dir)).toEqual(['planner.json'])
  })
  it('keeps the previous save as a backup', () => {
    saveData(dir, withTodo('a'))
    saveData(dir, withTodo('b'))
    expect(JSON.parse(readFileSync(`${file()}.bak`, 'utf8')).todos[0].id).toBe('a')
  })
  it('is on disk as soon as it returns', () => {
    saveData(dir, withTodo('now'))
    expect(JSON.parse(readFileSync(file(), 'utf8')).todos[0].id).toBe('now')
  })
})

describe('loadData', () => {
  it('starts empty with no notice on first run', () => {
    expect(loadData(dir)).toEqual({ data: emptyData(), notice: null })
  })
  it('moves a corrupt file aside and restores the backup', () => {
    saveData(dir, withTodo('good'))
    saveData(dir, withTodo('later'))
    writeFileSync(file(), '{ not json')
    const { data, notice } = loadData(dir)
    expect(data.todos[0].id).toBe('good')
    expect(notice).toMatch(/backup/i)
    const aside = readdirSync(dir).find((f) => f.startsWith('planner.unreadable-'))!
    expect(readFileSync(join(dir, aside), 'utf8')).toBe('{ not json')
  })
  it('starts empty and keeps the file when there is no backup', () => {
    writeFileSync(file(), 'garbage')
    const { data, notice } = loadData(dir)
    expect(data).toEqual(emptyData())
    expect(notice).toMatch(/could not be read/i)
    expect(readdirSync(dir).some((f) => f.startsWith('planner.unreadable-'))).toBe(true)
    expect(existsSync(file())).toBe(false)
  })
  it('never overwrites a file from a newer version', () => {
    const newer = JSON.stringify({ ...withTodo('future'), version: 2 })
    writeFileSync(file(), newer)
    const { data, notice } = loadData(dir)
    expect(data.todos).toHaveLength(0)
    expect(notice).toMatch(/newer/i)
    const aside = readdirSync(dir).find((f) => f.startsWith('planner.unreadable-'))!
    expect(readFileSync(join(dir, aside), 'utf8')).toBe(newer)
  })
  it('does not move a healthy file aside when it cannot be read right now', () => {
    saveData(dir, withTodo('a'))
    chmodSync(file(), 0o000)
    try {
      expect(() => loadData(dir)).toThrow()
    } finally {
      chmodSync(file(), 0o600)
    }
    expect(readdirSync(dir).filter((f) => f.includes('unreadable'))).toEqual([])
    expect(loadData(dir).data.todos).toHaveLength(1)
  })

})
