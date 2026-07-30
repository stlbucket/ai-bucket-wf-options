# 0017 — Agentic Decommission: move the last agentic workflows to n8n, then delete the agentic engine

> **Execution Directive:** implement this plan via `/fnb-stack-implementor <this-file>`. The plan
> is derived from `.claude/specs/agentic-decommission/README.md` (spec is the source of truth —
> this file is the sequence + anchors + gates, it does not restate the spec). Advance it by moving
> it between `.claude/issues/` dirs (R23); never encode status in the filename.

**Category:** wf · **SEV:** MED · **Spec:** `.claude/specs/agentic-decommission/` (README,
`_shared.data.md`, `asset-scan.workflow.data.md`, `infrastructure.md`, `decommission.data.md`)

## Goal
n8n becomes the sole workflow engine. Move `sync-breweries`, `exerciser`, and `asset-scan`
(+ reaper) to n8n, then delete everything agentic (`apps/agent-app`, `db/fnb-agent`, the
`agent_worker` role/grants, the `agent` registry branch, `AGENT_*` env, the wf-agentic page +
client layer, the `agentic-workflow-engine` spec, the `claude-agent-sdk` skill). R22 collapses
two engines → one. `ANTHROPIC_API_KEY` **stays** (n8n credential).

## Decisions carried from the spec README (do not re-litigate)
- Rekey `n8n-sync-breweries` → `sync-breweries` and `n8n-exerciser` → `exerciser` (mirror the
  2026-07-20 airports move). Registry entries flip to n8n.
- asset-scan converts to n8n → **resurrect `docker/n8n/Dockerfile`** (ffmpeg + clamav-clients).
- Reaper = n8n `asset-scan-reaper` Schedule Trigger (cadence baked in); `ASSET_SCAN_REAPER_CRON`
  retires.
- Agentic spec dir + `claude-agent-sdk` skill are **deleted outright** (user decision 2026-07-20).
- Deletion happens **only after asset-scan is verified on n8n** (parallel-run rollback window).

## Verified code anchors (from spec authoring)
- Trigger registry: `apps/graphql-api-app/server/graphile/trigger-workflow.plugin.ts` (`WORKFLOW_REGISTRY`,
  the `engine: 'agent'|'n8n'` field, the agent fetch branch, `AGENT_INTERNAL_URL`/`AGENT_TRIGGER_SECRET`).
- Storage grants: `db/fnb-storage/deploy/00000000010640_storage_agent_worker.sql`
  (`agent_worker` grants + `stuck_pending_assets` reading `agent.workflow_run` in 3 places).
- Sync status + dual-engine ORs: `db/fnb-location-datasets/deploy/00000000010710_location_datasets_fn.sql`,
  `db/fnb-airports/deploy/00000000010810_airports_fn.sql`.
- Cross-engine guard: `db/fnb-n8n/deploy/00000000011210_n8n_fn.sql` (`dataset_sync_busy`).
- Reaper croner: `apps/agent-app/server/plugins/agent-scheduler.ts`.
- Upload trigger POST: `packages/storage-layer/server/api/upload.post.ts`.
- n8n workflows: `n8n/workflows/{n8n-sync-breweries,n8n-exerciser,sync-airports,error-handler,game-event}.json`.
- Custom-image reference: `.claude/specs/n8n-workflow-engine/{infrastructure.md,asset-scan.workflow.data.md}` (superseded spec — the Dockerfile + node graph).
- Env fan-out: `docker-compose.yml`, `infra/compose/docker-compose.prod.yml`, `scripts/db-deploy.ts`,
  `docker/migrate-entrypoint.sh`, `.github/workflows/deploy.yml`, `.env`/`.env.example`,
  `scripts/env-build.ts`.

---

## Phase 1 — Registry-flip moves (low risk, no new binaries) — ✅ DONE 2026-07-20
Ref: `_shared.data.md` → "n8n-only registry" + "Single-engine sync guard + in_progress".
→ skills: `n8n-cli` (rekey/export), `sqitch-expert` (dep edits).
Rekeyed `sync-breweries.json` / `exerciser.json` (name+path+begin_run key); guard nodes →
`n8n_fn.running_count(key)::int`; registry flipped (both → n8n, twin keys dropped);
`dataset_sync_busy` deleted (deploy+verify+plan, fnb-agent dep dropped); `in_progress` collapsed
+ `agent_worker` blocks dropped in location_datasets/airports (+ plan deps); wf-n8n key list
updated. All workflow JSON validates.

1. Rekey `n8n/workflows/n8n-sync-breweries.json` → `sync-breweries.json` (Webhook `path` +
   `begin_run` key literal → `sync-breweries`; same n8n id). Export active.
2. Rekey `n8n/workflows/n8n-exerciser.json` → `exerciser.json` (Webhook `path` +
   `begin_run`/`error_run` key literals → `exerciser`). Export active.
3. `trigger-workflow.plugin.ts`: flip `sync-breweries` and `exerciser` registry entries to
   `engine: 'n8n'` (keep the `engine` field this phase; it's removed in Phase 4). Drop the
   `n8n-sync-breweries` / `n8n-exerciser` entries.
4. `db/fnb-n8n/.../00000000011210_n8n_fn.sql`: delete `dataset_sync_busy(citext,citext)` + its
   `fnb-agent` sqitch dep; sweep `011200`/`011230` for stray `agent.`/`agent_fn.` refs. Sync
   workflows' guard node → `select n8n_fn.running_count('sync-breweries') > 0 as busy` (and the
   airports equivalent — edit the exported JSON guard nodes).
5. `location_datasets_fn.sql` / `airports_fn.sql`: drop the `agent_worker` grant block;
   `in_progress` → `n8n_fn.running_count('sync-breweries'|'sync-airports') > 0`; drop the
   `fnb-agent` sqitch dep. (airports `n8n_worker` grants stay — production key.)
6. wf-n8n page trigger-card key list → `sync-breweries`, `sync-airports`, `exerciser`.

## Phase 2 — asset-scan infrastructure — ✅ DONE 2026-07-20 (dev compose; prod → Phase 4)
Ref: `infrastructure.md` (custom image, compose, fnb-minio credential, env) + `_shared.data.md`
(storage grants). → skill `sqitch-expert`.
**Build correction:** n8n 2.30.7 is a Docker Hardened Image (no `apk`) — `docker/n8n/Dockerfile`
is a **multi-stage** build (alpine:3.24 builder → copy ffmpeg + clamdscan + ldd closure into the
hardened image; pkg is `clamav-clamdscan`, not `clamav-clients`). Build-verified: both binaries
run. Memory: `project_n8n_hardened_image`.
Created `docker/n8n/Dockerfile` (+ `clamd-remote.conf`); dev `docker-compose.yml` n8n → custom
`build:` + minio-init/clamav deps + `S3_*`/`CLAMAV_*`/`ASSET_SCAN_*` env; `n8n-import` gains
S3/MinIO env (stays on base pin — needs no binaries); added `n8n/credentials/fnb-minio.json.tpl`
(renders to valid JSON, verified); renamed the storage change `storage_agent_worker` →
`storage_n8n_worker` (deploy/revert/verify/plan) — `n8n_worker` grants + `stuck_pending_assets`
reads `n8n.workflow_run`. `docker compose config` valid. **Deferred to Phase 4:** prod-compose
n8n custom image (registry build+push) + agent-app removal.

7. Create `docker/n8n/Dockerfile` (`FROM docker.n8n.io/n8nio/n8n:2.30.7` + `apk add ffmpeg
   clamav-clients` + `COPY clamd-remote.conf /etc/clamav/`). Move `apps/agent-app/clamd-remote.conf`
   → `docker/n8n/clamd-remote.conf`.
8. `docker-compose.yml` + `infra/compose/docker-compose.prod.yml`: `n8n` service → `build:
   docker/n8n`; add `depends_on` clamav (soft) + minio-init; add `ASSET_SCAN_*`/`CLAMAV_*`/`S3_*`
   env. Point `n8n-import` at the same custom image.
9. Add `n8n/credentials/fnb-minio.json.tpl` (S3 credential; verify exact keys via `n8n-cli`/editor).
   `n8n-import` env gains `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`.
10. Rework `db/fnb-storage/.../00000000010640_storage_agent_worker.sql` → grant `n8n_worker` the
    storage fns; `stuck_pending_assets` reads `n8n.workflow_run` (3 places); sqitch dep
    `fnb-n8n:…_n8n_policies`, drop `fnb-agent` dep. (Rename change → `storage_n8n_worker` via
    sqitch-expert, or edit in place.)

### ✅ USER REBUILD GATE (Phases 1–2) — PASSED 2026-07-20
Rebuilt by user; read-only verification green: n8n custom image healthy, one-shots exit 0,
ffmpeg + clamdscan present (clamdscan streams to clamav → OK), all 5 workflows active with
rekeyed names, n8n_worker storage/datasets grants executable, fnb-minio s3 credential imported,
live exerciser webhook (rekeyed path) → `exerciser|success` run row.

## Phase 3 — asset-scan + reaper workflows — ✅ DONE 2026-07-21
**Full asset-scan (28 nodes) + reaper built, live-verified, exported.** clean/infected/image+aitags/
idempotency all pass end-to-end on n8n+clamav+minio (thumbnail webp child tagged `{thumbnail}`,
parent tagged `{ai-tags-coming-soon}`). Upload endpoint retargeted → n8n webhook. Build
corrections folded into `asset-scan.workflow.data.md` §Status. **Pending:** boot-import
reproduction of the two new workflows rides the next full rebuild (final sign-off, with Phase 4/5).

### Original Phase 3 progress log — 🔶 (superseded by the DONE line above)
**Done:** fresh n8n API key (user-minted; `.env` updated); extracted node schemas from the live
2.30.7 (S3 upload/download/delete/copy, executeCommand, readBinaryFile/writeBinaryFile,
scheduleTrigger); mined the agent-tools reference (key scheme `quarantine/`→`public/|private/`,
`resolve_asset_scan(id,verdict,sig,finalKey)`, thumbnail child `<dir>/<uuid>.webp` via
`insert_derived_asset` 8-arg incl. sha256, IMAGE_TYPES png/jpeg/webp/gif). **asset-scan-reaper
built + active + exported** (`n8n/workflows/asset-scan-reaper.json`; Schedule `*/15 * * * *` →
`stuck_pending_assets` → HTTP POST /webhook/asset-scan).

**asset-scan SPINE built + live-verified + exported** (`n8n/workflows/asset-scan.json`, 19 nodes):
clean (promote quarantine→private, run success), infected (EICAR → signature parsed, purge,
soft-delete), idempotency (already-resolved short-circuit) all pass live; error path = same
verdict-parse else-branch. **Upload endpoint retargeted** → `N8N_INTERNAL_URL/webhook/asset-scan`
(+ storage-app N8N_* env). n8n-2.x gotchas hit + fixed + logged to memory
`project_n8n_hardened_image`: executeCommand throws on nonzero exit → `… 2>&1; echo "CLAMEXIT:$?"`
parsed in Code; executeCommand disabled → `NODES_EXCLUDE=[]`; `restrictFileAccessTo` defaults to
`~/.n8n-files` → write scan file there; n8n won't create that dir → `mkdir` in the Dockerfile.
**Remaining Phase 3:** thumbnail + ai-tag branches on the clean path (ffmpeg webp + sha256 +
`insert_derived_asset`; `add_asset_tags` when aiTagsRequested), then the parallel-run gate.

Original Phase 3 scope:
Ref: `asset-scan.workflow.data.md`. → skill `n8n-cli`.

11. Build `asset-scan` (scan→resolve→thumbnail/ai-tag diamond; Execute Command clamdscan/ffmpeg;
    S3 nodes; IF verdict; Merge → `complete_run`; Error Workflow = `error-handler`;
    `saveDataSuccessExecution: 'none'`). Export active to `n8n/workflows/asset-scan.json`.
12. Build `asset-scan-reaper` (Schedule Trigger cron baked in → `stuck_pending_assets` → Split In
    Batches → HTTP POST self `/webhook/asset-scan`). Export active.
13. `packages/storage-layer/server/api/upload.post.ts`: retarget post-commit POST
    `AGENT_INTERNAL_URL/api/trigger/asset-scan` → `N8N_INTERNAL_URL/webhook/asset-scan` (+ header
    swap `x-fnb-trigger-secret` → `x-fnb-webhook-secret`).

### ⏸ PARALLEL-RUN VERIFICATION GATE
asset-scan proven end-to-end on n8n (clean promote + webp thumbnail; EICAR → infected; reaper
re-fire) **while agent-app still exists**. Only past this gate does Phase 4 begin.

## Phase 4 — Decommission — ✅ DONE 2026-07-21
Deleted `apps/agent-app` (+ container/volume), `db/fnb-agent` (+ DEPLOY_PACKAGES). Trigger plugin
→ n8n-only (engine field/agent branch/AGENT_* env gone). `graphile.config` + `tags.json5` agent
schemas/tags removed. Client layer removed (wf-agentic page, `useAgentWorkflowRuns`,
`agent-workflow-run` mapper, `agentWorkflowRuns.graphql`, `AgentWorkflowRun` type, barrel line,
nav row); `triggerWorkflow.graphql` relocated → `graphql/n8n/mutation/`. Env fan-out cleaned
(`.env`/`.env.example`/both compose/`deploy.yml`/`db-deploy.ts`/`migrate-entrypoint.sh`) —
`AGENT_*` + `ASSET_SCAN_REAPER_CRON` gone, **ANTHROPIC_API_KEY kept** (n8n credential). Catalog
pruned (`claude-agent-sdk`, `croner`, `csv-parse`, `zod`); lockfile regenerated. **`pnpm build`
green (exit 0), `pnpm dep-audit` green.** Prod-compose n8n custom-image wiring left as a TODO for
the deployment effort (plan 0010).

### Original Phase 4 scope
Ref: `decommission.data.md` (delete/edit tables). → skills: `sqitch-expert`, codegen.

14. Delete `apps/agent-app/` (whole app); remove the `agent-app` compose service +
    `agent-transcripts` volume (both compose files).
15. Delete `db/fnb-agent/` (whole package); drop `fnb-agent` from `DEPLOY_PACKAGES`
    (`.env`/`.env.example`/`scripts/env-build.ts`).
16. `trigger-workflow.plugin.ts`: remove the `engine` field, `WorkflowEngine` type, the agent
    fetch branch, `AGENT_*` env reads → n8n-only registry (`_shared.data.md` final shape).
17. `graphile.config.ts`: remove `agent, agent_api` from `pgServices.schemas`;
    `postgraphile.tags.json5`: remove agent smart-tag entries (keep n8n renames).
18. Client layer: relocate `graphql/agent/mutation/triggerWorkflow.graphql` →
    `graphql/n8n/mutation/`; delete `agentWorkflowRuns.graphql`, `mappers/agent-workflow-run.ts`,
    `composables/useAgentWorkflowRuns.ts` (+ barrel line), the tenant-app re-export, and the
    `AgentWorkflowRun` interface in `fnb-types/src/workflow-run.ts`. Delete
    `apps/tenant-app/app/pages/site-admin/wf-agentic/`; remove the `tenant-site-admin-wf-agentic`
    nav row in `db/fnb-app/deploy/00000000010240_app_fn.sql`. Re-run codegen; fix fallout.
19. Env fan-out: remove `AGENT_INTERNAL_URL`, `AGENT_TRIGGER_SECRET`, `AGENT_WORKER_PG_PASSWORD`,
    `AGENT_MODEL_DEFAULT`, `ASSET_SCAN_REAPER_CRON` from `.env`/`.env.example`/env-build docs,
    both compose files, `.github/workflows/deploy.yml`; drop the `agent_worker_password` threading
    in `scripts/db-deploy.ts` + `docker/migrate-entrypoint.sh`. Keep `ANTHROPIC_API_KEY`.
20. Deps: `@anthropic-ai/claude-agent-sdk`, `croner` go with agent-app; prune orphaned catalog
    entries (R24 `dep-audit`; keep `zod`). `pnpm build` + `pnpm dep-audit` green.

## Phase 5 — R21 propagation + final verification — ✅ DONE 2026-07-21 (rebuild verified)
**Final rebuild verified end-to-end:** n8n-import exit 0; DB agent-free (0 agent schemas, 0
`agent_worker` role, `n8n_worker` present); all 7 workflows active from boot-import; custom image
has clamdscan+ffmpeg + baked `~/.n8n-files`; upload→asset-scan→clean promote works from the
boot-imported workflow; rekeyed `exerciser` → `success`; nav shows only **Workflows**
(wf-agentic tool count 0). One boot-import fix during the rebuild: `n8n-cli workflow get` exports
carry a `shared` project ref that violates the `workflow_entity` FK on a fresh `n8n_engine` —
stripped `asset-scan`/`asset-scan-reaper` to `{id,name,active,nodes,connections,settings,pinData}`
(memory `project_n8n_hardened_image`, gotcha #5).

### Original Phase 5 propagation
global-rules R22 rewritten (sole n8n engine); `monorepo-bootstrap-pattern.md` (no headless apps,
n8n custom image, deploy order); CLAUDE.md (apps table, db list eleven pkgs, tech stack); skill-map
(`claude-agent-sdk` removed); **deleted** `.claude/specs/agentic-workflow-engine/` +
`.claude/skills/claude-agent-sdk/`; asset-storage superseded pointers repointed → agentic-decommission
(×3); `worker-pattern.md` + `server-pattern.md` repointed; n8n-parallel-engine sole-engine Status note;
memory sweep (`feedback_sqitch_edit_in_place` example updated); dead `infra/docker/agent.Dockerfile`
deleted + build-images.sh / terraform / Caddyfile / infra-README cleaned. Verification greps: no
`apps/agent-app`/`agent_worker`/`AGENT_*`/`claude-agent-sdk`/`useAgentWorkflowRuns`/`AgentWorkflowRun`/
`dataset_sync_busy`/`ASSET_SCAN_REAPER_CRON`/`sweep_orphaned_runs` in live code (remaining `agent`
hits = the battleship game AI + historical SQL provenance comments). **`pnpm build` + `pnpm dep-audit`
green.** ⏳ **PENDING: the final user rebuild** — proves the stack deploys without `fnb-agent`, the n8n
custom image builds fresh, the workflows reproduce from repo JSON via boot-import, and upload→scan→
promote works end-to-end (decommission.data.md checklist items 3–8).

### Original Phase 5 scope
Ref: `decommission.data.md` → "Spec / skill propagation" + "Verification checklist".

21. `global-rules.md` R22 rewrite (sole n8n engine); `monorepo-bootstrap-pattern.md` (drop
    agent-app, add n8n custom image); `CLAUDE.md` (apps table, db list + ordering note, tech
    stack, R22 prose).
22. `skill-map.md`: remove `claude-agent-sdk`; **delete `.claude/skills/claude-agent-sdk/`** and
    **`.claude/specs/agentic-workflow-engine/`**. Repoint the `asset-storage` superseded pointer
    → this spec's `asset-scan.workflow.data.md`. Add a "sole engine" Status note to
    `n8n-parallel-engine` README/`_shared`. Memory sweep (agent-app/`agent_worker`/claude-agent-sdk).
23. Run the full `decommission.data.md` verification checklist (greps clean; build/dep-audit/
    codegen green; rebuild deploys without fnb-agent; upload→asset-scan→promote+thumbnail; EICAR→
    infected; reaper re-fire; Datasets Sync + exerciser on n8n; nav clean, wf-agentic 404s;
    `agent_worker` role gone).

---

## Gates & house rules
- **Never run git** (global rule). Stop at commit points and report.
- **Never rebuild/restart the env yourself** — ask the user, then read-only verify
  (`feedback_rebuild_ask_user`). Two explicit user rebuild gates above.
- Sqitch edits are **edit-in-place** (dev rebuilds from scratch; `feedback_sqitch_edit_in_place`);
  route plan/dep mechanics through `sqitch-expert`.
- On completion, ask before moving this plan to `addressed/` (`feedback_ask_before_moving_addressed`).
