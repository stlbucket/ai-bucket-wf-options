---
name: agentic-decommission-shared
description: The engine-collapse architecture — the n8n-only triggerWorkflow registry, single-engine sync guard and in_progress rework, the n8n_worker storage grants + stuck_pending_assets rewire for asset-scan, the site-admin client-layer removal, and the security model after the agentic engine is gone.
metadata:
  type: reference
---

## Status
**Draft.** Builds directly on `.claude/specs/n8n-parallel-engine/_shared.data.md` (the n8n
run-log, `n8n_worker` role, webhook auth, smart tags — all unchanged) and reverses
`.claude/specs/agentic-workflow-engine/_shared.data.md` (deleted in Phase 5). This file specs
only the deltas that collapse the two engines to one.

---

## Architecture after the collapse

```
  triggerWorkflow ──registry (n8n-only)──▶ n8n container  /webhook/<key>
  (grafast plugin, graphql-api-app)         X-Fnb-Webhook-Secret
                                            state: n8n_engine DATABASE (same PG cluster)
                                                      │ pg connection as role n8n_worker
                                                      ▼
                                            function_bucket DATABASE
                                            n8n / n8n_fn / n8n_api        ← run log (db/fnb-n8n)
                                            storage_fn.* (asset-scan)     ← NEW n8n_worker grants
                                            location_datasets_fn / airports_fn (syncs)
                                            app_api.raise_exception (exerciser demo)

  upload endpoint ─POST /webhook/asset-scan─▶ n8n  (was → agent-app /api/trigger/asset-scan)

  site-admin (tenant-app):  /tenant/site-admin/wf-n8n → n8n_api.workflow_runs   (sole tool)
                            /tenant/site-admin/wf-agentic  ← DELETED
```

The agent-app path, `agent`/`agent_api` schemas, `agent_worker`, and `AGENT_*` env are all gone
(`decommission.data.md`). Every fnb→workflow call is now the single n8n webhook path.

---

## `triggerWorkflow` — collapse to an n8n-only registry

`apps/graphql-api-app/server/graphile/trigger-workflow.plugin.ts`. Phase 1 flips the two moving
keys while the `engine` field still exists; **Phase 4 removes the field, the `agent` branch, and
the `AGENT_*` env reads** so the plugin only ever POSTs the n8n webhook.

Final shape (Phase 4):

```ts
// Every fnb workflow runs on n8n. `permission`: null = any authenticated user; a string =
// require that key; a string[] = any-of (jwt.enforce_any_permission parity, used by game-event).
const WORKFLOW_REGISTRY: Record<string, { permission: string | string[] | null }> = {
  'sync-breweries': { permission: null },                      // moved from agent (Phase 1)
  'sync-airports': { permission: null },                       // moved 2026-07-20
  exerciser: { permission: 'p:app-admin-super' },              // rekeyed from n8n-exerciser
  'game-event': { permission: ['p:app-user', 'p:app-admin'] }
}
// asset-scan stays ABSENT — upload-endpoint + reaper only, never the app registry.
// Retired keys: n8n-sync-breweries, n8n-exerciser (rekeyed to the production names above).
```

The lambda drops the engine branch to a single POST:

```ts
const response = await fetch(`${requiredEnv('N8N_INTERNAL_URL')}/webhook/${workflowKey}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-fnb-webhook-secret': requiredEnv('N8N_WEBHOOK_SECRET') },
  body: JSON.stringify({ ...(inputData ?? {}), tenantId: claims.tenantId, profileId: claims.profileId })
})
if (!response.ok) throw new Error(`workflow trigger failed: ${response.status}`)
return { accepted: response.ok, runId: null }   // respond-immediately webhook; runId already nullable
```

`TriggerWorkflowResult` (`{ accepted: Boolean!, runId: UUID }`) is unchanged — the client
mutation document and `useTriggerWorkflow` need no codegen. `requiredEnv('AGENT_INTERNAL_URL')`
and `requiredEnv('AGENT_TRIGGER_SECRET')` are deleted from this file.

**Rekey mechanics (Phase 1)** — mirror the 2026-07-20 airports move exactly:
- `n8n/workflows/n8n-sync-breweries.json` → renamed `sync-breweries.json`; same n8n id; the
  Webhook node `path` and the `begin_run(...)` workflow-key literal both become `sync-breweries`.
- `n8n/workflows/n8n-exerciser.json` → renamed `exerciser.json`; Webhook `path` +
  `begin_run`/`error_run` key literals become `exerciser`.
- The wf-n8n page's trigger-card key list gains `sync-breweries`, `sync-airports`, `exerciser`
  (it drops the `n8n-` prefixed keys). No `asset-scan` (upload-only).

---

## Single-engine sync guard + `in_progress` (Phase 1 DB rework, edit-in-place)

With no second engine, the cross-engine machinery collapses. Dev rebuilds from scratch, so these
are edit-in-place changes (memory `feedback_sqitch_edit_in_place`); `sqitch-expert` handles any
dependency edits.

| Change | Rework |
|---|---|
| `db/fnb-n8n/deploy/00000000011210_n8n_fn.sql` | **Delete `n8n_fn.dataset_sync_busy(citext, citext)`** (the two-arg cross-engine helper) and its `fnb-agent:00000000011110_agent_fn` sqitch dep. The sync workflows' guard node uses the existing `n8n_fn.running_count(citext)` directly: `select n8n_fn.running_count('sync-breweries') > 0 as busy`. Sweep this file (and `00000000011230_n8n_policies.sql`, `00000000011200_n8n.sql`) for any remaining `agent.`/`agent_fn.` references and remove them |
| `db/fnb-location-datasets/deploy/00000000010710_location_datasets_fn.sql` | Drop the `agent_worker` grant block. `brewery_sync_status`: `in_progress := n8n_fn.running_count('sync-breweries') > 0;` (was `agent_fn.running_count('sync-breweries') > 0 or n8n_fn.running_count('n8n-sync-breweries') > 0`). Drop the `fnb-agent` sqitch dep |
| `db/fnb-airports/deploy/00000000010810_airports_fn.sql` | Drop the `agent_worker` grant block. `airport_sync_status`: `in_progress := n8n_fn.running_count('sync-airports') > 0;`. The `n8n_worker` grants stay (production key). Drop the `fnb-agent` sqitch dep |

GraphQL shapes are unchanged — `in_progress` now means "n8n is syncing this dataset". No
codegen, no composable, no page change (the datasets pages' Sync buttons trigger the same keys,
now on n8n).

---

## Storage grants for asset-scan (`n8n_worker`) + reaper rewire (Phase 2)

`db/fnb-storage/deploy/00000000010640_storage_agent_worker.sql` is the asset-scan grant surface.
Rework it (rename the change to `storage_n8n_worker` via `sqitch-expert`, or edit in place —
implementer's call; dev rebuilds so either is safe) so **`n8n_worker`** holds what `agent_worker`
held, and `stuck_pending_assets` reads the **n8n** run log:

- Grants (swap `agent_worker` → `n8n_worker`): `USAGE` on `storage`, `storage_fn`; `EXECUTE` on
  `asset_for_scan(uuid)`, `stuck_pending_assets(int,int)`, `resolve_asset_scan(uuid,
  storage.scan_status, text, text)`, `insert_derived_asset(...)`, `add_asset_tags(uuid,citext[])`.
- Sqitch dep: `fnb-n8n:00000000011230_n8n_policies` (the `n8n_worker` role must exist —
  `fnb-n8n` deploys before `fnb-storage` in `DEPLOY_PACKAGES`). Drop the `fnb-agent` dep.
- `storage_fn.stuck_pending_assets`: every `agent.workflow_run` reference → **`n8n.workflow_run`**
  (three places: the at-cap attempt-count subquery, the `ai_tags_requested` recovery subquery,
  and the live-run `not exists` guard). Semantics identical; the attempt count and
  `ai_tags_requested` now come from the n8n run rows the reaper produces.

`asset_for_scan` and `resolve_asset_scan` bodies are unchanged — only the grantee and the reaper
helper's run-log source change.

---

## Client layer removal (Phase 4)

The site-admin **Agentic Workflows** page and its whole read path are deleted; the trigger
mutation (engine-agnostic) is relocated, not deleted.

| Target | Action |
|---|---|
| `apps/tenant-app/app/pages/site-admin/wf-agentic/` | **delete** the page |
| `db/fnb-app/deploy/00000000010240_app_fn.sql` | **delete** the `tenant-site-admin-wf-agentic` tool row (R14 nav); keep `tenant-site-admin-wf-n8n` |
| `packages/fnb-types/src/workflow-run.ts` | remove the `AgentWorkflowRun` interface; **keep** `WorkflowRunStatus` + `N8nWorkflowRun` |
| `packages/graphql-client-api/src/graphql/agent/query/agentWorkflowRuns.graphql` | **delete** |
| `packages/graphql-client-api/src/graphql/agent/mutation/triggerWorkflow.graphql` | **relocate** to `src/graphql/n8n/mutation/triggerWorkflow.graphql` (engine-agnostic doc; the `agent/` dir then disappears). Update the codegen document glob if it is path-scoped |
| `packages/graphql-client-api/src/mappers/agent-workflow-run.ts` | **delete** |
| `packages/graphql-client-api/src/composables/useAgentWorkflowRuns.ts` | **delete** + its `src/index.ts` barrel line |
| `apps/tenant-app/app/composables/useAgentWorkflowRuns.ts` | **delete** (re-export) |
| generated output | re-run codegen after `agent`/`agent_api` leave the schema — the `AgentWorkflowRuns` operation and the `agent_api.workflowRuns` field vanish; fix fallout |

`useN8nWorkflowRuns`, `N8nWorkflowRun`, and the wf-n8n page are all untouched (they read
`n8n_api.workflow_runs`). `useTriggerWorkflow` is untouched (same mutation, relocated document).

---

## Security model after decommission

| Property | Enforcement |
|---|---|
| One service actor | `n8n_worker` (`NOINHERIT`) is the only workflow role; grant inventory = `n8n_fn.*` + `app_api.raise_exception` + the storage/datasets/airports `_fn` grants for the migrated workflows. `agent_worker` is dropped |
| Webhook forgery | `X-Fnb-Webhook-Secret` header-auth on every fnb-triggered Webhook node (unchanged) |
| Scan verdict integrity | The `asset-scan` DAG is the sole authority (`asset-scan.workflow.data.md` → Security); `resolve_asset_scan` guards on `scan_status='pending'`; no model in the loop |
| Engine isolation | n8n state in `n8n_engine` (separate DB); sqitch/PostGraphile never see it |
| Panel reads | `n8n_api.workflow_runs` gates `p:app-admin-super` in SQL (R12). The agentic panel + `agent_api.workflow_runs` are gone |
| Trigger authz | The plugin registry's `permission` field, enforced against claims before the POST (unchanged) |
| Secrets | `N8N_*` + `ANTHROPIC_API_KEY` in env only; credential templates render at import time. All `AGENT_*` secrets removed |
