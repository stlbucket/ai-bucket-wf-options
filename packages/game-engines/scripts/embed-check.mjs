// Prints 'in-sync' when re-running the embed would not change n8n/workflows/game-event.json
// (the vitest drift alarm shells out to this). Same bundling as embed.mjs, no writes.
import { build } from 'esbuild'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const pkgRoot = resolve(here, '..')
const workflowPath = resolve(pkgRoot, '../../n8n/workflows/game-event.json')

if (!existsSync(workflowPath)) {
  console.log('missing-workflow')
  process.exit(0)
}

const bundle = await build({
  entryPoints: [resolve(pkgRoot, 'src/n8n-embed.ts')],
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'neutral',
  target: 'es2022',
})
const lib = bundle.outputFiles[0].text

const workflow = JSON.parse(readFileSync(workflowPath, 'utf8'))
const ok = ['referee', 'parse-agent-move'].every((name) => {
  const node = (workflow.nodes ?? []).find((n) => n.name === name)
  return node?.parameters?.jsCode?.startsWith(lib)
})
console.log(ok ? 'in-sync' : 'drift')
