import { z } from 'zod'
import { getBreweriesMeta, syncBreweriesPage } from '../agent-tools/breweries'
import type { AgentWorkflowDefinition } from './types'

// Agentic conversion of the sync-breweries dataset workflow (dataset-sync.workflow.data.md).
// The agent owns sequencing and the stop-on-failure judgment; every mechanical step is a tool.

const inputSchema = z.object({}) // tenant/profile arrive from the plugin payload; unused beyond the run row

export const syncBreweries: AgentWorkflowDefinition<z.infer<typeof inputSchema>> = {
  key: 'sync-breweries',
  inputSchema,
  // ~59 pages today, strictly one sequential page-fetch per turn + meta + complete_run — 60
  // proved one turn short (run errored at the cap with all data landed). 90 leaves headroom
  // for dataset growth and per-page retries.
  maxTurns: 90,
  singleton: true,
  tools: [getBreweriesMeta, syncBreweriesPage],
  goal: () => `Sync the Open Brewery DB dataset into fnb.

1. Call get_breweries_meta to learn the total and page count N.
2. Call sync_breweries_page for pages 1 through N STRICTLY SEQUENTIALLY — the source API is
   volunteer-run; never fetch pages in parallel and never skip ahead.
3. If a page fails after the tool's own retries, STOP fetching and finish with complete_run
   reporting the pages completed and the failure. Partial pages already upserted are fine —
   the upsert is idempotent.
4. On success finish with complete_run({ total, pagesFetched, inserted, updated }) where
   inserted/updated are the sums across pages. (No timestamps — the run log records timing.)`
}
