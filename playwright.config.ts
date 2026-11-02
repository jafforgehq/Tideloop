import { defineConfig } from '@playwright/test'

// One worker: tests share the fixed MCP port and each opens a real window.
export default defineConfig({ testDir: 'e2e', workers: 1, timeout: 45_000, reporter: 'list', retries: process.env.CI ? 1 : 0 })
