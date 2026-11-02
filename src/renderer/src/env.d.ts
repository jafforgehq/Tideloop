import type { TideloopApi } from '../../shared/ipc'

declare global {
  interface Window {
    tideloop: TideloopApi
  }
}
