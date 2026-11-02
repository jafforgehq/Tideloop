import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { wireUpdater } from '../src/main/updater'
import type { UpdateStatus } from '../src/shared/types'

class FakeUpdater extends EventEmitter {
  autoDownload = true
  autoInstallOnAppQuit = false
  checkForUpdates = vi.fn(async () => null as unknown)
  downloadUpdate = vi.fn(async () => [] as string[])
  quitAndInstall = vi.fn()
}

const setup = (autoDownload = true) => {
  const updater = new FakeUpdater()
  const sent: UpdateStatus[] = []
  const api = wireUpdater(updater, { send: (s) => sent.push(s), autoDownload: () => autoDownload })
  return { updater, sent, api, last: () => sent.at(-1) }
}

describe('wireUpdater', () => {
  it('installs on quit by default', () => expect(setup().updater.autoInstallOnAppQuit).toBe(true))

  it('shows checking and then up to date on a manual check', async () => {
    const { updater, api, sent } = setup()
    await api.check(true)
    updater.emit('update-not-available', { version: '0.0.1' })
    expect(sent.map((s) => s.state)).toEqual(['checking', 'current'])
  })

  it('stays silent on a background check that finds nothing', async () => {
    const { updater, api, sent } = setup()
    await api.check(false)
    updater.emit('update-not-available', { version: '0.0.1' })
    expect(sent).toEqual([])
  })

  it('reports progress and then ready when downloading automatically', async () => {
    const { updater, api, last } = setup()
    await api.check(false)
    updater.emit('update-available', { version: '0.0.2' })
    expect(last()).toEqual({ state: 'downloading', version: '0.0.2', percent: 0 })
    updater.emit('download-progress', { percent: 41.7 })
    expect(last()).toEqual({ state: 'downloading', version: '0.0.2', percent: 42 })
    updater.emit('update-downloaded', { version: '0.0.2' })
    expect(last()).toEqual({ state: 'ready', version: '0.0.2' })
  })

  it('waits for the owner when automatic download is off', async () => {
    const { updater, api, last } = setup(false)
    await api.check(false)
    expect(updater.autoDownload).toBe(false)
    updater.emit('update-available', { version: '0.0.2' })
    expect(last()).toEqual({ state: 'available', version: '0.0.2' })
    await api.download()
    expect(updater.downloadUpdate).toHaveBeenCalled()
    expect(last()).toEqual({ state: 'downloading', version: '0.0.2', percent: 0 })
  })

  it('hides errors from background checks', async () => {
    const { updater, api, sent } = setup()
    await api.check(false)
    updater.emit('error', new Error('offline'))
    expect(sent).toEqual([])
  })

  it('shows errors from manual checks', async () => {
    const { updater, api, last } = setup()
    await api.check(true)
    updater.emit('error', new Error('offline\n  at stack'))
    expect(last()).toEqual({ state: 'error', message: 'Could not check for updates: offline' })
  })

  it('survives a rejected check', async () => {
    const { updater, api, last } = setup()
    updater.checkForUpdates.mockRejectedValueOnce(new Error('offline'))
    await expect(api.check(true)).resolves.toBeUndefined()
    expect(last()?.state).toBe('error')
  })

  it('does not check again once an update is ready', async () => {
    const { updater, api, last } = setup()
    updater.emit('update-downloaded', { version: '0.0.2' })
    await api.check(true)
    expect(updater.checkForUpdates).not.toHaveBeenCalled()
    expect(last()).toEqual({ state: 'ready', version: '0.0.2' })
  })

  it('restarts into the update', () => {
    const { updater, api } = setup()
    api.install()
    expect(updater.quitAndInstall).toHaveBeenCalled()
  })
})
