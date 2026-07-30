---
name: n8n-dataset-sync-workflows
description: n8n conversion of the sync-breweries and sync-airports dataset workflows — webhook-triggered, paginated/etag-aware fetch, chunked upsert via the existing _fn functions, run-log status.
metadata:
  type: reference
---

## Status
Draft. Converts the two Datasets-module sync workflows. The `_fn` upsert layer, the GraphQL
status surface, and the Datasets tool pages are **unchanged**; only the engine and the
`in_progress` derivation change.

---

## Trigger path (both)

Datasets tool "Sync now" → `useBreweries.queueSync()` / `useAirports.queueSync()` → the new
`triggerWorkflow` mutation (`_shared.data.md`) with keys `sync-breweries` / `sync-airports`
(allow-map: any authenticated user — parity with the retired `wf_api.queue_workflow` gate) →
POST `${N8N_INTERNAL_URL}/webhook/<key>`. Composable public API and pages: unchanged (R1).
The polling loop in the composables keeps working because `brewerySyncStatus` /
`airportSyncStatus` keep their GraphQL shape — their `in_progress` now reads
`n8n_fn.running_count('<key>') > 0` (rework specced in `_shared.data.md`).

A Schedule Trigger for nightly syncs becomes trivially possible but is **not in scope** — both
workflows stay manual-trigger-only, matching today.

Concurrency guard (new, both workflows): immediately after `begin_run`, an IF on
`n8n_fn.running_count(<key>) > 1` short-circuits to `complete_run({ skipped: 'already running' })`
— the old engine had no guard, but the run log makes double-fires visible and cheap to suppress.

---

## Workflow: `sync-breweries` (`n8n/workflows/sync-breweries.json`)

Source behavior inherited from the retired handler (and `breweries-expert`): Open Brewery DB,
`per_page=200`, volunteer-run API → **pages walked sequentially, never in parallel**.

```
Webhook(sync-breweries) ─▶ begin_run ─▶ concurrency guard
  ─▶ HTTP GET /breweries/meta  → total, pages = ceil(total/200)
  ─▶ Loop (Split In Batches over page list, sequential)
       ─▶ HTTP GET /breweries?page=N&per_page=200
       ─▶ PG: select to_jsonb(location_datasets_fn.upsert_breweries($1::jsonb))
       ─▶ accumulate inserted/updated/pagesFetched (Code node)
  ─▶ complete_run(result_data: { total, pagesFetched, inserted, updated, syncedAt })
```

- The per-page upsert call is identical to today (same jsonb payload, same fn — already
  `SECURITY DEFINER`, granted to `n8n_worker`).
- HTTP nodes: no retry on 4xx; `retryOnFail` (3 tries, 10s) on network/5xx blips.
- Any unhandled failure → `error-handler` → `error_run` (status query then reports not-running;
  partial pages already upserted are fine — the fn is an idempotent upsert, same as today).

---

## Workflow: `sync-airports` (`n8n/workflows/sync-airports.json`)

Source behavior inherited from the retired handler (and `airports-expert`): OurAirports bulk
CSVs fetched per file with **etag conditional-GET** (`airports.sync_source`), parsed, and
upserted in chunks via the per-file `airports_fn.upsert_*` functions, recording
`airports_fn.record_sync_source` after each file.

```
Webhook(sync-airports) ─▶ begin_run ─▶ concurrency guard
  ─▶ For each source file (countries, regions, airports, runways, frequencies, navaids, …
      — exact list/order from the retired handler at implementation time)
       ─▶ PG: select etag from airports.sync_source where file = $1
       ─▶ HTTP GET csv (header If-None-Match: etag; full response on miss)
       ─▶ IF 304 → skip file
       ─▶ Extract From File (CSV → items)      ← replaces the handler's CSV parsing
       ─▶ Split In Batches (chunk size matching the handler's batch size)
             ─▶ PG: select to_jsonb(airports_fn.upsert_<file>($1::jsonb))
       ─▶ PG: airports_fn.record_sync_source(file, etag, …)
  ─▶ complete_run(result_data: per-file { skipped | inserted, updated } + syncedAt)
```

- File order matters (FK-ish dependencies: countries → regions → airports → child files) — the
  n8n graph encodes it as a sequential chain, same as the handler's loop.
- CSV quirks (quoting, nullable columns, enum drift) are already absorbed by the `_fn` layer and
  `Extract From File`'s RFC-4180 parser; consult `airports-expert` at implementation if parsing
  behavior differs from the retired hand-rolled parser.

---

## Template seeds retired

`db/seed.sql`'s `sync-breweries` / `sync-airports` wf-template upserts (and the `wf-exerciser`
seed) are removed — workflow definitions now live in `n8n/workflows/*.json` and are imported at
boot (`infrastructure.md`). Inventory: `decommission.data.md`.
