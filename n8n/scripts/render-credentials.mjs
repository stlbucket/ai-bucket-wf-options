// Renders n8n credential templates for the n8n-import one-shot (infrastructure spec:
// .claude/specs/n8n-parallel-engine/infrastructure.md). The stock n8n image has no gettext,
// so ${ENV_VAR} substitution runs on the image's own node. Values are JSON-string-escaped so
// secrets containing quotes/backslashes cannot break the rendered JSON. Rendered files land
// outside the repo mount and are never committed.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'

const [, , inDir = '/import/credentials', outDir = '/tmp/creds'] = process.argv

mkdirSync(outDir, { recursive: true })
const templates = readdirSync(inDir).filter((f) => f.endsWith('.json.tpl'))
if (templates.length === 0) {
  console.error(`no *.json.tpl templates found in ${inDir}`)
  process.exit(1)
}

for (const file of templates) {
  const rendered = readFileSync(join(inDir, file), 'utf8').replace(
    /\$\{([A-Z0-9_]+)\}/g,
    (_match, name) => {
      const value = process.env[name]
      if (value === undefined) {
        console.error(`missing env var ${name} (referenced by ${file})`)
        process.exit(1)
      }
      return JSON.stringify(value).slice(1, -1)
    },
  )
  JSON.parse(rendered) // fail fast on malformed output before n8n sees it
  const outFile = join(outDir, basename(file, '.tpl'))
  writeFileSync(outFile, rendered)
  console.log(`rendered ${file} -> ${outFile}`)
}
