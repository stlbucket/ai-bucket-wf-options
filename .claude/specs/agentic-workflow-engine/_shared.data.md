---
name: agentic-workflow-engine-shared
description: Shared integration architecture for the agentic workflow engine — the db/fnb-agent package (run log + agent_worker role + grants), the agent-app trigger contract, the harness/toolbox conventions (agents-as-code), the triggerWorkflow GraphQL mutation, tenancy, and the security model.
metadata:
  type: reference
---

## Status
**Implemented 2026-07-17.** Corrections from the build (authoritative where they differ from
the body below):

- **Toolbox closure requires `tools: []`** in `query()` options — `allowedTools` alone only
  gates permission; built-in tools stay visible and the model wastes turns attempting them
  (observed live). The harness sets both, plus `env: { ...process.env, IS_SANDBOX: '1' }`
  (`bypassPermissions` refuses to run as root without it; the container is a sandbox).
- **`agent_fn` gained `sweep_orphaned_runs()`** + a boot sweep in the scheduler plugin: a
  restart kills in-flight runs with the process, and a stranded `running` row would block
  singleton workflows forever. Any `running` row at boot flips to
  `error | orphaned-by-restart`.
- **The exerciser grant targets `app_api.raise_exception`** (`app_fn.raise_exception` does not
  exist), and the grant lives in **fnb-agent's policies change**, not fnb-app — fnb-app deploys
  before the `agent_worker` role exists on a fresh rebuild.
- **`agent_worker`'s password flows via `sqitch deploy --set agent_worker_password=…`** from
  `AGENT_WORKER_PG_PASSWORD` (threaded through `docker/migrate-entrypoint.sh` and
  `scripts/db-deploy.ts`; psql vars don't interpolate inside `DO $$` bodies, hence the
  DO-guard + separate `ALTER ROLE … PASSWORD`).
- **`agent_api.workflow_runs` collides with the table's auto-generated `workflowRunsList`**
  root field — a smart tag on `agent.workflow_run`
  (`-query:resource:list -query:resource:connection` in `postgraphile.tags.json5`) drops the
  table's root query fields; reads go through the gated function.
- The harness passes `runId` into goals; tools needing run context (the exerciser waiter) take
  it as a zod param. The "resume URL in result_data" idea was dropped — a mid-run result write
  would breach harness-owned terminal writes; the URL is derivable from the 202's runId and
  appears in app logs + the transcript.

> This spec is the **competing alternative** to `.claude/specs/n8n-workflow-engine/` — same
> mission (full replacement of wf/worker-app/dashboard), same workflow inventory, different
> engine. Exactly one of the two gets implemented. Contracts deliberately shared with that spec
> (the `triggerWorkflow` mutation, the `storage_fn` additions, the sync-status rework, the
> post-commit upload trigger, the decommission inventory) are stated identically here so the
> comparison is apples-to-apples.

---

## Architecture at a glance

```
                        ┌─────────────────────────────────────────────────────┐
                        │ apps/agent-app (headless Nuxt, no nginx route)      │
  upload.post.ts ─POST──▶ /api/trigger/asset-scan                             │
  triggerWorkflow ─POST─▶ /api/trigger/sync-breweries /sync-airports /...     │
  (grafast plugin)      │                                                     │
                        │  harness (begin_run → query() → terminal write)     │
                        │    └─ Claude Agent SDK run: goal prompt +           │
                        │       closed toolbox of custom MCP tools            │
                        │  croner scheduler: asset-scan-reaper (deterministic)│
                        │  transcripts: /data/transcripts/<runId>.jsonl       │
                        └───────────────┬─────────────────────────────────────┘
                                        │ pg pool as role agent_worker (tools only)
                                        ▼
                        function_bucket DATABASE
                        agent / agent_fn / agent_api  ← run log (db/fnb-agent)
                        storage_fn.* location_datasets_fn.* airports_fn.*
```

- **fnb → agent-app** is always an HTTP POST to `${AGENT_INTERNAL_URL}/api/trigger/<workflow-key>`
  authenticated by a shared-secret header (`X-Fnb-Trigger-Secret: $AGENT_TRIGGER_SECRET`).
  Fire-and-forget: the route validates, writes `begin_run`, responds `202 { accepted, runId }`,
  and the agent run continues async. Completion is observed via `agent.workflow_run`, never by
  holding the HTTP call open. (Same contract shape as the n8n spec's webhooks — callers are
  byte-for-byte comparable.)
- **agent-app → fnb** is always the dedicated `agent_worker` PG role calling SECURITY DEFINER
  `_fn` functions — but *only from inside tool handlers*. The model never sees a connection
  string, never writes SQL, and can only invoke the closed, zod-validated toolbox. agent-app
  never connects as `authenticator`/`authenticated` and never goes through PostGraphile — it is
  a service-level actor, exactly like the retired worker-app's root-of-trust connection.
- **No new database, no import job.** Agent definitions are TypeScript in the repo
  (`apps/agent-app/server/lib/agent-workflows/`); the only new persistent state is the
  `agent.workflow_run` log inside `function_bucket` and a transcripts volume.

---

## The `db/fnb-agent` sqitch package (new)

New package (scaffold via `new-db-package`; register in `DEPLOY_PACKAGES` after `fnb-app`,
replacing `fnb-wf`'s slot). It owns the integration surface between agent-app and
`function_bucket`.

### Schema: `agent` / `agent_fn` / `agent_api` (house trio, R8)

```sql
CREATE SCHEMA agent;

CREATE TYPE agent.workflow_run_status AS ENUM ('running', 'success', 'error');

-- One row per agent execution of an fnb workflow. The app-side observability substitute for
-- the retired wf.uow DAG: enough for "is a sync running?", "when did the last one finish?",
-- and the reaper's attempt cap — the step-level record is the per-run transcript JSONL.
CREATE TABLE agent.workflow_run (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_key citext NOT NULL,              -- 'asset-scan' | 'sync-breweries' | ...
  agent_session_id text,                     -- SDK session id (correlates to the transcript)
  model text,                                -- model that ran it (audit + cost attribution)
  tenant_id uuid REFERENCES app.tenant(id),  -- nullable: dataset syncs are anchor-wide
  status agent.workflow_run_status NOT NULL DEFAULT 'running',
  input_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  error jsonb NOT NULL DEFAULT '{}'::jsonb,
  usage jsonb NOT NULL DEFAULT '{}'::jsonb,  -- tokens, turns, cost_usd from the SDK result
  started_at timestamptz NOT NULL DEFAULT current_timestamp,
  finished_at timestamptz
);
CREATE INDEX idx_agent_workflow_run_key_status ON agent.workflow_run (workflow_key, status);
CREATE INDEX idx_agent_workflow_run_input ON agent.workflow_run USING gin (input_data);
```

RLS (R9): enabled; SELECT policy for `jwt.has_permission('p:app-admin-super', tenant_id)` plus a
`tenant_id IS NULL` anchor-visible read for super admins. `agent_worker` writes via the
SECURITY DEFINER `_fn` functions below, so no INSERT/UPDATE policies are needed.

### `agent_fn` (SECURITY DEFINER; EXECUTE granted to `agent_worker`)

All terminal-state writes are **harness-owned** (see Harness below) — no function here is ever
called at the model's discretion; tools call `_fn` functions in other modules, the harness calls
these.

| Function | Signature | Called by |
|---|---|---|
| `begin_run` | `(workflow_key citext, input_data jsonb, tenant_id uuid default null, model text default null) → uuid` | trigger route, before the SDK run starts |
| `attach_session` | `(run_id uuid, agent_session_id text) → void` | harness, when the SDK init message yields the session id |
| `complete_run` | `(run_id uuid, result_data jsonb default '{}', usage jsonb default '{}') → agent.workflow_run` | harness, after a run that called the `complete_run` tool |
| `error_run` | `(run_id uuid, error jsonb, usage jsonb default '{}') → agent.workflow_run` | harness catch-all (SDK error, timeout, max-turns, missing terminal) |
| `running_count` | `(workflow_key citext) → int` | sync-status fns, reaper, singleton guard |

### `agent_api` (SECURITY INVOKER; PostGraphile surface)

| Function | Purpose |
|---|---|
| `workflow_runs(workflow_key, paging)` | recent runs for an admin/status panel (gated `p:app-admin-super`) |

Add `agent, agent_api` to `pgServices.schemas` in
`apps/graphql-api-app/server/graphile.config.ts` (and remove `wf, wf_api` — see
`decommission.data.md`).

### The `agent_worker` role + grants

Created in this package's first deploy script (idempotent `DO $$ ... CREATE ROLE ... $$` guard):

```sql
CREATE ROLE agent_worker LOGIN PASSWORD :'agent_worker_password' NOINHERIT;  -- password via env at deploy
```

Grants live in a dedicated change **in each owning module's package** (house pattern: the module
owns its grant surface). The inventory is identical to the n8n spec's — derived from what the
retired handlers actually call — with the role renamed:

| Package (new change) | Grant to `agent_worker` |
|---|---|
| `fnb-agent` | `USAGE` on `agent`, `agent_fn`; `EXECUTE` on all `agent_fn.*` above |
| `fnb-storage` | `EXECUTE` on `storage_fn.resolve_asset_scan`, `storage_fn.insert_derived_asset`, `storage_fn.add_asset_tags`; new `storage_fn.asset_for_scan(uuid)` + `storage_fn.stuck_pending_assets(stuck_minutes int, max_attempts int)` (attempt count reads `agent.workflow_run` where `workflow_key='asset-scan'`); `USAGE` on `storage`, `storage_fn` |
| `fnb-location-datasets` | `EXECUTE` on `location_datasets_fn.upsert_breweries`; `USAGE` on the schemas |
| `fnb-airports` | `EXECUTE` on `airports_fn.upsert_*` (all CSV upsert fns), `airports_fn.record_sync_source`; `SELECT` on `airports.sync_source` (etag conditional-GET read); `USAGE` on the schemas |
| `fnb-app` | `EXECUTE` on `app_fn.raise_exception` (exerciser demo only) |

Rule going forward: **agent tools reach fnb data exclusively through `_fn` functions** (the two
existing raw `SELECT`s from `storage.asset` in the retired scan/thumbnail handlers become
`storage_fn.asset_for_scan`); direct table grants are limited to the `airports.sync_source`
etag read. The model itself reaches *nothing* — only tool handlers hold the pool.

### Sync-status rewrite (owning packages, sqitch rework)

`location_datasets_fn.brewery_sync_status` and `airports_fn.airport_sync_status` currently derive
`in_progress` from `wf.wf`/`wf.uow`. Rework both to:

```sql
_retval.in_progress := agent_fn.running_count('sync-breweries') > 0;
```

The GraphQL surface (`brewerySyncStatus` / `airportSyncStatus`) and the composables' polling
behavior are unchanged — pages don't change.

---

## Trigger contract (fnb → agent-app)

- Route: `apps/agent-app/server/api/trigger/[key].post.ts`. Auth: header
  `X-Fnb-Trigger-Secret` must equal `$AGENT_TRIGGER_SECRET` → else `401`. Unknown workflow key
  → `404`. Body is validated against the workflow definition's **zod `inputSchema`** → `400`
  with the zod issues on mismatch (typed input definitions — a capability the wf engine had and
  the n8n conversion gave up).
- `AGENT_TRIGGER_SECRET` is a required env var shared by: `agent-app`, `graphql-api-app`
  (triggerWorkflow plugin), and `storage-layer` (upload endpoint). Rotation = change env +
  restart (no credential store to re-import).
- Callers POST to `${AGENT_INTERNAL_URL}/api/trigger/<workflow-key>` — the compose-internal URL
  (`http://agent-app:3000`). Responses are `202 { accepted: true, runId }` fire-and-forget;
  completion is observed via `agent.workflow_run`, never by holding the HTTP call open.
- Singleton workflows (`singleton: true` in the definition — the two dataset syncs): the route
  checks `agent_fn.running_count(key)` **before** `begin_run` and answers
  `200 { accepted: false, reason: 'already-running' }`. Suppressed double-fires appear in app
  logs, not the run log (deliberate — cheaper than the n8n spec's begin-then-skip run row).

---

## Agents-as-code — the workflow definition convention

Definitions are TypeScript modules in **`apps/agent-app/server/lib/agent-workflows/<key>.ts`**,
registered in a static map (`agent-workflows/index.ts`). No runtime workflow store, no import
job — a workflow changes by editing code, exactly like the retired task handlers.

```ts
// apps/agent-app/server/lib/agent-workflows/types.ts
export interface AgentWorkflowDefinition<TInput> {
  key: string                       // route path + workflow_run.workflow_key + run-log key
  inputSchema: ZodType<TInput>      // trigger-body contract (400 on mismatch)
  model?: string                    // default $AGENT_MODEL_DEFAULT (claude-haiku-4-5)
  maxTurns: number                  // hard SDK turn budget, sized per workflow
  singleton?: boolean               // pre-begin concurrency guard via agent_fn.running_count
  tools: FnbAgentTool[]             // the closed toolbox (harness injects complete_run)
  goal: (input: TInput, ctx: { runId: string }) => string   // the run prompt
}
```

- **Tools** are Claude Agent SDK custom tools (`tool(name, description, zodShape, handler)`)
  grouped by domain in `apps/agent-app/server/lib/agent-tools/<domain>.ts` and served in-process
  via `createSdkMcpServer` — no external MCP transport. Handlers own all side effects: the
  `agent_worker` pg pool, the S3 client, `clamdscan`/`ffmpeg` child processes, HTTP fetches, and
  their own `/tmp` cleanup.
- **Deterministic-tools principle (locked):** any invariant-bearing state transition is a single
  atomic tool. The agent orchestrates — chooses order, retries, branch decisions, reporting —
  but never adjudicates a security verdict and never composes a critical transition out of
  smaller primitives. Concretely: scan-verdict + promote/purge is ONE tool
  (`scan_and_resolve`), not `clamdscan` + `s3_copy` + `s3_delete` the model could mis-sequence.
- **Goal prompts** state: the input, the job, the tool contract, the required terminal act
  ("finish by calling `complete_run` with …"), and what judgment the agent owns (retry policy
  edges, partial-failure handling, result summarization). Keep bulk data out of the context —
  macro tools return counts/summaries, not rows.

---

## The harness (`apps/agent-app/server/lib/agent-harness.ts`)

One function, `runWorkflow(def, input, { tenantId })`, owns the full run lifecycle:

1. `agent_fn.begin_run(key, input, tenantId, model)` → `runId`; the trigger route responds
   `202` here and the rest runs detached.
2. Build the toolbox: `def.tools` + the harness-injected **`complete_run` tool** (schema:
   `{ resultData: object }`). The tool handler does **not** write the DB — it hands
   `resultData` to the harness and acknowledges. Terminal writes are harness-owned.
3. `query({ prompt: def.goal(input, { runId }), options })` with:
   - `model: def.model ?? $AGENT_MODEL_DEFAULT`, `maxTurns: def.maxTurns`
   - `mcpServers: { fnb: createSdkMcpServer({ tools }) }`
   - `allowedTools`: **only** the `mcp__fnb__*` tool names — no built-in Bash/FS/Web tools,
     `settingSources: []` (no filesystem settings), `permissionMode: 'bypassPermissions'`
     (safe: the toolbox is closed and every handler zod-validates its params)
4. Stream messages: append every message to the transcript
   (`/data/transcripts/<runId>.jsonl`); on the init message, `agent_fn.attach_session`.
5. Terminal accounting from the SDK result message (`usage`, `total_cost_usd`, turn count):
   - `complete_run` tool was called → `agent_fn.complete_run(runId, resultData, usage)`
   - anything else — SDK error, wall-clock timeout (`$AGENT_RUN_TIMEOUT_MINUTES`), `maxTurns`
     exhausted, run ended without the terminal tool → `agent_fn.error_run(runId, error, usage)`

This harness catch-all is the analog of the retired `_workflowHandler`'s catch →
`wf_fn.error_uow` (and of the n8n spec's shared `error-handler` workflow): one place turns any
failure into a terminal `workflow_run.status = 'error'`. It is code, not a workflow.

**Scheduling:** a Nitro plugin (`server/plugins/agent-scheduler.ts`) runs
[croner](https://github.com/hexagon/croner) jobs in-process — the only one in scope is the
asset-scan reaper (`$ASSET_SCAN_REAPER_CRON`), which is **deterministic code, not an agent**
(`asset-scan.workflow.data.md`). No graphile-worker anywhere.

---

## `triggerWorkflow` — the app-originated trigger surface

Identical in shape to the n8n spec's (deliberately — pages and composables are engine-agnostic).
Replaces the retired `queueWorkflow` GraphQL mutation with a **PostGraphile `extendSchema`
plugin** in `apps/graphql-api-app/server/api/` (house carve-out: transport code, R7-thin):

```graphql
extend type Mutation {
  triggerWorkflow(workflowKey: String!, inputData: JSON): TriggerWorkflowResult
}
type TriggerWorkflowResult { accepted: Boolean!, runId: UUID }
```

Plugin behavior:
1. Read `event.context.claims` — **401 if absent** (parity with `wf_api.queue_workflow`).
2. Check the workflow key against a **static allow-map** in the plugin:
   `{ 'sync-breweries': null, 'sync-airports': null, 'exerciser': 'p:app-admin-super' }`
   (`null` = any authenticated user; a `p:` key = require
   `claims.permissions.includes(key)`). Unknown key → GraphQL error. `asset-scan` is
   deliberately NOT in the map — only the upload endpoint fires it.
3. POST `{ ...inputData, tenantId: claims.tenantId, profileId: claims.profileId }` to
   `${AGENT_INTERNAL_URL}/api/trigger/<workflowKey>` with the secret header.
4. Return `{ accepted, runId }` from the trigger response.

Client side: one `.graphql` mutation document
(`packages/graphql-client-api/src/graphql/agent/mutation/triggerWorkflow.graphql`), codegen, and
a `useTriggerWorkflow` composable. `useBreweries.queueSync()` / `useAirports.queueSync()` swap
`useQueueWorkflow` for `useTriggerWorkflow` — **their public API and the pages are unchanged**
(R1: pages never see the transport change).

---

## Tenancy model (changed — deliberate, same as the n8n spec)

The wf module was tenant-scoped (per-tenant templates, RLS on instances). Agent workflow
definitions are **global singletons in code**; tenant context travels **in the trigger payload**
and is recorded on `agent.workflow_run.tenant_id`. Consequences, accepted under the
Full-replacement decision:

- No per-tenant template seeding (`storage_fn.ensure_asset_scan_wf` retires; nothing replaces it).
- Tenant-scoped *visibility* of runs is via `agent.workflow_run` RLS, not workflow cloning.
- Per-tenant workflow *customization* is out of scope; if it ever returns, it becomes a
  per-tenant branch in the goal prompt or a tenant-keyed tool, not template cloning.

---

## Security model

| Property | Enforcement |
|---|---|
| Model cannot touch the system | No built-in tools (`allowedTools` whitelist = the `mcp__fnb__*` set only, `settingSources: []`); the only capabilities are the closed toolbox |
| Model cannot write SQL | No SQL tool exists; tool handlers call fixed, parameterized `_fn` functions on the `agent_worker` pool |
| DB blast radius | `agent_worker` is `NOINHERIT` with the least-privilege grant inventory above — even a fully compromised run can only execute the granted fns (RLS-independent: they are the same fns the retired trusted worker called) |
| Security verdicts are never model output | Deterministic-tools principle: `scan_and_resolve` computes and records the clamdscan verdict atomically; the model routes on the *returned* verdict but cannot invent one |
| Prompt injection surface | External content does enter context (asset filenames/MIME, HTTP error bodies, per-file sync summaries) — bounded by the closed toolbox + zod param validation; bulk external data (CSV rows, brewery pages) never enters context (macro tools return counts) |
| Secrets | `ANTHROPIC_API_KEY`, `AGENT_WORKER_PG_PASSWORD`, S3 keys exist only in agent-app env; the trigger secret additionally in graphql-api-app + storage-app; nothing in prompts or transcripts |
| Run budgets | `maxTurns` per definition + `$AGENT_RUN_TIMEOUT_MINUTES` wall-clock cap + per-run `usage`/cost recorded on the run row |

**Cost model:** default model `claude-haiku-4-5` (env `AGENT_MODEL_DEFAULT`, per-definition
override). The most turn-heavy workflow (sync-breweries, ~45 tool-loop turns with tiny payloads)
is single-digit cents on haiku; asset-scan is ~6 turns. `usage` on every run row keeps this
honest and queryable (`agent_api.workflow_runs`).

---

## Observability — what replaces the Workflow Dashboard

The VueFlow dashboard (`/graphql-api/workflow`) retires with the wf module. Its replacement:

- **Step-level history / debugging** → the per-run **transcript JSONL**
  (`agent-transcripts` volume, `/data/transcripts/<runId>.jsonl`) — every message, tool call,
  and tool result of the run, correlated from `workflow_run.agent_session_id` /
  `workflow_run.id`. Dev posture: read via `docker exec` or a host mount; no viewer UI in scope.
- **In-app tenant-scoped status** → `agent.workflow_run` via `agent_api.workflow_runs`
  (already consumed by the sync-status fns; an admin runs panel is a possible later addition,
  not in scope here).
- The `tenant-site-admin-wf` nav tool row is removed from
  `db/fnb-app/deploy/00000000010240_app_fn.sql` (nav is DB-registered, R14).
