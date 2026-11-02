import { defineConfig } from 'vite'

// Builds the public page into site/, which scripts/deploy-page.sh publishes.
export default defineConfig({ root: 'page', base: './', build: { outDir: '../site', emptyOutDir: true } })
