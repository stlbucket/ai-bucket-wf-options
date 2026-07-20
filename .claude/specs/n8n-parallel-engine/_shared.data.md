---
name: n8n-parallel-engine-shared
description: Shared integration architecture for the parallel n8n engine — the db/fnb-n8n package (run log + n8n_worker role + demo-scope grants), webhook auth, the engine registry in the triggerWorkflow plugin, PostGraphile smart tags, fnb-types/mappers/composables for the runs panels, tenancy, and the security model.
metadata:
  type: reference
---

## Status
**Implemented 2026-07-19.** Corrections from the build (authoritative where they differ from
the body below): the enum is named **`n8n.n8n_workflow_run_status` in SQL** (PostGraphile 5's
`typeCodecName` inflector ignores `@name` tags on types — only tables/functions can be renamed
via tags); the generated names are digit-aware-camelCase — type `N8NWorkflowRun`, root field
`n8NWorkflowRunsList`, field `n8NExecutionId` — internal to `graphql-client-api` (mappers
convert to the `fnb-types` shapes below, R3). The n8n_worker grant checks, webhook 403, RLS
gate (positive + negative under simulated `pgSettings`) are all verified live.

**Extension implemented 2026-07-19** (`dataset-sync.workflow.data.md`): two parallel
dataset-sync twins `n8n-sync-breweries` / `n8n-sync-airports` — registry entries, the
`n8n_worker` grant expansion in the owning packages, and the `n8n_fn.dataset_sync_busy` guard
helper are all live.

> Coexistence spec: the agentic engine (`.claude/specs/agentic-workflow-engine/`, implemented)
> is **not modified** except where explicitly named here (the `triggerWorkflow` plugin's
> allow-map becomes an engine registry). The superseded full-replacement spec
> (`.claude/specs/n8n-workflow-engine/`) is the provenance for the carried-over n8n mechanics.

---

## Architecture at a glance

```
  triggerWorkflow ──engine registry──┬─POST─▶ apps/agent-app /api/trigger/<key>   (agentic — unchanged, R22)
  (grafast plugin, graphql-api-app)  │        X-Fnb-Trigger-Secret
                                     │
                                     └─POST─▶ n8n container  /webhook/<key>       (new — own host port, official image)
                                              X-Fnb-Webhook-Secret
                                              state: n8n_engine DATABASE (same PG cluster)
                                                        │ pg connection as role n8n_worker
                                                        ▼
                                              function_bucket DATABASE
                                              n8n / n8n_fn / n8n_api  ← run log (db/fnb-n8n)
                                              app_api.raise_exception (demo error path)

  site-admin UI (tenant-app):
    /tenant/site-admin/wf-agentic → agent_api.workflow_runs  (existing fn, new client read)
    /tenant/site-admin/wf-n8n     → n8n_api.workflow_runs    (new)  + editor link-out
```

- **fnb → n8n** is an HTTP POST to a Webhook-node URL (`${N8N_INTERNAL_URL}/webhook/<key>`,
  compose-internal `http://n8n:5678`), authenticated by header
  `X-Fnb-Webhook-Secret: $N8N_WEBHOOK_SECRET`. Respond-immediately (200 = accepted,
  fire-and-forget); completion is observed via `n8n.workflow_run`. No fnb code talks to n8n's
  REST API at runtime (editor/API is operator surface, via `n8n-cli`).
- **n8n → fnb** is a Postgres connection as the dedicated `n8n_worker` role calling granted
  functions only — never `authenticator`/`authenticated`, never PostGraphile. Same service-actor
  position as `agent_worker`.
- **n8n's own state** lives in the separate `n8n_engine` database in the existing postgis
  cluster; sqitch and PostGraphile never see it.
- **The agentic path is byte-for-byte what it is today** — same route, same secret, same
  `202 { accepted, runId }`.

---

## The `db/fnb-n8n` sqitch package (new)

Scaffold via `new-db-package`; register in `DEPLOY_PACKAGES` (`.env` + `.env.example`)
**immediately after `fnb-agent`**. Sqitch deps (via `sqitch-expert` at implementation): the
first change depends on `fnb-app:00000000010250_app_policies` (jwt helpers precedent); the
`n8n_api` change also needs `app_fn.paging_options` (`fnb-app:00000000010240_app_fn`).

### Schema: `n8n` / `n8n_fn` / `n8n_api` (house trio, R8)

```sql
CREATE SCHEMA n8n;

CREATE TYPE n8n.workflow_run_status AS ENUM ('running', 'success', 'error');

-- One row per n8n execution of an fnb workflow. Flat run log, same deliberate ceiling as
-- agent.workflow_run; step-level history lives in n8n's own execution log (editor UI).
CREATE TABLE n8n.workflow_run (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_key citext NOT NULL,              -- 'n8n-exerciser' | future keys
  n8n_execution_id text,                     -- n8n's $execution.id (correlate to n8n log)
  tenant_id uuid REFERENCES app.tenant(id),  -- nullable
  status n8n.workflow_run_status NOT NULL DEFAULT 'running',
  input_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  error jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT current_timestamp,
  finished_at timestamptz
);
CREATE INDEX idx_n8n_workflow_run_key_status ON n8n.workflow_run (workflow_key, status);
CREATE INDEX idx_n8n_workflow_run_input ON n8n.workflow_run USING gin (input_data);
```

RLS (R9): enabled; SELECT policy `jwt.has_permission('p:app-admin-super', tenant_id)` plus a
`tenant_id IS NULL` anchor-visible read for super admins (mirror
`db/fnb-agent/deploy/00000000011130_agent_policies.sql`). `n8n_worker` writes via the SECURITY
DEFINER `_fn` functions, so no INSERT/UPDATE policies.

### `n8n_fn` (SECURITY DEFINER; EXECUTE granted to `n8n_worker`)

| Function | Signature | Called by |
|---|---|---|
| `begin_run` | `(workflow_key citext, n8n_execution_id text, input_data jsonb, tenant_id uuid default null) → uuid` | first Postgres node of every fnb-triggered workflow |
| `complete_run` | `(run_id uuid, result_data jsonb default '{}') → n8n.workflow_run` | last node of every workflow |
| `error_run` | `(run_id uuid, error jsonb) → n8n.workflow_run` | error-handler when the run id is known |
| `error_run_by_execution` | `(n8n_execution_id text, error jsonb) → n8n.workflow_run` | the shared `error-handler` workflow |
| `running_count` | `(workflow_key citext) → int` | future singleton guards / status fns; parity with `agent_fn.running_count` |

### `n8n_api` (SECURITY INVOKER; PostGraphile surface)

| Function | Purpose |
|---|---|
| `workflow_runs(_workflow_key citext default null, _paging_options app_fn.paging_options default null)` | recent runs for the site-admin panel — **mirror `agent_api.workflow_runs` exactly** (`db/fnb-agent/deploy/00000000011120_agent_api.sql`: `jwt.enforce_permission('p:app-admin-super')`, default limit 25, `order by started_at desc, id`) |

### PostGraphile exposure + smart tags (collision avoidance — locked)

Add `n8n, n8n_api` to `pgServices.schemas` in
`apps/graphql-api-app/server/graphile.config.ts`. **`agent.workflow_run` already owns the
GraphQL names** `WorkflowRun` / `WorkflowRunStatus` / `workflowRuns*`; without renames the new
schema collides. Three renames, in the kind-appropriate place (the tags file only targets
class/attribute/constraint/procedure — types cannot be tagged there):

- `apps/graphql-api-app/postgraphile.tags.json5` **class** section:
  `'n8n.workflow_run': { tags: { name: 'n8n_workflow_run', behavior: '-query:resource:list
  -query:resource:connection' } }` (GraphQL type `N8nWorkflowRun`; reads only via the gated fn)
- tags.json5 **procedure** section: `'n8n_api.workflow_runs': { tags: { name:
  'n8n_workflow_runs' } }` (root field `n8nWorkflowRunsList`)
- the deploy SQL (`00000000011200_n8n.sql`): `COMMENT ON TYPE n8n.workflow_run_status IS
  E'@name n8n_workflow_run_status';`

Verify the exact generated field names in GraphiQL / `src/generated/fnb-graphql-api.ts` before
writing the `.graphql` documents (house convention; → `postgraphile-5-expert` if the inflection
surprises).

### The `n8n_worker` role + grants (demo scope)

Created in this package's policies change — **mirror the `agent_worker` mechanics exactly**
(`db/fnb-agent`): idempotent `DO $$ … CREATE ROLE … $$` guard + separate
`ALTER ROLE n8n_worker PASSWORD :'n8n_worker_password'` (psql vars don't interpolate inside
`DO $$` bodies); password flows via `sqitch deploy --set n8n_worker_password=…` from
`N8N_WORKER_PG_PASSWORD`, threaded through `docker/migrate-entrypoint.sh` and
`scripts/db-deploy.ts` alongside `agent_worker_password`.

```sql
CREATE ROLE n8n_worker LOGIN NOINHERIT;  -- inside the DO guard; password via ALTER ROLE
```

| Grant (all in `fnb-n8n`'s policies change) | To `n8n_worker` |
|---|---|
| `USAGE` on `n8n`, `n8n_fn` | run-log writes |
| `EXECUTE` on all `n8n_fn.*` above | run-log writes |
| `USAGE` on `app_api`; `EXECUTE` on `app_api.raise_exception(citext)` | exerciser DB-error demo path. **`app_api`, not `app_fn`** (the function only exists there), and the grant lives **in this package**, not fnb-app — fnb-app deploys before the role exists (both lessons from the agentic build, `agentic-workflow-engine/_shared.data.md` §Status) |

Rule: n8n reaches fnb data exclusively through granted functions. Future production moves extend
this inventory in the owning module's package (house pattern), e.g. `location_datasets_fn.upsert_breweries`.

The dataset-sync twins expand the inventory exactly that way — `n8n_worker` grants in
`fnb-location-datasets` / `fnb-airports` (upsert fns, `sync_source` etag read) plus the
`n8n_fn.dataset_sync_busy` helper for the cross-engine guard (NOT an `agent_fn` grant — schema
USAGE must not widen); full table in `dataset-sync.workflow.data.md` → DB changes.

---

## `triggerWorkflow` — the engine registry (the one agentic-side change)

`apps/graphql-api-app/server/graphile/trigger-workflow.plugin.ts` — the static `ALLOW_MAP`
(`:13–17`) becomes an engine registry; **the GraphQL shape, the client mutation document, and
`useTriggerWorkflow` are unchanged** (no codegen needed):

```ts
type Engine = 'agent' | 'n8n'
// `permission`: null = any authenticated user; a string = require that key; a string[] = any-of
// (parity with `jwt.enforce_any_permission`, added for game-event — game-server/_shared.data.md).
const WORKFLOW_REGISTRY: Record<
  string,
  { engine: Engine; permission: string | string[] | null }
> = {
  'sync-breweries': { engine: 'agent', permission: null },
  'sync-airports': { engine: 'n8n', permission: null }, // moved 2026-07-20 (dataset-sync §Status)
  exerciser: { engine: 'agent', permission: 'p:app-admin-super' },
  'n8n-exerciser': { engine: 'n8n', permission: 'p:app-admin-super' },
  // breweries twin (dataset-sync.workflow.data.md)
  'n8n-sync-breweries': { engine: 'n8n', permission: 'p:app-admin-super' }
}
```

Behavior per entry (claims 401 gate and permission check unchanged):
- `engine: 'agent'` → POST `${AGENT_INTERNAL_URL}/api/trigger/<key>`,
  header `x-fnb-trigger-secret: $AGENT_TRIGGER_SECRET`, pass through `{ accepted, runId }` —
  byte-for-byte today's behavior.
- `engine: 'n8n'` → POST `${N8N_INTERNAL_URL}/webhook/<key>`,
  header `x-fnb-webhook-secret: $N8N_WEBHOOK_SECRET`, body
  `{ ...inputData, tenantId, profileId }`; n8n responds immediately (no runId) → return
  `{ accepted: response.ok, runId: null }` (`runId` is already nullable in
  `TriggerWorkflowResult`).

`asset-scan` stays absent from the registry (upload endpoint only). Moving a workflow between
engines = flipping its `engine` value (plus the DB grants the workflow needs on the target side).

---

## Client layer for the runs panels (R3/R4)

### fnb-types (`packages/fnb-types/src/workflow-run.ts`, new + barrel line)

```ts
export type WorkflowRunStatus = 'RUNNING' | 'SUCCESS' | 'ERROR'  // mirrors both GraphQL enums

export interface AgentWorkflowRun {
  id: string
  workflowKey: string
  agentSessionId: string | null
  model: string | null
  tenantId: string | null
  status: WorkflowRunStatus
  inputData: unknown
  resultData: unknown
  error: unknown
  usage: { total_cost_usd?: number; [k: string]: unknown }
  startedAt: Date
  finishedAt: Date | null
}

export interface N8nWorkflowRun {
  id: string
  workflowKey: string
  n8nExecutionId: string | null
  tenantId: string | null
  status: WorkflowRunStatus
  inputData: unknown
  resultData: unknown
  error: unknown
  startedAt: Date
  finishedAt: Date | null
}
```

### graphql-client-api

- Fragments + queries: `src/graphql/agent/query/agentWorkflowRuns.graphql`,
  `src/graphql/n8n/query/n8nWorkflowRuns.graphql` — each calls the gated fn with
  `pagingOptions: { itemLimit: 50 }` and selects every field the fnb-type needs (R3).
- Mappers: `src/mappers/agent-workflow-run.ts` (`toAgentWorkflowRun`),
  `src/mappers/n8n-workflow-run.ts` (`toN8nWorkflowRun`) — un-Maybe, `Date` coercion, enum
  pass-through.
- Composables: `src/composables/useAgentWorkflowRuns.ts`, `src/composables/useN8nWorkflowRuns.ts`
  (see the per-page `.data.md` files) + **barrel lines in `src/index.ts`** (the #1 miss).
- Tenant-app re-exports: `apps/tenant-app/app/composables/useAgentWorkflowRuns.ts`,
  `useN8nWorkflowRuns.ts`.

---

## Navigation (R14)

Two tool rows appended to the site-admin module's tool array in
`db/fnb-app/deploy/00000000010240_app_fn.sql` (`:353–357` block):

```sql
,row('tenant-site-admin-wf-agentic'::citext,'Agentic Workflows'::citext,'{"p:app-admin-super"}'::citext[],'i-lucide-bot'::citext,'/tenant/site-admin/wf-agentic',0)::app_fn.tool_info
,row('tenant-site-admin-wf-n8n'::citext,'n8n Workflows'::citext,'{"p:app-admin-super"}'::citext[],'i-lucide-workflow'::citext,'/tenant/site-admin/wf-n8n',0)::app_fn.tool_info
```

No new module, no new permission keys — `p:app-admin-super` exists. Edit-in-place
(memory `feedback_sqitch_edit_in_place`; dev env rebuilds from scratch).

---

## Tenancy

Same as the agentic model: workflows are global; tenant context travels in the trigger payload
(the plugin injects `tenantId`/`profileId` from claims) and is recorded on
`n8n.workflow_run.tenant_id`. Run visibility is RLS on the run table; the panel read is the
super-admin-gated `_api` function.

---

## Security model

| Property | Enforcement |
|---|---|
| n8n cannot reach beyond its grants | `n8n_worker` is `NOINHERIT` with the demo-scope inventory only (`n8n_fn.*` + `app_api.raise_exception`); no table SELECTs, no other schemas |
| Webhook forgery | `X-Fnb-Webhook-Secret` header-auth credential on every fnb-triggered Webhook node; secret exists only in env (n8n credential import + graphql-api-app) |
| Engine isolation | n8n state in `n8n_engine` (separate DB); sqitch/PostGraphile never see it; `agent_worker` and `n8n_worker` are distinct roles with distinct grant inventories |
| Panel reads | `n8n_api.workflow_runs` / `agent_api.workflow_runs` gate `p:app-admin-super` in SQL (R12); the nav/permission gating client-side is a UI hint only (R13) |
| Trigger authz | The plugin registry's `permission` field enforced against claims before any POST (parity with today) |
| Secrets | `N8N_ENCRYPTION_KEY`, `N8N_ENGINE_DB_PASSWORD`, `N8N_WORKER_PG_PASSWORD`, `N8N_WEBHOOK_SECRET` in env only; credential templates render at import time, never committed rendered |
