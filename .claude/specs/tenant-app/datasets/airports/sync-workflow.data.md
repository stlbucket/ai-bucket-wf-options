---
name: tenant-app-datasets-airports-sync-workflow
description: The sync-airports wf workflow — template seed, worker task handler, six-file CSV download/parse/upsert walk with ETag skips, and error posture.
metadata:
  type: reference
---

# sync-airports — Workflow & Worker Handler

Shared model: `_shared.data.md`. Worker conventions:
`.claude/specs/graphql-api-app/worker-pattern.md`. Dataset details:
`.claude/skills/airports-expert/SKILL.md`. Breweries precedent:
`.claude/specs/tenant-app/datasets/breweries/sync-workflow.data.md`.

## Status
Implemented — GraphQL (2026-07-10). First sync (user-triggered via the UI) completed in one
instance: 179,366 rows across the six files, counts matching each file's own row count exactly;
85,716 public `loc.location` rows created; zero skipped runways/frequencies (referential
integrity held). Per-file ETags recorded — note upstream serves **weak** ETags (`W/"…"`),
which work fine as `If-None-Match` values; the 304 skip path is armed but not yet exercised
(next re-sync proves it). Handler implementation detail: `csv-parse`'s **sync** API is used
(whole files are ≤13 MB — simpler than streaming and well within worker memory).

---

## Template

Identifier: **`sync-airports`**, seeded for the **anchor tenant** as an **inline
`wf_fn.upsert_wf` block in `db/seed.sql`** next to the `sync-breweries` block (the
next-to-handler `load-workflow-*.sql` mechanism is stale; seed runs on every rebuild — memory
`rebuild-wipes-db`).

Structure — single sync task, no fan-out (locked decision; one retry unit):

```
<root wf uow>  (type wf, identifier 'sync-airports', handler close-workflow-wf)
  └── sync-airports-task  (type task, workflowHandlerKey 'sync-airports', useWorker true)
```

Breweries correction applies verbatim: the root uow claims the wf identifier
(`sync-airports`), so the task uow needs the **distinct identifier** `sync-airports-task`;
only its `workflow_handler_key` is `sync-airports`. No dependency edges, no
`input_definitions`; `on_completed_workflow_handler_key = 'close-workflow-wf'` closes the root.

## Queueing (from the list page)

Identical machinery to breweries: the site-admin-only button calls the existing
`useQueueWorkflow` composable (`wf_api.queue_workflow` via the existing `queueWorkflow`
mutation) with the `sync-airports` template. Button disabled while
`airportSyncStatus.inProgress` is true; UI permission gate only (API-level gate deferred to
issue 0030).

---

## Task Handler

File: `apps/worker-app/server/lib/worker-task-handlers/airports/sync-airports.ts`, wrapped in
`_workflowHandler`, registered in `server/lib/worker-task-handlers/index.ts` under key
`'sync-airports'` (task keys are stack-unique).

There is no API to walk — the handler downloads whole CSV files and upserts locally, in
**dependency order** (parents before children):

```
files = [countries, regions, airports, runways, airport-frequencies, navaids]   // .csv each

1. select airports_fn.airport_sync_status()  →  (not required; the wrapper owns lifecycle)
2. for file in files (SEQUENTIAL):
     a. read stored etag: select etag from airports.sync_source where file = $1
        (read via the same root-of-trust client — RLS view_all + no writes makes this safe)
     b. GET https://davidmegginson.github.io/ourairports-data/<file>
        with If-None-Match: <etag> when present
        → 304: record { file, skipped: true } and continue to next file
        → 200: stream-parse CSV (csv-parse; UTF-8; RFC-4180 — fields contain commas/quotes)
     c. chunk rows (1,000/chunk); per chunk:
        select airports_fn.upsert_<table>($1::jsonb)
        → accumulate inserted/updated/skipped
     d. select airports_fn.record_sync_source(file, etag, last_modified, row_count)
3. return {
     status: complete,
     stepData:     { perFile: { file: { rowCount, inserted, updated, skipped | notModified } } },
     workflowData: { airportsSync: { totals per table, syncedAt } },
   }
```

- Base URL `https://davidmegginson.github.io/ourairports-data` as a module constant — **no env
  var, no API key** (public-domain data on GitHub Pages).
- Coercion at the worker edge: empty string → null; numeric columns parsed
  (`Number.parseInt`/`parseFloat`, NaN → null); `'yes'`/`'no'` and `'1'`/`'0'` → boolean;
  lat/lon stay strings (loc convention). Enum coercion happens DB-side in the `_fn` upserts
  (`pg_enum` check → `'unknown'` + raw value into `notes`).
- `airport_ref` resolution for runways/frequencies happens DB-side (join on
  `airport.external_id`); rows whose airport is missing are **skipped and counted** — with
  parents imported first and 0 orphans live this should stay 0, but a mid-cycle upstream
  publish could race; skipped rows self-heal on the next sync.
- Politeness: six GETs total per sync, sequential. Never schedule more than daily — the data
  changes nightly. The ETag skip makes a same-day re-queue nearly free.
- **Errors**: any fetch (non-2xx-non-304, network) or DB error → return
  `{ status: error, errorInfo: { message, stack } }` → `wf_fn.error_uow` marks the UOW `ERROR`.
  No partial-failure recovery: files/chunks already upserted stay (idempotent); the admin
  re-queues, and the ETag skip fast-forwards past files that already landed.
- `maxAttempts: 1` per the `_workflowHandler` convention — no graphile-worker retries on top.
- Runtime estimate: ~24 MB download + ~180k row upserts in ~180 chunk calls (the airports file
  alone is 86 chunks, each also touching `loc.location`) ≈ **several minutes** — within a
  single job run, no checkpointing. If it materially exceeds that in practice, note it in the
  workflow data and consider bumping chunk size before considering fan-out.

## Upsert semantics (recap)

Keyed on `<table>.external_id` = the upstream integer id (persistent upstream). Existing row →
update in place (+ the airport's public `loc.location` row), bump `updated_at`. New → insert
(airports: location first). Everything imports, including `type = 'closed'` (13,331 rows) —
views filter visually / by default. **No delete pass** — upstream marks closures via
`type = 'closed'`; stale rows are acceptable for a reference dataset. Unrecognized enum values
coerce to `'unknown'` with the raw value recorded in `notes` (the breweries drift armor —
non-negotiable).
