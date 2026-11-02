import type { Action, McpInfo, PlannerData, UpdateStatus } from './types'

export interface AppInfo {
  version: string
  notice: string | null
  dataFile: string
}

export type MenuCommand = 'undo' | 'redo' | 'new-todo' | 'new-event' | 'settings' | 'today' | 'previous' | 'next' | 'view-week' | 'view-month'

/** Everything the window may ask of the main process. Exposed as `window.tideloop`. */
export interface TideloopApi {
  getState(): Promise<PlannerData>
  /** Resolves with an error message rather than rejecting, so bad input is an ordinary result. */
  dispatch(action: Action): Promise<string | null>
  undo(): Promise<void>
  redo(): Promise<void>
  appInfo(): Promise<AppInfo>
  ready(): void
  setNativeTheme(source: 'system' | 'light' | 'dark', background: string): void
  revealData(): void
  update: {
    status(): Promise<UpdateStatus>
    check(): Promise<void>
    download(): Promise<void>
    install(): Promise<void>
  }
  mcp: {
    info(): Promise<McpInfo>
    copyCommand(): Promise<void>
    regenerate(): Promise<void>
  }
  onState(fn: (state: PlannerData) => void): () => void
  onUpdate(fn: (status: UpdateStatus) => void): () => void
  onMcp(fn: (info: McpInfo) => void): () => void
  onMenu(fn: (command: MenuCommand) => void): () => void
  onNotice(fn: (message: string) => void): () => void
}
