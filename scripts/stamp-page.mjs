// Fills in the released version, or swaps the download buttons for a note when nothing is released yet.
// Usage: node scripts/stamp-page.mjs site/index.html 0.0.1
import { readFileSync, writeFileSync } from 'node:fs'

const [file, given] = process.argv.slice(2)
// Anything but a plain version counts as no release, so a failed lookup can never offer dead download links.
const version = /^\d+\.\d+\.\d+/.test(given ?? '') ? given : ''
const block = (name) => new RegExp(`<!-- ${name} -->[\\s\\S]*?<!-- /${name} -->\\s*`, 'g')
const html = readFileSync(file, 'utf8')
  .replace(block(version ? 'if-unreleased' : 'if-released'), '')
  .replaceAll('__VERSION__', version)
writeFileSync(file, html)
