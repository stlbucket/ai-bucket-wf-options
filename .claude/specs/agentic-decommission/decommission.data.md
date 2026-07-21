---
name: agentic-decommission-inventory
description: Complete retirement inventory for the agentic workflow engine — every file/service/env to delete or edit, the R21 spec/skill propagation (including deleting the agentic spec and the claude-agent-sdk skill), and the post-decommission verification checklist. Runs only after asset-scan is verified on n8n (README parallel-run gate).
metadata:
  type: reference
---

## Status
**Draft.** Executes after the README's PARALLEL-RUN VERIFICATION gate — asset-scan proven on n8n
while agent-app still exists as the rollback. The mirror of
`.claude/specs/agentic-workflow-engine/decommission.data.md` (which retired graphile-worker),
pointed the other way.

---

## Delete entirely

| Target | Notes |
|---|---|
| `apps/agent-app/` (whole app) | `server/lib/{agent-harness,agent-db,agent-transcripts,operator-trigger,trigger-handler,required-env}.ts`, `server/lib/agent-workflows/*`, `server/lib/agent-tools/*` (clam/ffmpeg/s3 logic is *reimplemented* as n8n Execute Command / S3 nodes, not moved), `server/plugins/agent-scheduler.ts`, `server/utils/trigger-secret.ts`, `server/api/**`, `app/`, `Dockerfile`, `clamd-remote.conf` (→ moved to `docker/n8n/`), `nuxt.config.ts`, `package.json`, `tsconfig.json` |
| compose service `agent-app` + volume `agent-transcripts` | `docker-compose.yml` + `infra/compose/docker-compose.prod.yml` |
| `db/fnb-agent/` (whole sqitch package) | `agent`/`agent_fn`/`agent_api` trio, `agent.workflow_run`, `agent_worker` role, `agent_fn.{begin_run,attach,complete_run,error_run,running_count,sweep_orphaned_runs}`, `agent_api.workflow_runs`, the `app_api.raise_exception` grant to `agent_worker`. Dev rebuilds from scratch → removal = drop from `DEPLOY_PACKAGES`; no revert choreography |
| `apps/tenant-app/app/pages/site-admin/wf-agentic/` | the Agentic Workflows page (reads the now-deleted `agent_api.workflow_runs`) |
| `packages/graphql-client-api/src/graphql/agent/query/agentWorkflowRuns.graphql` | + the `agent/` dir once `triggerWorkflow.graphql` is relocated (below) |
| `packages/graphql-client-api/src/mappers/agent-workflow-run.ts` | mapper |
| `packages/graphql-client-api/src/composables/useAgentWorkflowRuns.ts` | + its `src/index.ts` barrel line |
| `apps/tenant-app/app/composables/useAgentWorkflowRuns.ts` | re-export |
| `.claude/specs/agentic-workflow-engine/` (whole dir) | user decision — delete outright (R21) |
| `.claude/skills/claude-agent-sdk/` (whole skill) | user decision — delete + remove from `skill-map.md` (R21) |

## Edit

| Target | Change |
|---|---|
| `apps/graphql-api-app/server/graphile/trigger-workflow.plugin.ts` | drop the `engine` field, the `WorkflowEngine` type, the `agent` fetch branch, and `requiredEnv('AGENT_INTERNAL_URL')`/`AGENT_TRIGGER_SECRET`; registry becomes `Record<string, { permission }>` POSTing only the n8n webhook (`_shared.data.md`) |
| `apps/graphql-api-app/server/graphile.config.ts` | `pgServices.schemas`: remove `agent, agent_api` |
| `apps/graphql-api-app/postgraphile.tags.json5` | remove any `agent.workflow_run` / `agent_api.*` smart-tag entries (the n8n `N8n*` renames stay) |
| `packages/graphql-client-api/src/graphql/agent/mutation/triggerWorkflow.graphql` | **relocate** → `src/graphql/n8n/mutation/triggerWorkflow.graphql` (engine-agnostic doc); update the codegen document glob if path-scoped |
| `packages/fnb-types/src/workflow-run.ts` | remove the `AgentWorkflowRun` interface; keep `WorkflowRunStatus` + `N8nWorkflowRun` (barrel line stays) |
| `db/fnb-storage/deploy/00000000010640_storage_agent_worker.sql` | rework → `n8n_worker` grants + `stuck_pending_assets` reading `n8n.workflow_run`; sqitch dep `fnb-n8n:…_n8n_policies`, drop the `fnb-agent` dep (`_shared.data.md`; rename the change to `storage_n8n_worker` via `sqitch-expert` or edit in place) |
| `db/fnb-location-datasets/.../00000000010710_location_datasets_fn.sql` | drop the `agent_worker` grant block; `brewery_sync_status.in_progress` → n8n-only; drop the `fnb-agent` dep (`_shared.data.md`) |
| `db/fnb-airports/.../00000000010810_airports_fn.sql` | drop the `agent_worker` grant block; `airport_sync_status.in_progress` → n8n-only; drop the `fnb-agent` dep |
| `db/fnb-n8n/deploy/00000000011210_n8n_fn.sql` | delete `dataset_sync_busy(citext,citext)` + the `fnb-agent` dep; sweep `011200`/`011230` for stray `agent.`/`agent_fn.` refs (`_shared.data.md`) |
| `db/fnb-app/deploy/00000000010240_app_fn.sql` | remove the `tenant-site-admin-wf-agentic` tool row (R14); keep `tenant-site-admin-wf-n8n` |
| `packages/storage-layer/server/api/upload.post.ts` | retarget the post-commit POST `AGENT_INTERNAL_URL/api/trigger/asset-scan` → `N8N_INTERNAL_URL/webhook/asset-scan` (+ header swap) (`asset-scan.workflow.data.md`) |
| `apps/tenant-app/app/pages/site-admin/wf-n8n/` | trigger-card key list → `sync-breweries`, `sync-airports`, `exerciser` (drop `n8n-`-prefixed keys); no `asset-scan` |
| `n8n/workflows/` | rename `n8n-sync-breweries.json` → `sync-breweries.json` and `n8n-exerciser.json` → `exerciser.json` (webhook path + `begin_run` key rekey, `_shared.data.md`); add `asset-scan.json` + `asset-scan-reaper.json` (`asset-scan.workflow.data.md`) |
| `.env` / `.env.example` / `scripts/env-build.ts` | `DEPLOY_PACKAGES` drop `fnb-agent`; remove the five `AGENT_*`/`ASSET_SCAN_REAPER_CRON` vars; keep `ANTHROPIC_API_KEY`; `ASSET_SCAN_*`/`CLAMAV_*`/`S3_*` now documented against the n8n service (`infrastructure.md`) |
| `docker-compose.yml` + `infra/compose/docker-compose.prod.yml` | remove `agent-app` + `agent-transcripts`; n8n → custom `build:` + clamav/minio deps + asset env (`infrastructure.md`) |
| `scripts/db-deploy.ts` + `docker/migrate-entrypoint.sh` | drop the `agent_worker_password` / `AGENT_WORKER_PG_PASSWORD` threading (keep `n8n_worker_password`) |
| `.github/workflows/deploy.yml` | remove `AGENT_*` secret plumbing |
| `apps/agent-app` deps (deleted with the app) | `@anthropic-ai/claude-agent-sdk`, `croner` — prune their `pnpm-workspace.yaml` catalog entries **if orphaned** (R24 `dep-audit`); `zod` stays (other consumers) |
| generated codegen output | re-run after the schema loses `agent`/`agent_api` + the `AgentWorkflowRuns` op; fix fallout |

## Spec / skill propagation (R21 — same change set)

- `global-rules.md`: **R22 rewritten** — "two engines, per-workflow assignment via the plugin
  registry" → **"n8n is the sole workflow engine"**: fnb→n8n is webhook-only (shared secret);
  n8n→fnb is `n8n_worker`-via-granted-`_fn` only; workflow state in the `n8n_engine` DB; the run
  log is `db/fnb-n8n`; definitions are code in `n8n/workflows/` (import loop). Remove every
  agentic invariant (closed toolbox, atomic-verdict tool, harness terminal writes, croner).
- `monorepo-bootstrap-pattern.md`: remove the `agent-app` headless topology; document the n8n
  custom image + clamav/minio coupling; deploy-order note drops `fnb-agent`.
- `CLAUDE.md`: remove the `agent-app` apps-table row; drop `fnb-agent` from the db list **and its
  ordering note** ("`fnb-agent` must precede `fnb-storage`/…"); drop "Claude Agent SDK
  (agentic workflows)" from the tech stack; the R22 line → single n8n engine; scrub agent-app /
  agentic prose (the `game-engines` note's "parallel n8n engine, R22" phrasing → "the n8n
  engine").
- `.claude/skills/skill-map.md`: remove the `claude-agent-sdk` registration; `graphile-worker-expert`
  is already legacy; rewrite any `fnb-stack-implementor` / `fnb-stack-spec` agentic references to
  the n8n engine.
- `.claude/specs/asset-storage/asset-scan-workflow.data.md`: repoint the superseded-by pointer
  from `agentic-workflow-engine/asset-scan.workflow.data.md` (deleted) → this spec's
  `asset-scan.workflow.data.md`; scrub agent-app mentions in `asset-storage/README.md` +
  `infrastructure.md`.
- `.claude/specs/n8n-parallel-engine/README.md` + `_shared.data.md`: add a Status note that n8n is
  now the **sole** engine (the coexistence/parallel framing is historical); the engine registry is
  n8n-only; the `dataset_sync_busy` cross-engine guard collapsed. No rename of the dir.
- `.claude/specs/graphql-api-app/`: any `worker-pattern.md` / server-pattern agentic references
  updated to the n8n engine.
- `.claude/memory/`: sweep for agent-app / `agent_worker` / claude-agent-sdk memories; mark stale
  or delete.

## Verification checklist (post-decommission)

1. Repo-wide greps return nothing outside `.claude/` history/plans:
   `apps/agent-app`, `agent_worker`, `agent_fn\.`, `agent\.workflow_run`, `agent_api\.`,
   `AGENT_INTERNAL_URL`, `AGENT_TRIGGER_SECRET`, `AGENT_WORKER_PG`, `AGENT_MODEL`,
   `claude-agent-sdk`, `useAgentWorkflowRuns`, `AgentWorkflowRun`, `dataset_sync_busy`,
   `ASSET_SCAN_REAPER_CRON`, `sweep_orphaned_runs`.
2. `pnpm build` green; `pnpm dep-audit` green; codegen re-run.
3. Fresh `docker compose` rebuild (user-run): `db-migrate` deploys **without** `fnb-agent`;
   the n8n custom image is up with `clamdscan`/`ffmpeg`; all workflows registered
   (`asset-scan`, `asset-scan-reaper` active, `sync-breweries`, `sync-airports`, `exerciser`,
   `game-event`, `error-handler`).
4. Upload → asset-scan on n8n → clean promote + webp thumbnail verified end-to-end;
   EICAR → `infected`; reaper Schedule Trigger re-fires a backdated `pending` asset.
5. Datasets "Sync now" (breweries + airports) runs on n8n via `triggerWorkflow`; `in_progress`
   reflects the n8n run; the exerciser error paths land in `n8n.workflow_run` as `error`.
6. Nav shows only **n8n Workflows** (no Agentic Workflows); `/tenant/site-admin/wf-agentic` 404s;
   the wf-n8n page + `useTriggerWorkflow` still work.
7. `psql function_bucket`: `agent_worker` role does not exist; `n8n_worker` holds the storage +
   datasets + airports grants and cannot SELECT arbitrary tables.
8. `docker compose ps` shows no `agent-app`; the `agent-transcripts` volume is gone.
