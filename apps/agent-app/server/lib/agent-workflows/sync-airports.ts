import { z } from 'zod'
import { AIRPORT_FILE_ORDER, syncAirportFile } from '../agent-tools/airports'
import type { AgentWorkflowDefinition } from './types'

// Agentic conversion of the sync-airports dataset workflow (dataset-sync.workflow.data.md).
// The genuinely agentic part is the dependency-aware partial-failure policy in the goal —
// the retired handler aborted on ANY failure; here the agent applies parent-vs-child judgment.

const inputSchema = z.object({}) // tenant/profile arrive from the plugin payload; unused beyond the run row

export const syncAirports: AgentWorkflowDefinition<z.infer<typeof inputSchema>> = {
  key: 'sync-airports',
  inputSchema,
  maxTurns: 25,
  singleton: true,
  tools: [syncAirportFile],
  goal: () => `Sync the OurAirports dataset into fnb.

Call sync_airport_file once per file, IN THIS EXACT ORDER (dependency order — parents first):
${AIRPORT_FILE_ORDER.map((f, i) => `${i + 1}. ${f}`).join('\n')}

Failure policy — apply per file:
- PARENT files (countries.csv, regions.csv, airports.csv): if one fails, STOP — the remaining
  files would upsert against missing parents. Report what completed.
- CHILD files (runways.csv, airport-frequencies.csv, navaids.csv): if one fails, record the
  failure and CONTINUE with the remaining files.
A result of { skipped: true } means the file was unchanged upstream (etag hit) — that is
success, keep going.

Finish with complete_run whose resultData carries a per-file map — for each file either
{ skipped: true }, { inserted, updated }, or { failed: "<reason>" }. (No timestamps — the
run log records timing.)`
}
