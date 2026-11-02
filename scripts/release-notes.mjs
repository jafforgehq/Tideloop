// Prints the CHANGELOG.md section for a version. Fails if it is missing, so no release ships without notes.
// Usage: node scripts/release-notes.mjs 0.0.1
import { readFileSync } from 'node:fs'

const version = process.argv[2]
const sections = readFileSync('CHANGELOG.md', 'utf8').split(/^## /m).slice(1)
const section = sections.find((s) => s.startsWith(`${version}\n`) || s.startsWith(`${version} `))
if (!section) {
  console.error(`CHANGELOG.md has no section for ${version}`)
  process.exit(1)
}
console.log(section.slice(section.indexOf('\n') + 1).trim())
