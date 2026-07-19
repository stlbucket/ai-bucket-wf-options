import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { toolResult } from '../agent-workflows/types'
import { agentWorkerQuery } from './pg'

// Macro tools for sync-breweries (dataset-sync.workflow.data.md): the deterministic per-page
// work — HTTP fetch, retry, jsonb upsert — lives here; rows NEVER enter the model context.
// Public API, no key (.claude/skills/breweries-expert/SKILL.md). Volunteer-run — the goal
// prompt forbids parallel page fetches; sequencing is the agent's job, mechanics are ours.
const BASE_URL = 'https://api.openbrewerydb.org/v1'
const PER_PAGE = 200
const FETCH_RETRIES = 3
const FETCH_BACKOFF_MS = 10_000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// retryOnFail-equivalent: 3 tries / 10s on network errors and 5xx; NO retry on 4xx.
async function fetchWithRetry(url: string): Promise<Response> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= FETCH_RETRIES; attempt++) {
    try {
      const response = await fetch(url)
      if (response.ok) return response
      if (response.status < 500) {
        throw new Error(`request failed (no retry on 4xx): ${response.status} ${response.statusText}`)
      }
      lastErr = new Error(`request failed: ${response.status} ${response.statusText}`)
    } catch (e) {
      if (e instanceof Error && e.message.includes('no retry on 4xx')) throw e
      lastErr = e
    }
    if (attempt < FETCH_RETRIES) await sleep(FETCH_BACKOFF_MS)
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

export const getBreweriesMeta = tool(
  'get_breweries_meta',
  'Get the Open Brewery DB dataset size: total breweries and the number of 200-per-page pages.',
  {},
  async () => {
    const response = await fetchWithRetry(`${BASE_URL}/breweries/meta`)
    const meta = await response.json()
    const total = Number(meta.total)
    return toolResult({ total, pages: Math.ceil(total / PER_PAGE) })
  }
)

export const syncBreweriesPage = tool(
  'sync_breweries_page',
  'Fetch ONE page of breweries (200 per page) and upsert it into the dataset. ' +
    'Returns counts only — never rows. The upsert is idempotent.',
  { page: z.number().int().min(1) },
  async ({ page }) => {
    const response = await fetchWithRetry(`${BASE_URL}/breweries?page=${page}&per_page=${PER_PAGE}`)
    const breweries = await response.json()
    if (!Array.isArray(breweries)) {
      throw new Error(`breweries page ${page}: unexpected non-array response`)
    }
    if (breweries.length === 0) {
      return toolResult({ page, fetched: 0, inserted: 0, updated: 0, note: 'empty-page' })
    }
    const upsert = (
      await agentWorkerQuery<{ result: { inserted: number; updated: number } }>(
        'select to_jsonb(location_datasets_fn.upsert_breweries($1::jsonb)) as result',
        [JSON.stringify(breweries)]
      )
    ).rows[0]!.result
    return toolResult({
      page,
      fetched: breweries.length,
      inserted: upsert.inserted,
      updated: upsert.updated
    })
  }
)
