// Embeds the built engine bundle into the game-event workflow's Code nodes
// (.claude/specs/game-server/infrastructure.md §1). Deliberately dumb: esbuild-bundle the
// library as a self-contained IIFE (the n8n Code-node sandbox has no require of repo
// code), append the per-node glue, JSON-parse n8n/workflows/game-event.json, replace the
// jsCode of the nodes named `referee` and `parse-agent-move`, write back. Fails loudly if
// a node is missing. Never hand-edit jsCode — always re-run this script.

import { build } from 'esbuild'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const pkgRoot = resolve(here, '..')
const workflowPath = resolve(pkgRoot, '../../n8n/workflows/game-event.json')

// Bundles src/n8n-embed.ts (NOT src/index.ts) — a dedicated entry that assigns plain data
// properties to globalThis.GameEngines. esbuild's normal `export *` re-export getters did
// not survive n8n's Code-node sandbox in testing ("GameEngines.runReferee is not a
// function" even once the object reached globalThis) — plain assignment sidesteps whatever
// proxy/descriptor handling the sandbox does.
const bundle = await build({
  entryPoints: [resolve(pkgRoot, 'src/n8n-embed.ts')],
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'neutral',
  target: 'es2022',
  // fnb-types is type-only for this package — imports erase; nothing external remains
})
const lib = bundle.outputFiles[0].text

// n8n Code node ("Run once for all items") glue. The webhook payload rides item[0].json
// alongside the engine_context row from the previous PG node (see the workflow spec).
const REFEREE_GLUE = `
const item = $input.first().json;
const ctx = item.engine_context ?? item.engineContext ?? item;
const op = $('Webhook').first().json.body?.op ?? 'event';
const result = globalThis.GameEngines.runReferee(ctx, op);
return [{ json: { context: ctx, result } }];
`

const PARSE_AGENT_GLUE = `
const item = $input.first().json;
const prior = $('referee').first().json;
const text = (item.content ?? []).map((c) => c.text ?? '').join('\\n');
const result = globalThis.GameEngines.completeAgentMove(prior.context, prior.result, text);
return [{ json: { context: prior.context, result } }];
`

const nodeCode = {
  referee: `${lib}\n${REFEREE_GLUE}`,
  'parse-agent-move': `${lib}\n${PARSE_AGENT_GLUE}`,
}

if (!existsSync(workflowPath)) {
  console.error(`embed: ${workflowPath} does not exist yet (Phase 3 exports it). Bundle builds cleanly; nothing embedded.`)
  process.exit(1)
}

const workflow = JSON.parse(readFileSync(workflowPath, 'utf8'))
for (const [name, code] of Object.entries(nodeCode)) {
  const node = (workflow.nodes ?? []).find((n) => n.name === name)
  if (!node) {
    console.error(`embed: node '${name}' not found in ${workflowPath}`)
    process.exit(1)
  }
  node.parameters = node.parameters ?? {}
  node.parameters.jsCode = code
}
writeFileSync(workflowPath, JSON.stringify(workflow, null, 2) + '\n')

const hash = createHash('sha256').update(lib).digest('hex').slice(0, 16)
console.log(`embed: wrote referee + parse-agent-move jsCode (bundle sha256 ${hash}) into ${workflowPath}`)
