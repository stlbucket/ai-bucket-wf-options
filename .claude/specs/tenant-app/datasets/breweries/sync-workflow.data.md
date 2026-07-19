---
name: tenant-app-datasets-breweries-sync-workflow
description: The sync-breweries wf workflow — template seed, worker task handler, Open Brewery DB pagination walk, and upsert flow.
metadata:
  type: reference
---

# sync-breweries — Workflow & Worker Handler

Shared model: `_shared.data.md`. Worker conventions:
`.claude/specs/graphql-api-app/worker-pattern.md`. API details:
`.claude/skills/breweries-expert/SKILL.md`.

## Status
Implemented — GraphQL (2026-07-09). Corrections from the build are folded in below.

---

## Template

Identifier: **`sync-breweries`**, seeded for the **anchor tenant** as an **inline
`wf_fn.upsert_wf` block in `db/seed.sql`** mirroring the wf-exerciser block (the
`load-workflow-*.sql`-next-to-handler mechanism is stale; runs on every rebuild — memory
`rebuild-wipes-db`).

Structure — deliberately minimal (user decision: single sync task, no fan-out):

```
<root wf uow>  (type wf, identifier 'sync-breweries', handler close-workflow-wf)
  └── sync-breweries-task  (type task, workflowHandlerKey 'sync-breweries', useWorker true)
```

**Implementation correction:** `wf_fn.upsert_wf` creates the root uow with the **wf identifier**
(`sync-breweries`), and `upsert_uow` keys on `(tenant_id, identifier, wf_id)` — so the task uow
must use a **distinct identifier** (`sync-breweries-task`); only its `workflow_handler_key` is
`sync-breweries`. No dependency edges (single task; `on_completed_workflow_handler_key =
'close-workflow-wf'` closes the root) and no `input_definitions`.

## Queueing (from the list page)

The site-admin-only button calls the existing `useQueueWorkflow` composable
(`wf_api.queue_workflow` via the existing `queueWorkflow` mutation) with the `sync-breweries`
template — identical machinery to the workflow dashboard's queue modal, no new mutation. The
instance runs under the invoking site-admin's (anchor) tenant. Guard: the button is disabled
while `brewerySyncStatus.inProgress` is true (plus the UI permission gate; see Open Question 2
in `_shared.data.md` for the API-level gate).

---

## Task Handler

File: `apps/worker-app/server/lib/worker-task-handlers/location-datasets/sync-breweries.ts`,
wrapped in `_workflowHandler`, registered in `server/lib/worker-task-handlers/index.ts` under
key `'sync-breweries'` (task keys are stack-unique).

```
1. GET {base}/breweries/meta               → total; pages = ceil(total / 200)
2. for page in 1..pages (SEQUENTIAL — volunteer-run API, be polite; no parallel fetches):
     GET {base}/breweries?page={page}&per_page=200
     → stop early if the array is empty
     → select location_datasets_fn.upsert_breweries($1::jsonb)   -- one call per page
     → accumulate inserted/updated counts
3. return {
     status: complete,
     stepData:     { total, pagesFetched, inserted, updated },
     workflowData: { breweriesSync: { total, inserted, updated, syncedAt } },
   }
```

- Base URL `https://api.openbrewerydb.org/v1` as a module constant (no env var — public API,
  no key).
- DB access: `useFnbPgClient()` (`@function-bucket/fnb-auth-server`) — same client the wrapper
  uses; `upsert_breweries` is worker-only with no `_api` wrapper (trust model in
  `_shared.data.md`).
- **Errors**: any fetch (non-2xx, network) or DB error → return
  `{ status: error, errorInfo: { message, stack } }` → `wf_fn.error_uow` marks the UOW `ERROR`.
  No partial-failure recovery: pages already upserted stay (upserts are idempotent); the admin
  re-queues a fresh instance, which re-walks everything — user decision: re-invocation is the
  retry story, updates-only by design.
- `maxAttempts: 1` comes from the `_workflowHandler` scheduling convention — do not add
  graphile-worker retries on top (a re-run of a half-finished walk is harmless but an automatic
  one hides failures from the admin).
- Runtime estimate: ~59 sequential pages ≈ a couple of minutes — well within a single job run;
  no checkpointing needed.

## Upsert semantics (recap)

Keyed on `brewery.external_id` = Open Brewery DB UUID. Existing row → update brewery + its
public `loc.location` row. New → insert location (anchor tenant, `resident_id` null,
`is_public = true`) then brewery. Everything imports, including `planning` and `closed` types.
No delete pass. Unrecognized `brewery_type` values are coerced to `'unknown'` with the raw
value recorded in `notes` (see `_shared.data.md` — the first sync failed on the undocumented
`taproom` type; the coercion makes future upstream vocabulary drift non-fatal).
