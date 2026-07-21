> **Execution Directive:** plan + build this spec via `/fnb-stack-implementor <this-README>` —
> the implementor derives the `.claude/issues/` plan file (R23) from the task list below,
> then executes it.

# Agentic Decommission — move the last agentic workflows to n8n, then delete the agentic engine

## Status
**Draft** — fill in nothing (no `[FILL IN]` markers); Open Questions resolved or deferred.
The reverse of `.claude/specs/agentic-workflow-engine/decommission.data.md`: that spec retired
graphile-worker in favour of the agentic engine; this one retires the **agentic engine** in
favour of **n8n**, which becomes the stack's sole workflow engine (R22 collapses from "two
engines" back to one).

## Purpose

Finish the engine consolidation. n8n already runs `sync-airports`, `game-event`,
`n8n-sync-breweries`, `n8n-exerciser`, and the shared `error-handler`
(`.claude/specs/n8n-parallel-engine/`). Three responsibilities still live on the agentic engine
(`apps/agent-app`, R22):

1. **`sync-breweries`** — the production datasets-UI key (the n8n twin `n8n-sync-breweries`
   already exists and is verified; this is a registry flip, exactly like the `sync-airports`
   move on 2026-07-20).
2. **`exerciser`** — the super-admin diagnostic (the n8n `n8n-exerciser` demo already covers it).
3. **`asset-scan` + its reaper** — the hard one. Not in the trigger registry (upload-endpoint
   only), and the only workflow with binary steps (clamAV scan + ffmpeg thumbnail), so it forces
   the **custom n8n image** the parallel-engine spec deliberately deferred.

Once all three run on n8n, **everything agentic is deleted**: `apps/agent-app`, `db/fnb-agent`
(schema, run log, `agent_worker` role), the `agent` branch of the `triggerWorkflow` registry,
all `AGENT_*` env + the `agent_worker` grants in the owning packages, the site-admin
**Agentic Workflows** page and its whole client layer, the `agentic-workflow-engine` spec, and
the `claude-agent-sdk` skill. `ANTHROPIC_API_KEY` **stays** — it backs an n8n credential
(`n8n/credentials/anthropic-api-key.json.tpl`), not agent-app.

The bet, versus keeping both engines: one engine to operate, one run log, one trigger path, one
security-actor role. The cost: asset-scan loses the agentic "one atomic scan+promote tool" and
becomes a fixed n8n node graph — but with no model in the loop, a deterministic, reviewable DAG
is *safer* than a tool a model sequences (see `asset-scan.workflow.data.md` → Security).

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| End state | **n8n is the sole workflow engine**; the agentic engine is deleted entirely | User directive 2026-07-20 ("complete removal of agentic workflow related items"). R22 collapses two engines → one |
| `sync-breweries` move | **Rekey the `n8n-sync-breweries` twin to the `sync-breweries` webhook path**; registry entry → `permission: null`; retire the `n8n-sync-breweries` key | Exact mirror of the 2026-07-20 `sync-airports` move (`n8n-parallel-engine/dataset-sync.workflow.data.md` §Status). The datasets UI Sync button is unchanged — the key is the abstraction |
| `exerciser` move | **Rekey `n8n-exerciser` → `exerciser`**; retire the `n8n-exerciser` key | User decision 2026-07-20. Preserves the historical diagnostic key name; one n8n demo workflow, not two |
| `asset-scan` engine | **Convert to n8n** (`asset-scan` + `asset-scan-reaper` workflows) — the only path to full removal | asset-scan is the last agentic workflow; keeping it would keep the whole engine alive |
| Custom n8n image | **Resurrect `docker/n8n/Dockerfile`** (FROM the pinned image + `ffmpeg` + `clamav-clients`; `clamd-remote.conf`) | asset-scan needs clamdscan + ffmpeg binaries the stock image lacks. The parallel spec locked "no custom image" *for the demo scope* and named this exact resurrection trigger |
| Scan verdict authority | The **fixed n8n DAG is the sole authority** (S3 get → clamdscan → IF verdict → copy/delete/resolve). No model, so the agentic "single atomic tool" motivation is gone | `resolve_asset_scan`'s `pending`-guard + IF-node routing is deterministic and code-reviewable; mirrors the `game-event` referee-as-sole-authority posture |
| Reaper | **n8n `asset-scan-reaper` workflow** (Schedule Trigger, cadence baked into the JSON) replaces the croner in `agent-scheduler.ts`; `ASSET_SCAN_REAPER_CRON` env var retires | Definitions are code (edit + re-import to change cadence), same posture as every other n8n workflow; no in-process scheduler survives |
| Trigger registry shape | Collapse to **n8n-only**: drop the `engine` field, the `agent` fetch branch, and `AGENT_INTERNAL_URL`/`AGENT_TRIGGER_SECRET`; every key POSTs the n8n webhook | With one engine there is nothing to route; the `permission` gate is all that remains |
| Cross-engine sync guard | **Collapse `n8n_fn.dataset_sync_busy(agentic_key, n8n_key)` to single-engine** `n8n_fn.running_count(key) > 0`; drop the `fnb-agent` sqitch dep | No second engine to race; `agent_fn.*` no longer exists |
| Dual-engine `in_progress` | Collapse the `agent_fn.running_count(...) OR n8n_fn.running_count(...)` ORs in `brewery_sync_status` / `airport_sync_status` to the n8n term only | Same GraphQL shape; `in_progress` means "n8n is syncing" now |
| Storage grants | Rework `db/fnb-storage/.../storage_agent_worker.sql` → grant **`n8n_worker`**; `stuck_pending_assets` reads **`n8n.workflow_run`** | asset-scan now runs as `n8n_worker`; the reaper's attempt-count/`ai_tags_requested` recovery reads the n8n run log |
| Site-admin UI | **Delete the wf-agentic page + its whole client layer**; `wf-n8n` becomes the sole workflow tool (its trigger card lists the migrated keys) | The page reads `agent_api.workflow_runs`, which dies with `db/fnb-agent` |
| Agentic spec + skill | **Delete outright** — `.claude/specs/agentic-workflow-engine/` and the `claude-agent-sdk` skill | User decision 2026-07-20. Git retains the history; the tree carries no dead agentic docs |
| `ANTHROPIC_API_KEY` | **Retained** | Backs the `anthropic-api-key` n8n credential, not agent-app |
| Phasing / gate | Registry-flip moves first; **asset-scan on n8n verified before any agentic deletion**; decommission is the last phase | Never delete the working engine until its replacement is proven end-to-end (parallel-run window, same as the agentic migration) |

## Files in this spec

| File | Contents |
|---|---|
| `README.md` | This index: decisions, task list, open questions |
| `_shared.data.md` | The collapse: n8n-only trigger registry, single-engine sync guard + `in_progress`, the `n8n_worker` storage grants + `stuck_pending_assets` rewire, client-layer removal, security model after |
| `asset-scan.workflow.data.md` | The `asset-scan` + `asset-scan-reaper` n8n workflows, the custom-image trigger change, the upload-endpoint retarget, and the fixed-DAG security argument |
| `infrastructure.md` | Custom n8n image resurrection (Dockerfile + `clamd-remote.conf`), clamav/minio wiring + the `fnb-minio` credential, env-var add/remove deltas, agent-app service removal, boot order |
| `decommission.data.md` | Full agentic retirement inventory (delete/edit tables), R21 spec/skill propagation, and the post-decommission verification checklist |

## Implementation Task List

- [ ] **Phase 1 — Registry-flip moves** (no new binaries, low risk):
      rekey `n8n-sync-breweries` → `sync-breweries` and `n8n-exerciser` → `exerciser` in
      `n8n/workflows/*.json` (webhook path + `begin_run` key); registry entries `sync-breweries`
      / `exerciser` flip to `engine: 'n8n'` (keeping the `engine` field for now); collapse the
      dual-engine `in_progress` ORs + the `dataset_sync_busy` guard to single-engine; rework the
      breweries/airports `n8n_worker` grants to their production keys. Verify: Datasets Sync +
      the exerciser run on n8n; agentic `sync-breweries`/`exerciser` now unreachable (dormant).
      (`_shared.data.md`)
- [ ] **Phase 2 — asset-scan infrastructure**: resurrect `docker/n8n/Dockerfile` (+
      `clamd-remote.conf`); n8n service → `build:` the custom image, `depends_on` clamav (soft) +
      minio-init, add the `ASSET_SCAN_*`/`CLAMAV_*`/`S3_*` env; `n8n-import` uses the same custom
      image; add the `fnb-minio` S3 credential template; rework `storage_agent_worker.sql` →
      `n8n_worker` grants + `stuck_pending_assets` reading `n8n.workflow_run`
      (`infrastructure.md`, `_shared.data.md`)
- [ ] ⏸ **USER REBUILD GATE** — Phases 1–2 land on one rebuild; verify read-only per
      `infrastructure.md` §Verification (custom image up, `clamdscan`/`ffmpeg` present,
      `n8n_worker` storage grants executable, S3 node reaches minio)
- [ ] **Phase 3 — asset-scan + reaper workflows**: build `asset-scan` (the scan→resolve→
      thumbnail/ai-tag diamond) and `asset-scan-reaper` (Schedule Trigger) in the editor / via
      `n8n-cli`, export to `n8n/workflows/*.json` (active); retarget the upload endpoint POST to
      `${N8N_INTERNAL_URL}/webhook/asset-scan`. Verify all three verdict paths + thumbnail +
      reaper re-fire in `n8n.workflow_run` (`asset-scan.workflow.data.md`)
- [ ] ⏸ **PARALLEL-RUN VERIFICATION** — asset-scan proven end-to-end on n8n while agent-app still
      exists (the rollback). Only past this gate does deletion begin.
- [ ] **Phase 4 — Decommission**: everything in `decommission.data.md` — delete `apps/agent-app`,
      `db/fnb-agent`, the wf-agentic page + client layer, the nav row, the `agent` registry
      branch + `AGENT_*` env, deps; collapse the registry to n8n-only; codegen re-run; `pnpm
      build` + `pnpm dep-audit` green
- [ ] **Phase 5 — R21 propagation + final verification**: global-rules R22 rewrite (sole n8n
      engine), `monorepo-bootstrap-pattern.md`, CLAUDE.md, skill-map (**delete `claude-agent-sdk`**),
      **delete `.claude/specs/agentic-workflow-engine/`**, repoint the `asset-storage` superseded
      pointer, update `n8n-parallel-engine` to "sole engine", memory sweep; run the full
      verification checklist in `decommission.data.md`

## Remaining Open Questions (deferred — none block implementation)

- [ ] Reclaiming the freed GraphQL names — deleting `agent.workflow_run` frees `WorkflowRun` /
      `workflowRuns`, but n8n keeps its `N8nWorkflowRun` smart-tag renames (renaming back = codegen
      churn for zero gain). Left as-is; revisit only if the names ever matter.
- [ ] Per-run detail pages on wf-n8n — still deferred (carried from the parallel-engine README).
- [ ] Scheduled dataset syncs on n8n (Schedule Trigger) — now trivially possible alongside the
      asset-scan-reaper; product call, still out of scope.
- [ ] Production posture (queue mode, webhook-worker split, clamav sizing) — deferred until a
      deployed environment exists.

## Considered & rejected

| Alternative | Why rejected |
|---|---|
| Keep asset-scan agentic, delete only the syncs/exerciser | Leaves the whole agentic engine (app, DB package, role, env) alive for one workflow — fails the "complete removal" goal |
| Run clamdscan/ffmpeg from n8n Code nodes (`NODE_FUNCTION_ALLOW_BUILTIN` + raw sockets) | The parallel + superseded specs both rejected relaxing the Code-node sandbox; Execute Command on the custom image is the reviewed path |
| A DB-side "scan-before-promote" constraint | `resolve_asset_scan` already guards on `scan_status='pending'`; the fixed DAG can't reach the copy/delete node except through the verdict IF — no extra constraint buys anything |
| Keep `dataset_sync_busy` as a two-arg cross-engine guard (agentic side always 0) | `agent_fn.running_count` is deleted; a two-arg helper that can only ever see one engine is dead weight |
| Tombstone the agentic spec + skill (the graphile-worker precedent) | User chose outright deletion; git history is the record |
| Rename `.claude/specs/n8n-parallel-engine/` → `n8n-engine` | Churn for no behaviour change; a Status note that it is now the sole engine is enough |
| Keep `ASSET_SCAN_REAPER_CRON` as an env var read by the Schedule Trigger | n8n Schedule Trigger cadence lives in the node config; baking it into the workflow JSON matches every other definition-as-code workflow |
