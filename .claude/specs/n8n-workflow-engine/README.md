> **SUPERSEDED 2026-07-17 — the agentic alternative was chosen and implemented.** This spec's
> competing sibling, `.claude/specs/agentic-workflow-engine/`, was executed (plan
> `0015__wf________agentic-workflow-engine_________MED__`): the wf module, worker-app, and the
> Workflow Dashboard are retired and `apps/agent-app` (Claude Agent SDK) is the stack's only
> workflow engine (R22). **Do not execute this spec** — its retirement inventory has already
> been carried out by the agentic plan; the n8n engine sections are a historical record of the
> road not taken.

# n8n Workflow Engine — migration from graphile-worker (Full replacement)

## Status
Draft — decisions locked 2026-07-17; no `[FILL IN]` markers; open questions below are
deferred/non-blocking.

## Purpose

Replace the entire fnb workflow system — the graphile-worker runner (`apps/worker-app`), the
`wf` module (schema, UOW DAG, templates), and the VueFlow Workflow Dashboard — with a
self-hosted **n8n** engine running as a Docker container inside this architecture (not n8n
cloud). All current workflows convert: the **asset-scan** pipeline (+ its reaper),
**sync-breweries**, **sync-airports**, and the **exerciser** demo, plus a new shared
**error-handler** workflow. Workflow definitions become code (`n8n/workflows/*.json`, imported
at boot); app-side observability shrinks to a deliberate minimum (`n8n.workflow_run` run log);
step-level debugging moves to the n8n editor.

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| Scope | **Full replacement** — wf schema, UOW DAG, dashboard all retire | User decision 2026-07-17. One workflow system, not two; n8n's editor + execution log replace the bespoke dashboard |
| n8n state storage | Separate **`n8n_engine` database** in the existing postgis container | User decision (recommended option). No new container; fully isolated from sqitch + PostGraphile. Named `n8n_engine` (not `n8n`) so it can't be confused with the `n8n` integration schema in `function_bucket` |
| fnb → n8n trigger | **HTTP webhooks** with shared-secret header | User decision (recommended option). Deterministic, testable, standard n8n pattern |
| Editor exposure | **Own host port** (`N8N_HOST_PORT`), no nginx route | User decision (recommended option). ZITADEL precedent; avoids n8n path-prefix fragility; operator tool, not app surface |
| n8n → fnb data access | Dedicated `n8n_worker` PG role calling `_fn` functions only | Mirrors the retired worker's root-of-trust position; least-privilege grant inventory in `_shared.data.md` |
| App-side run state | New `db/fnb-n8n` package: `n8n.workflow_run` + `n8n_fn` begin/complete/error | Sync-status fns and the reaper attempt-cap need *something* queryable in-DB; this is the minimum, with n8n's log as the deep record |
| Trigger surface for pages | `triggerWorkflow` extendSchema mutation in graphql-api-app | Keeps pages/composables on GraphQL (R1); replaces `queueWorkflow` with same auth parity |
| Tenancy | n8n workflows are **global singletons**; tenant travels in the payload, recorded on `workflow_run.tenant_id` | Full-replacement consequence; per-tenant template cloning had no real customization use |
| Workflow-as-code | `n8n/workflows/*.json` + `n8n/credentials/*.json.tpl`, imported by a one-shot job before server start | Definitions rebuild like sqitch/seed; secrets only via env + envsubst |
| Error handling | One shared `error-handler` workflow (n8n Error Workflow) → `n8n_fn.error_run_by_execution` | Single catch-all replaces `_workflowHandler`'s catch → `error_uow` |
| Binary steps (clamd, ffmpeg) | Custom image (`docker/n8n/Dockerfile`: ffmpeg + clamav-clients) + Execute Command on `/tmp` files | No Code-node socket/builtin relaxation; pins n8n version (zitadel precedent) |
| Upload → scan atomicity | Post-commit webhook POST, failures swallowed; reaper (n8n cron) owns stranded-`pending` assets | Trades the old SQL-enqueue atomicity for the reaper contract that already existed |
| Dashboard nav | `tenant-site-admin-wf` tool row removed; no in-app replacement in scope | Editor covers debugging; `n8n_api.workflow_runs` exists if an admin panel is wanted later |
| Sync concurrency | Workflows self-guard via `n8n_fn.running_count` short-circuit | Cheap now that a run log exists; old engine had no guard |

## Files in this spec

| File | Contents |
|---|---|
| `README.md` | This index: decisions, task list, open questions |
| `_shared.data.md` | Integration architecture: `db/fnb-n8n` package, `n8n_worker` grants, webhook auth, `triggerWorkflow` mutation, tenancy, workflow-as-code + error-handler conventions |
| `infrastructure.md` | Compose services (`n8n-db-init`, `n8n-import`, `n8n`), custom Dockerfile, env vars, boot order, editor access, infra verification |
| `asset-scan.workflow.data.md` | asset-scan + asset-scan-reaper conversion; upload-endpoint trigger change |
| `dataset-sync.workflow.data.md` | sync-breweries + sync-airports conversion; sync-status rewiring |
| `exerciser.workflow.data.md` | exerciser demo conversion (wait/resume, error paths) |
| `decommission.data.md` | Full retirement inventory + R21 propagation + final verification checklist |

## Implementation Task List

- [ ] **Phase 1 — Infrastructure**: `docker/n8n/Dockerfile` (+ `clamd-remote.conf`), `n8n-db-init`,
      `n8n` service, env vars in `.env`/env-build (`infrastructure.md`) — bring up a bare n8n with
      an empty `n8n_engine` DB (user runs the rebuild)
- [ ] **Phase 2 — `db/fnb-n8n` package**: scaffold via `new-db-package`; `n8n`/`n8n_fn`/`n8n_api`
      trio, `workflow_run`, RLS, `n8n_worker` role; grants changes in `fnb-storage`
      (+ `asset_for_scan`, `stuck_pending_assets`), `fnb-location-datasets`, `fnb-airports`,
      `fnb-app`; sync-status fn reworks; `DEPLOY_PACKAGES` update; PostGraphile schemas
      `+ n8n, n8n_api` (`_shared.data.md`)
- [ ] **Phase 3 — Workflow-as-code plumbing**: `n8n/` repo dir, credential templates,
      `n8n-import` job, `error-handler` workflow; verify import loop with a trivial workflow
- [ ] **Phase 4 — Convert workflows**: `exerciser` first (proves all plumbing), then
      `sync-breweries`, `sync-airports`, then `asset-scan` + `asset-scan-reaper`
      (per-workflow files)
- [ ] **Phase 5 — App integration**: `triggerWorkflow` extendSchema plugin; `.graphql` doc +
      codegen + `useTriggerWorkflow`; rewire `useBreweries`/`useAirports`; upload endpoint
      post-commit webhook POST; end-to-end verify uploads + syncs on the new engine while the old
      engine still exists (parallel-run window)
- [ ] **Phase 6 — Decommission**: everything in `decommission.data.md` (worker-app, `db/fnb-wf`,
      wf client/UI code, mutation-hooks, seeds, nav row, deps); codegen re-run; `pnpm build` +
      `pnpm dep-audit` green
- [ ] **Phase 7 — R21 propagation + final verification**: global-rules (R22 rewrite), pattern
      files, tombstones, skills/skill-map, CLAUDE.md, memory sweep; run the full verification
      checklist in `decommission.data.md`

## Remaining Open Questions (deferred — none block implementation)

- [ ] ~~n8n version pin~~ — resolved procedurally: pin latest stable at Phase-1 implementation time
- [ ] Admin "runs panel" UI over `n8n_api.workflow_runs` — out of scope; revisit after migration
- [ ] Scheduled (nightly) dataset syncs — trivially possible post-migration; product call, out of scope
- [ ] Production posture (n8n queue mode, webhook worker split, ZITADEL SSO for the editor) —
      deferred until a deployed environment exists (matches the house's dev-first stance)

## Considered & rejected

| Alternative | Why rejected |
|---|---|
| **Engine swap** (keep wf schema/DAG/dashboard, n8n executes steps) | Two workflow systems to maintain; every n8n workflow would be shackled to UOW bookkeeping callbacks; user chose full replacement |
| **Hybrid** (n8n owns definitions, thin fnb mirror of full DAG state) | The mirror grows back into the wf module; `workflow_run` (flat, per-execution) is the deliberate ceiling |
| n8n tables as a schema inside `function_bucket` | n8n's migrations alongside sqitch-managed schemas; PostGraphile introspection risk; separate DB is free |
| Dedicated postgres container for n8n | Nothing gained over a second database in the existing cluster; one more service/volume |
| Postgres LISTEN/NOTIFY triggers (n8n Postgres Trigger node) | At-most-once delivery (lost while n8n is down), long-held connections; webhooks + reaper cover the same ground deterministically |
| nginx `/n8n` path prefix | n8n sub-path hosting is historically fragile (websockets/assets); editor isn't app surface anyway |
| Code-node TCP INSTREAM for clamd (`NODE_FUNCTION_ALLOW_BUILTIN=net`) | Weakens the Code-node sandbox instance-wide for one node's benefit; `clamdscan --stream` via Execute Command does the same with zero relaxation |
| Keeping graphile-worker for the reaper only | Defeats the point; n8n Schedule Trigger is a complete cron replacement |
| fnb calling n8n's REST API to start executions | Webhooks are the supported trigger contract; the REST API is an operator surface (n8n-cli), not an app dependency |
