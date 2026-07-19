---
name: agentic-decommission-inventory
description: Complete retirement inventory for the wf module and graphile-worker under the agentic engine — every file to delete or edit, env vars, dependencies, spec/skill propagation (R21), and the post-decommission verification checklist.
metadata:
  type: reference
---

## Status
**Executed 2026-07-17** — full verification checklist passed post-rebuild (greps clean, builds
green, all four workflows + reaper live, nav clean, `/graphql-api/workflow` 404s). Three items
the inventory below missed, found and fixed during execution:
- `apps/graphql-api-app/nuxt.config.ts` had `routeRules: { '/workflow/**': { ssr: false } }` —
  the SPA-mode rule made the deleted route serve a 200 shell instead of 404ing.
- `apps/graphql-api-app/app/pages/index.vue` linked to `/workflow`.
- The asset detail page's `wfId` deep-link (`storage-layer` `assets/[id].vue` + the Asset
  fragment/mapper/`fnb-types` field) pointed at the retired dashboard — removed end-to-end
  (the `storage.asset.wf_id` column stays; nothing writes it).
Also: the `app_fn.raise_exception` grant moved into fnb-agent (deploy order — see
`_shared.data.md`), and unused `grafast`/`graphile-utils` declarations were pruned from
graphql-api-app along with the listed deps.

---

## Delete entirely

| Target | Notes |
|---|---|
| `apps/worker-app/` (whole app) | runner plugin, all task handlers (`_workflow-handler`, `_common/*`, `wf-exerciser/*`, asset-scan set, `location-datasets/sync-breweries`, `airports/sync-airports`), `lib/{clam,ffmpeg,s3,required-env}.ts`, Dockerfile, package.json — clam/ffmpeg/s3 logic is *reimplemented* inside `apps/agent-app/server/lib/agent-tools/`, not moved verbatim |
| compose service `worker-app` + volume `node_modules_worker_app` | replaced by the `agent-app` service (`infrastructure.md`) |
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
| `.env` / `scripts/env-build.ts` docs | `DEPLOY_PACKAGES`: remove `fnb-wf`, add `fnb-agent` (slot after `fnb-app`; `fnb-storage` no longer needs the "fnb-wf must precede" rule); add the six `AGENT_*` vars + `ANTHROPIC_API_KEY` (`infrastructure.md`); `ASSET_SCAN_REAPER_CRON` **retained** (croner reads it) |
| `docker-compose.yml` | remove `worker-app`; add `agent-app` + volume `agent-transcripts`; add `AGENT_INTERNAL_URL` + `AGENT_TRIGGER_SECRET` to `graphql-api-app` and `storage-app` env |
| `db/fnb-storage/sqitch.plan` | drop the `fnb-wf` cross-project dependency; add the grants + `asset_for_scan` + `stuck_pending_assets` change (attempt count reads `agent.workflow_run`) |
| `db/fnb-location-datasets` | rework `…10710_location_datasets_fn.sql`: `brewery_sync_status` reads `agent_fn.running_count`; drop any `fnb-wf` dep; add `agent_worker` grants change |
| `db/fnb-airports` | same rework for `airport_sync_status` (`…10810_airports_fn.sql`); grants change |
| `db/fnb-app/deploy/00000000010240_app_fn.sql` | remove the `tenant-site-admin-wf` "Workflow Dashboard" tool row (R14 nav) |
| `db/seed.sql` | remove the `wf-exerciser` seed and the `sync-breweries` / `sync-airports` template upserts |
| `apps/graphql-api-app/server/graphile.config.ts` | `pgServices.schemas`: remove `wf, wf_api`; add `agent, agent_api` |
| `apps/graphql-api-app/package.json` | remove `graphile-worker`; remove `@vue-flow/*` + `elkjs` **if** the workflow UI was their only consumer (verify repo-wide first; also prune their catalog entries if orphaned — R24) |
| `pnpm-workspace.yaml` catalog | add `@anthropic-ai/claude-agent-sdk`, `croner`, `zod` entries if not present (R24: agent-app declares them `"catalog:"`) |
| `packages/storage-layer/server/api/upload.post.ts` | replace `ensure_asset_scan_wf` + `wf_api.queue_workflow` with the post-commit trigger POST (`asset-scan.workflow.data.md`) |
| `packages/graphql-client-api/src/composables/{useBreweries,useAirports}.ts` | swap `useQueueWorkflow` → `useTriggerWorkflow`; public API unchanged |
| `packages/graphql-client-api` generated output | re-run codegen after the schema loses wf types and gains `agent_api` + `triggerWorkflow`; fix fallout |
| `packages/auth-server` | verify remaining consumers of `useFnbPgClient` after worker-app deletion (agent-app does **not** use it — its tools hold their own `agent_worker` pool); keep the package (msg/storage carve-outs may use it), prune only if orphaned |

## Spec / skill propagation (R21 — same change set)

- `global-rules.md`: **R22 rewritten** ("worker-app is the only graphile-worker runner" → the
  agentic rule: agent-app is the only workflow engine; fnb→agent is trigger-endpoint-only
  (shared secret); agent→fnb is `agent_worker`-via-`_fn` only, from tool handlers only; agents
  get closed toolboxes — no built-in tools, no SQL tool; invariant-bearing transitions are
  single deterministic tools); R5/R17 mentions of worker-app pruned.
- `monorepo-bootstrap-pattern.md`: Headless-apps section (worker-app) replaced by the agent-app
  topology; deploy-order note updated.
- `graphql-api-pattern.md` + `graphql-api-app/server-pattern.md`: `_scheduleUows` /
  mutation-hook references replaced by the `triggerWorkflow` plugin.
- `graphql-api-app/worker-pattern.md`: replaced by a tombstone frontmatter pointing here.
- `.claude/specs/asset-storage/asset-scan-workflow.data.md`: superseded-by pointer to
  `asset-scan.workflow.data.md`; `asset-storage/README.md` + `infrastructure.md` worker mentions
  updated.
- `.claude/specs/n8n-workflow-engine/README.md`: mark **superseded — the agentic alternative was
  chosen** (or delete the dir, user's call) so two live "full replacement" specs don't coexist.
- Skills (`.claude/skills/skill-map.md` is the registration point): `graphile-worker-expert`
  demoted to legacy/removed from the map; **add a `claude-agent-sdk` specialist skill** (tool
  definition, `query()` options, session/permission semantics) and register it — the harness and
  toolbox are now house infrastructure someone will extend; `fnb-stack-implementor` +
  `fnb-stack-spec` worker/wf references rewritten; `vue-flow-expert`'s "fnb UOW hierarchy" note
  updated if the vue-flow deps go.
- `CLAUDE.md`: worker-app row in the apps table → agent-app, `fnb-wf` in the db list → `fnb-agent`,
  graphile-worker in the tech stack → Claude Agent SDK.
- `.claude/memory/`: sweep for worker/wf-era memories; mark stale ones.

## Verification checklist (post-decommission)

1. Repo-wide greps return nothing outside `.claude/` history/plans: `graphile.worker`,
   `graphile_worker`, `wf_api\.`, `wf_fn\.`, `wf\.uow`, `queueWorkflow`, `workflow_handler_key`,
   `ensure_asset_scan_wf`.
2. `pnpm build` green; `pnpm dep-audit` green; codegen re-run committed.
3. Fresh `docker compose` rebuild (user-run): db-migrate deploys with `fnb-agent` and without
   `fnb-wf`; the four workflow definitions registered (exerciser, sync-breweries, sync-airports,
   asset-scan) + the reaper cron scheduled; upload → scan → clean promote verified end-to-end;
   Datasets "Sync now" works via `triggerWorkflow`; exerciser error paths (`throwError`,
   `raiseExceptionMessage`, `burnTurns`) land in `agent.workflow_run` as `error` with `usage`
   populated.
4. Nav no longer shows the Workflow Dashboard; `/graphql-api/workflow` 404s.
