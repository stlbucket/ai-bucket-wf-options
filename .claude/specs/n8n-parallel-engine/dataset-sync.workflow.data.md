---
name: n8n-dataset-sync-workflows
description: The n8n-sync-breweries and n8n-sync-airports workflows — parallel n8n twins of the live agentic dataset syncs (distinct keys, agentic untouched), with the n8n_worker grant expansion in the owning db packages and the dual-engine in_progress rework of the two sync-status functions.
metadata:
  type: reference
---

## Status
**Updated 2026-07-20 — `sync-airports` moved to n8n** (user decision, plan
`0016__wf________sync-airports-engine-move_______`): the airports twin was rekeyed to the
production `sync-airports` key (webhook path, `begin_run`, guard both-engines-same-key) and
the registry entry flipped to `engine: 'n8n', permission: null` — the datasets-UI **Sync
airports** button now runs on n8n with zero UI changes. Repo file renamed
`n8n/workflows/sync-airports.json` (same n8n id); the agentic definition stays in the tree
**dormant** (unreachable via the registry — the one-line rollback). `n8n-sync-airports` no
longer exists as a key. Breweries is unchanged: agentic on the UI path, twin behind wf-n8n.

**Implemented 2026-07-19** (plan `0015__wf________n8n-dataset-sync-twins__________`, decisions
locked the same day: **parallel new keys**, **manual trigger only**). Both workflows built via
the n8n public API + `n8n-cli`, exported active to `n8n/workflows/*.json`, and verified live:
breweries 11,750 rows / 59 pages (re-run idempotent: `updated: 11750, inserted: 0`); airports
6 files / 85,758 airports / 48,121 runways, second run all-`{skipped: true}` via etag; guard
blocks `begin_run` while the other engine's key is running; dual-engine `in_progress` proves
out on `brewery_sync_status`; kill-path (404 source) → error-handler → terminal `error` row
with `lastNodeExecuted`. The agentic syncs stay live and untouched.

**Build corrections (2026-07-19, authoritative where they differ from the body below):**
- **`saveDataSuccessExecution: 'none'`** (+ `saveDataErrorExecution: 'all'`) on both workflows:
  persisting the airports execution log (85k Extract-CSV items) crashed the n8n process
  *after* `complete_run` — the run row was correct, but n8n restarted and marked the execution
  `crashed`. Successful executions are not saved; errored ones are (that's when the editor log
  matters).
- **Node retry wait is 5 s, not 10 s** — n8n caps `waitBetweenTries` at 5000 ms.
- **Failure-policy refinement (airports):** the parent-stop/child-continue routing applies to
  the *fetch/parse* stages (Fetch File, Extract CSV — `onError: continueErrorOutput` → the
  File Failed collector, parent failure sets a static-data abort flag that short-circuits
  remaining files). **DB-stage failures** (upserts, `record_sync_source`) keep
  `stopWorkflow` → error-handler → terminal `error` row — a DB error is systemic, not a
  per-file transient, and per-item error routing on multi-chunk Postgres nodes would double-
  fire the loop.
- Loop mechanics: `splitInBatches` v3 `done` output emits the items fed back to its input —
  the per-page / per-file result items — which is what `Sum Results` / `Assemble Results`
  consume. The HTTP node splits array responses into items, so a Code node re-packages each
  breweries page into one `{ breweries: [...] }` item before the single-param jsonb upsert.

**Earlier correction (pre-build):** the cross-engine guard does **not**
grant `agent_fn.running_count` to `n8n_worker` — no `revoke … from public` exists anywhere, so
`_fn` functions keep Postgres's default PUBLIC execute and **schema USAGE is the only gate**
(issue `0020__security__fn-schema-grant-bypass`); granting `usage on agent_fn` would open the
whole schema. Instead the guard is a SECURITY DEFINER helper **`n8n_fn.dataset_sync_busy(
_agent_workflow_key citext, _n8n_workflow_key citext) → int`** (sum of both engines'
`running_count`), added to `db/fnb-n8n`'s `00000000011210_n8n_fn` change (sqitch dep
`fnb-agent:00000000011110_agent_fn`) — already covered by the existing execute-all-of-`n8n_fn`
grant. The guard/DB sections below are updated accordingly.

---

## Overview

Two new n8n workflows, built in the editor (Phase 8) and exported to the repo via the
workflow-as-code loop (`n8n/workflows/*.json`, reproduced by the `n8n-import` one-shot,
**exported active** — the boot import publishes by id):

| Key | File | Source | Mirrors (agentic) |
|---|---|---|---|
| `n8n-sync-breweries` | `n8n/workflows/n8n-sync-breweries.json` | Open Brewery DB API (`breweries-expert` skill) | `apps/agent-app/server/lib/agent-workflows/sync-breweries.ts` + `agent-tools/breweries.ts` |
| `n8n-sync-airports` | `n8n/workflows/n8n-sync-airports.json` | OurAirports CSVs (`airports-expert` skill) | `apps/agent-app/server/lib/agent-workflows/sync-airports.ts` + `agent-tools/airports.ts` |

Both are **fixed sequential ETL** — the workload class this spec's Purpose reserved for n8n.
Same target tables, same idempotent upsert functions, same source mechanics (pagination /
etag conditional-GET) as the agentic twins. Both set **Error Workflow → `error-handler`**
(the shared terminal-error path, `exerciser.workflow.data.md`).

Input contract (webhook body, injected by the trigger plugin): `{ tenantId?, profileId? }` —
no workflow-specific input (parity with the agentic empty `inputSchema`). Recorded on the run
row via `begin_run`; otherwise unused.

## Trigger surface

Registry entries (`_shared.data.md` → engine registry):

```ts
'n8n-sync-breweries': { engine: 'n8n', permission: 'p:app-admin-super' },
'sync-airports': { engine: 'n8n', permission: null }  // moved 2026-07-20 (§Status) — the UI key
```

**Permission is `p:app-admin-super`** (spec default, not a user decision): the agentic keys
remain the production any-authenticated path behind the datasets pages' Sync buttons
(`useBreweries.ts` / `useAirports.ts` trigger `sync-breweries` / `sync-airports` — unchanged);
the n8n twins are operator-triggered from the site-admin wf-n8n page. Loosening later is a
one-line registry edit. Manual only — **no Schedule Trigger node** (user decision 2026-07-19;
scheduling stays a deferred open question in the README).

## Cross-engine dataset guard

The agentic twins are `singleton: true` (harness-enforced via `agent_fn.running_count`). The
n8n twins guard at **dataset level, across both engines**: the first Postgres node after the
webhook checks

```sql
select n8n_fn.dataset_sync_busy('<agentic-key>', '<n8n-key>') as busy
```

and an IF node ends the execution cleanly (no `begin_run`, no run row) when `busy > 0`. This
prevents interleaved double-syncs of the same dataset; the upserts are idempotent so a race
through the guard is harmless. The agentic harness is **not** taught about n8n runs
(asymmetric by design — zero agentic blast radius). `dataset_sync_busy` is a SECURITY DEFINER
`n8n_fn` helper (see the pre-build correction — no cross-schema grant to `n8n_worker`).

## Workflow: `n8n-sync-breweries`

```
Webhook (POST, path n8n-sync-breweries, Header-Auth fnb-webhook-secret, respond: immediately)
 ─▶ Postgres: cross-engine guard ─▶ IF busy > 0 ──true─▶ (end, no run row)
 ─▶ Postgres: begin_run('n8n-sync-breweries', {{ $execution.id }}, body, tenantId) → runId
 ─▶ HTTP Request: GET https://api.openbrewerydb.org/v1/breweries/meta  (retryOnFail 3 / 10s)
 ─▶ Code: total → items [{ page: 1..ceil(total/200) }]
 ─▶ Loop Over Items (batch size 1 — strictly sequential; the source is volunteer-run,
    never parallel, never skip ahead):
      HTTP Request: GET /breweries?page={{ $json.page }}&per_page=200  (retryOnFail 3 / 10s)
      Postgres: select to_jsonb(location_datasets_fn.upsert_breweries($1::jsonb)) as result
                -- the page array as ONE queryReplacement expression (exerciser correction)
 ─▶ Code: sum inserted/updated across pages
 ─▶ Postgres: complete_run(runId, { total, pagesFetched, inserted, updated })
```

- ~59 pages today at 200/page; page arrays flow through node data (small), rows never leave
  the PG upsert.
- **Failure semantics differ from the agentic twin (accepted):** a page failing after retries
  fails the execution → `error-handler` → terminal `error` run row. The agentic version
  instead stops and `complete_run`s a partial report — that stop-vs-continue judgment is the
  agent's; n8n has no judgment layer. Pages already upserted stay (idempotent).
- n8n `retryOnFail` is status-blind (retries 4xx too, unlike the agentic tool's 5xx-only
  retry) — accepted deviation, 3 tries / 10 s wait.

## Workflow: `n8n-sync-airports`

```
Webhook (POST, path n8n-sync-airports, Header-Auth fnb-webhook-secret, respond: immediately)
 ─▶ Postgres: cross-engine guard ─▶ IF busy > 0 ──true─▶ (end, no run row)
 ─▶ Postgres: begin_run('n8n-sync-airports', {{ $execution.id }}, body, tenantId) → runId
 ─▶ Code: the file list, dependency order, with isParent flags:
      countries.csv, regions.csv, airports.csv        (parents)
      runways.csv, airport-frequencies.csv, navaids.csv  (children)
 ─▶ Loop Over Items (batch size 1) — per file:
      Postgres: select etag from airports.sync_source where file = {{ $json.file }}
      HTTP Request: GET https://davidmegginson.github.io/ourairports-data/{{ file }}
                    If-None-Match: <stored etag>; full response + never-error (304 must not throw)
      IF status 304 ──true─▶ record { skipped: true } → next file
      Extract From File (CSV, header row) → row items          ← RFC-4180 parse, no Code-node csv lib
      Code: per-file coercion map + chunk into 1000-row jsonb arrays
            -- the SAME maps as agent-tools/airports.ts: '' → null, int/float coercion,
            -- scheduled_service yes→bool, lighted/closed '1'→bool, and the header quirks
            -- (le/he_heading_degT, usageType)
      Loop chunks ─▶ Switch(file) ─▶ one static Postgres node per file:
            airports_fn.upsert_countries|regions|airports|runways|airport_frequencies|navaids($1::jsonb)
      Postgres: airports_fn.record_sync_source(file, etag, last-modified, rowCount)
      Code: record { inserted, updated, skipped } for the file
 ─▶ Code: assemble the per-file result map
 ─▶ Postgres: complete_run(runId, { files: { <file>: {skipped}|{inserted,updated}|{failed} } })
```

- **Failure policy (parity with the agentic goal, as fixed routing):** per-file pipeline nodes
  use `onError: continue (error output)` routed to a collector — a **parent** file failure
  records `{ failed }` and **skips all remaining files** (children would upsert against
  missing parents); a **child** failure records `{ failed }` and **continues**. Either way the
  run finishes via `complete_run` with the per-file map (run `success` with failures listed —
  same shape as the agentic report). Failures outside the routed paths fall through to
  `error-handler`.
- Six **static** Postgres upsert nodes behind a Switch — not one node with an expression-built
  function name (no SQL identifiers from expressions; rejected below).
- `airports.csv` is ~85k rows / ~13 MB — fine in n8n's in-memory item model at self-host
  defaults; chunking (1000) bounds each PG call, matching the agentic CHUNK_SIZE.
- Etag hit on every file = a run whose result map is all `{ skipped: true }` — success, ~free.

## DB changes (no new package — edit-in-place, dev rebuild)

`fnb-n8n` deploys **before** `fnb-location-datasets` and `fnb-airports` (CLAUDE.md deploy
order), so `n8n_worker` exists when their grants run — grants live in the **owning module's
package**, exactly where the `agent_worker` grants live. All cross-package deps via
`sqitch-expert` at implementation.

| Change (edit-in-place) | Addition |
|---|---|
| `db/fnb-n8n/deploy/00000000011210_n8n_fn.sql` | New `n8n_fn.dataset_sync_busy(citext, citext) → int` (cross-engine guard — Status correction); + sqitch dep `fnb-agent:00000000011110_agent_fn`; verify-file line |
| `db/fnb-location-datasets/deploy/00000000010710_location_datasets_fn.sql` | `n8n_worker` grants alongside the `agent_worker` block: `USAGE` on `location_datasets`, `location_datasets_fn`; `EXECUTE upsert_breweries(jsonb)`. **`brewery_sync_status`**: `in_progress := agent_fn.running_count('sync-breweries') > 0 or n8n_fn.running_count('n8n-sync-breweries') > 0;` + sqitch dep `fnb-n8n:00000000011230_n8n_policies` |
| `db/fnb-airports/deploy/00000000010810_airports_fn.sql` | `n8n_worker` grants alongside the `agent_worker` block: `USAGE` on `airports`, `airports_fn`; `SELECT` on `airports.sync_source` (etag read); `EXECUTE` on the six `upsert_*(jsonb)` fns + `record_sync_source`. **`airport_sync_status`**: `in_progress := agent_fn.running_count('sync-airports') > 0 or n8n_fn.running_count('n8n-sync-airports') > 0;` + sqitch dep `fnb-n8n:00000000011230_n8n_policies` |

The `syncStatus` GraphQL shapes are unchanged — `in_progress` simply means "either engine is
syncing this dataset" now. No codegen, no composable, no page change (the datasets pages'
Sync buttons keep triggering the agentic keys).

## Feature mapping (vs the agentic syncs — comparison record)

| Concern | agentic `sync-breweries`/`sync-airports` | n8n twins |
|---|---|---|
| Sequencing | goal prompt + agent judgment | Loop Over Items batch 1 (structural) |
| Singleton | harness `singleton: true` (own engine only) | cross-engine guard node (both engines) |
| Page/file retry | tool code, 5xx-only, 3×/10s | node `retryOnFail`, status-blind, 3×/10s |
| Partial failure | agent judgment: breweries stop+report; airports parent-stop/child-continue | breweries: terminal `error` via error-handler; airports: same parent/child policy as fixed routing |
| CSV parse | `csv-parse` in tool code | Extract From File node |
| Field coercions | `FILES` map in `agent-tools/airports.ts` | same map, in a Code node |
| Run log | `agent.workflow_run` (harness writes) | `n8n.workflow_run` (explicit PG nodes + error-handler) |
| Trigger gate | `permission: null` (datasets UI) | `p:app-admin-super` (operator surface) |

## Verification (after build; read-only beyond the triggers)

1. `n8n-sync-breweries` from the wf-n8n page (or GraphiQL) → run row `running` → `success`;
   `result_data.total` matches `GET /breweries/meta`; `location_datasets.brewery` count sane.
2. `n8n-sync-airports` first run → `success`, per-file map with counts; **second run
   immediately after** → all `{ skipped: true }` (etag round-trip through `sync_source` works
   under `n8n_worker`).
3. Guard: trigger `n8n-sync-breweries` while a `sync-breweries` agentic run is `running` →
   webhook 200 (respond-immediately) but **no new run row**; and vice-versa direction is
   accepted-unguarded (agentic harness unchanged — expected).
4. During an n8n sync run, the datasets page shows `in_progress` (Sync button disabled state) —
   the dual-engine OR works; after completion it clears.
5. Kill-path: stop the source mid-run (or point at a bad URL in the editor) → error-handler →
   terminal `error` row with the failing node in the error jsonb.
6. Boot-import loop: after export, a fresh rebuild reproduces both workflows **active** with
   credentials bound (same check as the exerciser).

## Considered & rejected

| Alternative | Why rejected |
|---|---|
| Moving `sync-breweries`/`sync-airports` to n8n (registry flip) | User decision 2026-07-19: parallel keys; agentic stays the production path, zero blast radius |
| Schedule Trigger (nightly) | User decision 2026-07-19: manual only — scheduling stays deferred |
| Any-authenticated trigger permission (parity with agentic keys) | The twins are operator tools on the wf-n8n page; the datasets UI keeps the agentic path. One-line loosening later |
| One Postgres node with expression-built `airports_fn.<fn>` name | SQL identifiers from expressions — Switch + six static nodes is reviewable and injection-shaped-risk-free |
| Code-node `csv-parse` | External modules are disabled in the official image (`NODE_FUNCTION_ALLOW_EXTERNAL` unset — locked: no custom image); Extract From File is native |
| Teaching the agentic harness the reverse guard | Violates the zero-agentic-blast-radius invariant for a race the idempotent upserts already tolerate |
