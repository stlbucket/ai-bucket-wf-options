---
name: agentic-dataset-sync-workflows
description: Agentic conversion of the sync-breweries and sync-airports dataset workflows — macro tools for the deterministic fetch/upsert work, agent-owned sequencing, partial-failure judgment, and result summarization.
metadata:
  type: reference
---

## Status
**Implemented 2026-07-17** — both syncs verified live (breweries 11,745 rows / 59 pages ≈ 18¢;
airports 6 files / 85,752 airports ≈ 1.5¢, second run all-skipped via etag/304). Corrections
from the build:
- **sync-breweries `maxTurns` is 90, not 60** — strictly-sequential paging means ≥ pages+2
  turns; 60 errored at the cap with all data landed (upsert idempotency held).
- **Goals must not ask for timestamps** (no `syncedAt` in resultData) — the agent has no clock
  and went hunting for a Bash tool; the run row's `finished_at` is the timing record. This is
  also what surfaced the `tools: []` toolbox-closure requirement (`_shared.data.md`).

Cross-reference 2026-07-19: parallel n8n twins were specced in
`.claude/specs/n8n-parallel-engine/dataset-sync.workflow.data.md`; the one shared surface is
the sync-status fns' `in_progress`, which became a dual-engine OR there.
**2026-07-20: `sync-airports` moved to the n8n engine** (registry flip; that spec's §Status).
The agentic `sync-airports` definition + `sync_airport_file` tool below remain in the tree but
are **dormant** — unreachable via the registry, kept as the one-line rollback. The agentic
`sync-breweries` stays live on the UI path.

---

## Trigger path (both)

Datasets tool "Sync now" → `useBreweries.queueSync()` / `useAirports.queueSync()` → the new
`triggerWorkflow` mutation (`_shared.data.md`) with keys `sync-breweries` / `sync-airports`
(allow-map: any authenticated user — parity with the retired `wf_api.queue_workflow` gate) →
POST `${AGENT_INTERNAL_URL}/api/trigger/<key>`. Composable public API and pages: unchanged (R1).
The polling loop in the composables keeps working because `brewerySyncStatus` /
`airportSyncStatus` keep their GraphQL shape — their `in_progress` now reads
`agent_fn.running_count('<key>') > 0` (rework specced in `_shared.data.md`).

Both definitions set `singleton: true` — the trigger route suppresses a second fire while one
runs (`_shared.data.md` → Trigger contract). Scheduled (nightly) syncs would be one croner line
but are **not in scope** — both stay manual-trigger-only, matching today.

**Macro-tool principle (locked):** the deterministic per-page / per-file work — HTTP fetch, CSV
parse, chunked upsert — lives *inside* tools; bulk rows never enter the model context and no
model turn is spent on mechanical iteration steps smaller than a page/file. The agent owns:
sequencing, dependency-aware partial-failure handling, and the result summary. This is what
keeps an agentic sync within cents (`_shared.data.md` → Cost model).

---

## Workflow: `sync-breweries` (`agent-workflows/sync-breweries.ts`)

Source behavior inherited from the retired handler (and `breweries-expert`): Open Brewery DB,
`per_page=200`, volunteer-run API → **pages walked sequentially, never in parallel**.

Definition: `inputSchema` `{}` (tenant/profile arrive from the plugin payload; unused beyond
the run row); `maxTurns: 60` (≈ pages + overhead); `singleton: true`.

### Toolbox

| Tool | Deterministic behavior | Returns |
|---|---|---|
| `get_breweries_meta` | HTTP GET `/breweries/meta` | `{ total, pages }` (pages = ceil(total/200)) |
| `sync_breweries_page` | HTTP GET `/breweries?page=N&per_page=200` (internal `retryOnFail`-equivalent: 3 tries, 10s on network/5xx; no retry on 4xx) → `location_datasets_fn.upsert_breweries(payload)` — same jsonb payload and fn as today, already SECURITY DEFINER, granted to `agent_worker` | `{ page, fetched, inserted, updated }` — never the rows |
| `complete_run` | harness-injected | — |

### Goal prompt (orchestration the agent owns)

> Sync the Open Brewery DB dataset. Call `get_breweries_meta`, then `sync_breweries_page` for
> pages 1..N **strictly sequentially** (the source API is volunteer-run — never parallel). If a
> page fails after the tool's own retries, stop and finish with `complete_run` reporting the
> pages completed and the failure (partial pages already upserted are fine — the upsert is
> idempotent, same as today). On success finish with
> `complete_run({ total, pagesFetched, inserted, updated, syncedAt })`.

Any unhandled failure → harness `error_run` (status query then reports not-running).

---

## Workflow: `sync-airports` (`agent-workflows/sync-airports.ts`)

Source behavior inherited from the retired handler (and `airports-expert`): OurAirports bulk
CSVs fetched per file with **etag conditional-GET** (`airports.sync_source`), parsed, and
upserted in chunks via the per-file `airports_fn.upsert_*` functions, recording
`airports_fn.record_sync_source` after each file.

Definition: `inputSchema` `{}`; `maxTurns: 25`; `singleton: true`.

### Toolbox

| Tool | Deterministic behavior | Returns |
|---|---|---|
| `sync_airport_file` | For one named file: read etag from `airports.sync_source` → HTTP GET with `If-None-Match` → on 304 return skipped → parse CSV (RFC-4180; quirks already absorbed by the `_fn` layer — consult `airports-expert` at implementation) → chunked `airports_fn.upsert_<file>(payload)` batches (handler-internal loop, batch size from the retired handler) → `airports_fn.record_sync_source(file, etag, …)` | `{ file, skipped: true }` or `{ file, inserted, updated, chunks }` |
| `complete_run` | harness-injected | — |

### Goal prompt (orchestration the agent owns)

> Sync the OurAirports dataset. Call `sync_airport_file` once per file **in this order**:
> countries, regions, airports, runways, frequencies, navaids, … (exact list/order lifted from
> the retired handler at implementation time — dependency order matters: countries → regions →
> airports → child files). If a **parent** file (countries, regions, airports) fails, stop —
> children would upsert against missing parents; report what completed. If a **child** file
> fails, record the failure and continue with the remaining files. Finish with
> `complete_run` carrying the per-file map `{ skipped | inserted, updated | failed }` +
> `syncedAt`.

The parent-vs-child failure policy is the genuinely agentic part — the retired handler aborted
on any failure; the goal prompt states the policy and the agent applies it per-file. Everything
mechanical stays in the tool.

---

## Template seeds retired

`db/seed.sql`'s `sync-breweries` / `sync-airports` wf-template upserts (and the `wf-exerciser`
seed) are removed — workflow definitions now live in
`apps/agent-app/server/lib/agent-workflows/`. Inventory: `decommission.data.md`.
