---
name: n8n-workflow-engine-shared
description: Shared integration architecture for the n8n migration — the db/fnb-n8n package (run log + n8n_worker role + grants), webhook auth, the triggerWorkflow GraphQL mutation, tenancy model, and workflow-as-code conventions.
metadata:
  type: reference
---

## Status
Draft — locked decisions in `README.md`; no `[FILL IN]` markers remain.

---

## Architecture at a glance

```
                         ┌──────────────────────────────────────────────┐
                         │ n8n container (own host port, custom image)  │
   upload.post.ts ──POST─▶ webhook /asset-scan                          │
   triggerWorkflow ─POST─▶ webhook /sync-breweries /sync-airports /...  │
   (grafast plugin)      │ Schedule Trigger: asset-scan-reaper (cron)   │
                         │ state: n8n_engine DATABASE (same PG cluster) │
                         └───────────────┬──────────────────────────────┘
                                         │ pg connection as role n8n_worker
                                         ▼
                         function_bucket DATABASE
                         n8n / n8n_fn / n8n_api  ← run log (db/fnb-n8n)
                         storage_fn.* location_datasets_fn.* airports_fn.*
```

- **fnb → n8n** is always an HTTP POST to a Webhook-node URL, authenticated by a shared-secret
  header (`X-Fnb-Webhook-Secret: $N8N_WEBHOOK_SECRET`). No fnb code talks to n8n's REST API at
  runtime (the editor/API is an operator surface, managed via `n8n-cli` and the import job).
- **n8n → fnb** is always a Postgres connection as the dedicated `n8n_worker` role calling
  SECURITY DEFINER `_fn` functions (plus a few explicitly granted `SELECT`s). n8n never connects
  as `authenticator`/`authenticated` and never goes through PostGraphile — it is a service-level
  actor, exactly like the retired worker-app's `useFnbPgClient` root-of-trust connection.
- **n8n's own state** (workflow definitions, credentials, execution log) lives in the separate
  **`n8n_engine` database** in the existing postgis container — deliberately NOT named `n8n` so
  the engine database and the `n8n` integration schema inside `function_bucket` can never be
  confused. sqitch and PostGraphile never see `n8n_engine`.

---

## The `db/fnb-n8n` sqitch package (new)

New package (scaffold via `new-db-package`; register in `DEPLOY_PACKAGES` after `fnb-app`,
replacing `fnb-wf`'s slot). It owns the integration surface between n8n and function_bucket.

### Schema: `n8n` / `n8n_fn` / `n8n_api` (house trio, R8)

```sql
CREATE SCHEMA n8n;

CREATE TYPE n8n.workflow_run_status AS ENUM ('running', 'success', 'error');

-- One row per n8n execution of an fnb workflow. This is the app-side observability
-- substitute for the retired wf.uow DAG: enough for "is a sync running?", "when did the
-- last one finish?", and the reaper's attempt cap — full step-level history lives in
-- n8n's own execution log (editor UI).
CREATE TABLE n8n.workflow_run (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_key citext NOT NULL,              -- 'asset-scan' | 'sync-breweries' | ...
  n8n_execution_id text,                     -- n8n's $execution.id (correlate to n8n log)
  tenant_id uuid REFERENCES app.tenant(id),  -- nullable: dataset syncs are anchor-wide
  status n8n.workflow_run_status NOT NULL DEFAULT 'running',
  input_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  error jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT current_timestamp,
  finished_at timestamptz
);
CREATE INDEX idx_workflow_run_key_status ON n8n.workflow_run (workflow_key, status);
CREATE INDEX idx_workflow_run_input ON n8n.workflow_run USING gin (input_data);
```

RLS (R9): enabled; SELECT policy for `jwt.has_permission('p:app-admin-super', tenant_id)` plus a
`tenant_id IS NULL` anchor-visible read for super admins. `n8n_worker` writes via the
SECURITY DEFINER `_fn` functions below, so no INSERT/UPDATE policies are needed.

### `n8n_fn` (SECURITY DEFINER; EXECUTE granted to `n8n_worker`)

| Function | Signature | Called by |
|---|---|---|
| `begin_run` | `(workflow_key citext, n8n_execution_id text, input_data jsonb, tenant_id uuid default null) → uuid` | first Postgres node of every workflow |
| `complete_run` | `(run_id uuid, result_data jsonb default '{}') → n8n.workflow_run` | last node of every workflow |
| `error_run` | `(run_id uuid, error jsonb) → n8n.workflow_run` | the shared `error-handler` workflow |
| `error_run_by_execution` | `(n8n_execution_id text, error jsonb) → n8n.workflow_run` | error-handler when only the execution id is known |
| `running_count` | `(workflow_key citext) → int` | sync-status fns, reaper |

### `n8n_api` (SECURITY INVOKER; PostGraphile surface)

| Function | Purpose |
|---|---|
| `workflow_runs(workflow_key, paging)` | recent runs for an admin/status panel (gated `p:app-admin-super`) |

Add `n8n, n8n_api` to `pgServices.schemas` in `apps/graphql-api-app/server/graphile.config.ts`
(and remove `wf, wf_api` — see `decommission.data.md`).

### The `n8n_worker` role + grants

Created in this package's first deploy script (idempotent `DO $$ ... CREATE ROLE ... $$` guard):

```sql
CREATE ROLE n8n_worker LOGIN PASSWORD :'n8n_worker_password' NOINHERIT;  -- password via env at deploy
```

Grants live in a dedicated change **in each owning module's package** (house pattern: the module
owns its grant surface). Complete inventory, derived from what the retired handlers actually call:

| Package (new change) | Grant to `n8n_worker` |
|---|---|
| `fnb-n8n` | `USAGE` on `n8n`, `n8n_fn`; `EXECUTE` on all `n8n_fn.*` above |
| `fnb-storage` | `EXECUTE` on `storage_fn.resolve_asset_scan`, `storage_fn.insert_derived_asset`, `storage_fn.add_asset_tags`; new `storage_fn.asset_for_scan(uuid)` + `storage_fn.stuck_pending_assets(stuck_minutes int, max_attempts int)` (replaces the reaper's inline SQL — counts prior attempts via `n8n.workflow_run`); `USAGE` on `storage`, `storage_fn` |
| `fnb-location-datasets` | `EXECUTE` on `location_datasets_fn.upsert_breweries`; `USAGE` on the schemas |
| `fnb-airports` | `EXECUTE` on `airports_fn.upsert_*` (all CSV upsert fns), `airports_fn.record_sync_source`; `SELECT` on `airports.sync_source` (etag conditional-GET read); `USAGE` on the schemas |
| `fnb-app` | `EXECUTE` on `app_fn.raise_exception` (exerciser demo only) |

Rule going forward: **n8n reaches fnb data exclusively through `_fn` functions** (the two
existing raw `SELECT`s from `storage.asset` in scan/thumbnail handlers become
`storage_fn.asset_for_scan`); direct table grants are limited to the `airports.sync_source`
etag read.

### Sync-status rewrite (same package or owning packages, sqitch rework)

`location_datasets_fn.brewery_sync_status` and `airports_fn.airport_sync_status` currently derive
`in_progress` from `wf.wf`/`wf.uow`. Rework both to:

```sql
_retval.in_progress := n8n_fn.running_count('sync-breweries') > 0;
```

The GraphQL surface (`brewerySyncStatus` / `airportSyncStatus`) and the composables' polling
behavior are unchanged — pages don't change.

---

## Webhook auth contract (fnb → n8n)

- Every fnb-triggered workflow starts with a **Webhook node** (`POST`, path = the workflow key),
  using an n8n **Header Auth credential**: header `X-Fnb-Webhook-Secret`, value `$N8N_WEBHOOK_SECRET`.
- `N8N_WEBHOOK_SECRET` is a required env var shared by: the n8n credential (via the imported
  credential template), `graphql-api-app` (triggerWorkflow plugin), and `storage-layer`
  (upload endpoint). Rotation = change env + re-run the credential import.
- fnb callers POST to `http://n8n:5678/webhook/<workflow-key>` — the compose-internal URL, env
  `N8N_INTERNAL_URL`. Webhook responses are `immediately` (fire-and-forget, 200 = accepted);
  completion is observed via `n8n.workflow_run`, never by holding the HTTP call open.

---

## `triggerWorkflow` — the app-originated trigger surface

Replaces the retired `queueWorkflow` GraphQL mutation (which was a wf_api call + grafast
mutation-hook enqueue). New: a **PostGraphile `extendSchema` plugin** in
`apps/graphql-api-app/server/api/` (house carve-out: this is transport code, R7-thin):

```graphql
extend type Mutation {
  triggerWorkflow(workflowKey: String!, inputData: JSON): TriggerWorkflowResult
}
type TriggerWorkflowResult { accepted: Boolean!, runId: UUID }
```

Plugin behavior:
1. Read `event.context.claims` — **401 if absent** (parity with `wf_api.queue_workflow`, which
   gated only on an authenticated tenant).
2. Check the workflow key against a **static allow-map** in the plugin:
   `{ 'sync-breweries': null, 'sync-airports': null, 'exerciser': 'p:app-admin-super' }`
   (`null` = any authenticated user, matching today's gate; a `p:` key = require
   `claims.permissions.includes(key)`). Unknown key → GraphQL error. `asset-scan` is
   deliberately NOT in the map — only the upload endpoint fires it.
3. POST `{ ...inputData, tenantId: claims.tenantId, profileId: claims.profileId }` to
   `${N8N_INTERNAL_URL}/webhook/<workflowKey>` with the secret header.
4. Return `{ accepted: true }` (fire-and-forget; `runId` optional if the webhook responds with it).

Client side: one `.graphql` mutation document
(`packages/graphql-client-api/src/graphql/n8n/mutation/triggerWorkflow.graphql`), codegen, and a
`useTriggerWorkflow` composable. `useBreweries.queueSync()` / `useAirports.queueSync()` swap
`useQueueWorkflow` for `useTriggerWorkflow` — **their public API and the pages are unchanged**
(R1: pages never see the transport change).

---

## Tenancy model (changed — deliberate)

The wf module was tenant-scoped (per-tenant templates, RLS on instances). n8n workflows are
**global singletons**; tenant context travels **in the webhook payload** and is recorded on
`n8n.workflow_run.tenant_id`. Consequences, accepted under the Full-replacement decision:

- No per-tenant template seeding (`storage_fn.ensure_asset_scan_wf` retires; nothing replaces it).
- Tenant-scoped *visibility* of runs is via `n8n.workflow_run` RLS, not workflow cloning.
- Per-tenant workflow *customization* is out of scope; if it ever returns, it becomes an
  n8n sub-workflow dispatch keyed by tenant, not template cloning.

---

## Workflow-as-code conventions

- Definitions live in the repo: **`n8n/workflows/<workflow-key>.json`** — the exact JSON that
  `n8n export:workflow --separate` emits (stable node ids; `"active": true` for webhook/cron
  workflows). Edit in the editor → export via `n8n-cli workflow get <id> --json` → commit.
- Credential **templates** live in **`n8n/credentials/*.json.tpl`** with `${ENV_VAR}`
  placeholders (PG `n8n_worker` connection, S3/MinIO keys, webhook Header Auth secret). The
  import job renders them with `envsubst` and runs `n8n import:credentials`. Rendered files are
  never written to the repo; secrets exist only in env + n8n's encrypted store.
- The import job (`n8n-import`, see `infrastructure.md`) runs **before** the n8n server starts:
  `import:credentials` then `import:workflow --separate`. Import is idempotent (same workflow
  ids overwrite in place) — the n8n analog of the sqitch/seed rebuild loop.
- Every workflow sets the shared **`error-handler`** workflow (also in `n8n/workflows/`) as its
  Error Workflow. `error-handler` receives the failed execution's metadata and calls
  `n8n_fn.error_run_by_execution($execution.id, error jsonb)` — one place turns any n8n failure
  into a terminal `workflow_run.status = 'error'`, replacing `_workflowHandler`'s catch-all
  `wf_fn.error_uow`.
- Naming: workflow `name` = workflow key; webhook `path` = workflow key; Postgres credential is
  named `fnb-n8n-worker`; S3 credential `fnb-minio`; header auth `fnb-webhook-secret`.

---

## What replaces the Workflow Dashboard

The VueFlow dashboard (`/graphql-api/workflow`) retires with the wf module. Its replacement:

- **Step-level execution history / debugging** → the n8n editor (own host port,
  `http://localhost:${N8N_HOST_PORT}`), which is strictly better at this.
- **In-app tenant-scoped status** → `n8n.workflow_run` via `n8n_api.workflow_runs` (already
  consumed by the sync-status fns; an admin runs panel is a possible later addition, not in
  scope here).
- The `tenant-site-admin-wf` nav tool row is removed from
  `db/fnb-app/deploy/00000000010240_app_fn.sql` (nav is DB-registered, R14).
