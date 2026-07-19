---
name: n8n-decommission-inventory
description: Complete retirement inventory for the wf module and graphile-worker — every file to delete or edit, env vars, dependencies, spec/skill propagation (R21), and the post-decommission verification checklist.
metadata:
  type: reference
---

## Status
Draft. This is the Full-replacement decision's blast radius, enumerated from a repo-wide sweep
(2026-07-17). Executed as the **last** implementation phases — nothing here is touched until the
n8n replacements are live and verified.

---

## Delete entirely

| Target | Notes |
|---|---|
| `apps/worker-app/` (whole app) | runner plugin, all task handlers (`_workflow-handler`, `_common/*`, `wf-exerciser/*`, asset-scan set, `location-datasets/sync-breweries`, `airports/sync-airports`), `lib/{clam,ffmpeg,s3,required-env}.ts`, Dockerfile, package.json |
| compose service `worker-app` + volume `node_modules_worker_app` | its ffmpeg-bearing Dockerfile role moves to `docker/n8n/Dockerfile` |
| `db/fnb-wf/` (whole sqitch package) | dev env is rebuild-from-scratch, so removal = drop from `DEPLOY_PACKAGES`; no production revert choreography needed yet |
| `apps/graphql-api-app/server/api/mutation-hooks/` | `queue-workflow.ts`, `_scheduleUows.ts`, `_queueWorkflow.ts`, `_queueAnonWorkflow.ts`, `index.ts` — replaced by the `triggerWorkflow` extendSchema plugin (`_shared.data.md`); verify nothing else registers through this index before deleting |
| `packages/graphql-client-api/src/graphql/wf/**` | 3 fragments, 4 queries, 4 mutations |
| `packages/graphql-client-api/src/composables/` wf set | `useWfInstances`, `useWfTemplates`, `useWfDetail`, `useQueueWorkflow`, `usePullTrigger` (+ any wf mappers under `src/mappers/`) + their barrel lines |
| `packages/fnb-types/src/workflow.ts` | + its `index.ts` barrel line |
| graphql-api-app workflow UI | `app/pages/workflow/{index,[id]}.vue`, `app/components/{WfUowNode,WfMilestoneNode,WfQueueModal}.vue`, `app/composables/{useWfDetail,useWfTemplates,useQueueWorkflow,useWfInstances,usePullTrigger,useWfFlowGraph}.ts` |
| `.claude/specs/graphql-api-app/workflow/` (5 files) | spec of the retired UI — delete; this spec dir is the successor |
| `db/fnb-storage/deploy/00000000010630_storage_ensure_asset_scan_wf.sql` | + its plan entry, revert, verify (sqitch-expert for plan-edit mechanics) |

## Edit

| Target | Change |
|---|---|
| `.env` / `scripts/env-build.ts` docs | `DEPLOY_PACKAGES`: remove `fnb-wf`, add `fnb-n8n` (slot after `fnb-app`; `fnb-storage` no longer needs the "fnb-wf must precede" rule); remove `ASSET_SCAN_REAPER_CRON`; add the six `N8N_*` vars (`infrastructure.md`) |
| `docker-compose.yml` | remove `worker-app`; add `n8n-db-init`, `n8n-import`, `n8n`, volume `n8n-data`; add `N8N_INTERNAL_URL` + `N8N_WEBHOOK_SECRET` to `graphql-api-app` and `storage-app` env |
| `db/fnb-storage/sqitch.plan` | drop the `fnb-wf` cross-project dependency; add the grants + `asset_for_scan` + `stuck_pending_assets` change |
| `db/fnb-location-datasets` | rework `…10710_location_datasets_fn.sql`: `brewery_sync_status` reads `n8n_fn.running_count`; drop any `fnb-wf` dep; add `n8n_worker` grants change |
| `db/fnb-airports` | same rework for `airport_sync_status` (`…10810_airports_fn.sql`); grants change |
| `db/fnb-app/deploy/00000000010240_app_fn.sql` | remove the `tenant-site-admin-wf` "Workflow Dashboard" tool row (R14 nav) |
| `db/seed.sql` | remove the `wf-exerciser` seed and the `sync-breweries` / `sync-airports` template upserts |
| `apps/graphql-api-app/server/graphile.config.ts` | `pgServices.schemas`: remove `wf, wf_api`; add `n8n, n8n_api` |
| `apps/graphql-api-app/package.json` | remove `graphile-worker`; remove `@vue-flow/*` + `elkjs` **if** the workflow UI was their only consumer (verify repo-wide first; also prune their catalog entries if orphaned — R24) |
| `packages/storage-layer/server/api/upload.post.ts` | replace `ensure_asset_scan_wf` + `wf_api.queue_workflow` with the post-commit webhook POST (`asset-scan.workflow.data.md`) |
| `packages/graphql-client-api/src/composables/{useBreweries,useAirports}.ts` | swap `useQueueWorkflow` → `useTriggerWorkflow`; public API unchanged |
| `packages/graphql-client-api` generated output | re-run codegen after the schema loses wf types and gains `n8n_api` + `triggerWorkflow`; fix fallout |
| `packages/auth-server` | verify remaining consumers of `useFnbPgClient` after worker-app deletion; keep the package (msg/storage carve-outs may use it), prune only if orphaned |

## Spec / skill propagation (R21 — same change set)

- `global-rules.md`: **R22 rewritten** ("worker-app is the only graphile-worker runner" → the
  n8n rule: n8n is the only workflow engine; fnb→n8n is webhook-only; n8n→fnb is
  `n8n_worker`-via-`_fn` only); R5/R17 mentions of worker-app pruned.
- `monorepo-bootstrap-pattern.md`: Headless-apps section (worker-app) replaced by the n8n service
  topology; deploy-order note updated.
- `graphql-api-pattern.md` + `graphql-api-app/server-pattern.md`: `_scheduleUows` / mutation-hook
  references replaced by the `triggerWorkflow` plugin.
- `graphql-api-app/worker-pattern.md`: replaced by a tombstone frontmatter pointing here.
- `.claude/specs/asset-storage/asset-scan-workflow.data.md`: superseded-by pointer to
  `asset-scan.workflow.data.md`; `asset-storage/README.md` + `infrastructure.md` worker mentions
  updated.
- Skills (`.claude/skills/skill-map.md` is the registration point): `graphile-worker-expert`
  demoted to legacy/removed from the map; `n8n-cli` becomes the routed operator skill;
  `fnb-stack-implementor` + `fnb-stack-spec` worker/wf references rewritten; `vue-flow-expert`'s
  "fnb UOW hierarchy" note updated if the vue-flow deps go.
- `CLAUDE.md`: worker-app row in the apps table, `fnb-wf` in the db list, graphile-worker in the
  tech stack — all updated.
- `.claude/memory/`: sweep for worker/wf-era memories; mark stale ones.

## Verification checklist (post-decommission)

1. Repo-wide greps return nothing outside `.claude/` history/plans: `graphile.worker`,
   `graphile_worker`, `wf_api\.`, `wf_fn\.`, `wf\.uow`, `queueWorkflow`, `workflow_handler_key`,
   `ensure_asset_scan_wf`.
2. `pnpm build` green; `pnpm dep-audit` green; codegen re-run committed.
3. Fresh `docker compose` rebuild (user-run): db-migrate deploys with `fnb-n8n` and without
   `fnb-wf`; all five n8n workflows active; upload → scan → clean promote verified end-to-end;
   Datasets "Sync now" works via `triggerWorkflow`; exerciser error paths land in
   `n8n.workflow_run` as `error`.
4. Nav no longer shows the Workflow Dashboard; `/graphql-api/workflow` 404s.
