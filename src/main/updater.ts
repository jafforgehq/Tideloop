import type { EventEmitter } from 'node:events'
import type { UpdateStatus } from '../shared/types'

/** The part of electron-updater this app uses. */
export interface UpdaterLike extends Pick<EventEmitter, 'on'> {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  checkForUpdates(): Promise<unknown>
  downloadUpdate(): Promise<unknown>
  quitAndInstall(): void
}

export function wireUpdater(updater: UpdaterLike, options: { send: (status: UpdateStatus) => void; autoDownload: () => boolean }) {
  let status: UpdateStatus = { state: 'idle' }
  // Background work stays quiet. Only something the owner asked for reports its failures.
  let asked = false
  let version = ''

  const set = (next: UpdateStatus) => {
    status = next
    options.send(next)
  }
  const fail = (error: unknown) => {
    if (asked) {
      const first = String((error as Error)?.message ?? error).split('\n')[0].slice(0, 160)
      set({ state: 'error', message: `Could not check for updates: ${first}` })
    } else if (status.state !== 'idle' && status.state !== 'error') {
      // electron-updater emits an error and also rejects, so the same failure can arrive here twice.
      set({ state: 'idle' })
    }
    asked = false
  }

  updater.autoInstallOnAppQuit = true
  updater.on('update-not-available', () => {
    if (asked) set({ state: 'current' })
    asked = false
  })
  updater.on('update-available', (info: { version: string }) => {
    version = info.version
    set(updater.autoDownload ? { state: 'downloading', version, percent: 0 } : { state: 'available', version })
  })
  updater.on('download-progress', (progress: { percent: number }) => set({ state: 'downloading', version, percent: Math.round(progress.percent) }))
  updater.on('update-downloaded', (info: { version: string }) => {
    asked = false
    set({ state: 'ready', version: info.version })
  })
  updater.on('error', fail)

  return {
    status: () => status,
    async check(manual: boolean) {
      if (status.state === 'ready' || status.state === 'downloading') return
      updater.autoDownload = options.autoDownload()
      asked = manual
      if (manual) set({ state: 'checking' })
      else if (status.state === 'error') set({ state: 'idle' })
      try {
        await updater.checkForUpdates()
      } catch (error) {
        fail(error)
      }
    },
    async download() {
      asked = true
      set({ state: 'downloading', version, percent: 0 })
      try {
        await updater.downloadUpdate()
      } catch (error) {
        fail(error)
      }
    },
    install: () => updater.quitAndInstall()
  }
}
