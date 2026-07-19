# Plan: Agentic workflow engine — full replacement of graphile-worker + wf module + dashboard (Claude Agent SDK)

> **Execution Directive:** Implement this plan via `/fnb-stack-implementor <this-file>`.
> The authoritative spec is `.claude/specs/agentic-workflow-engine/` (README + `_shared.data.md`
> + `infrastructure.md` + `asset-scan.workflow.data.md` + `dataset-sync.workflow.data.md` +
> `exerciser.workflow.data.md` + `decommission.data.md`) — this plan sequences it and records
> the findings below; it does not restate the spec (R21). Specialist skills:
> `fnb-create-app` (Phase 1 skeleton, adapted headless), `new-db-package` (Phase 2),
> `sqitch-expert` (all DB phases), `fnb-db-designer` (RLS/grants), `claude-api` (SDK/model
> facts), `postgraphile-5-expert` (Phase 5 extendSchema plugin), `breweries-expert` /
> `airports-expert` (Phase 4 API facts), `graphile-worker-expert` (read-only, for understanding
> the retired handlers). **Never run any `git` command** (user global rule — no git actions
> ever, including during sqitch sessions). **Never rebuild/restart the env yourself** — ask the
> user, then verify read-only.

**Severity: MED** (feature/migration work) · Workstream: wf → agent · Planned: 2026-07-17
· Spec status: Draft, decisions locked 2026-07-17, no `[FILL IN]`s, open questions all deferred
non-blocking.

> **Competing alternative** to `0010__wf________n8n-workflow-engine_____________MED__.plan.md`
> (same mission, different engine). **Exactly one of the two plans gets executed** — executing
> this one includes marking the n8n spec superseded (Phase 7); executing that one supersedes
> this. Do not run both.

## Context

Full replacement of the fnb workflow system: the graphile-worker runner (`apps/worker-app`), the
`db/fnb-wf` module (schema/UOW DAG/templates), and the VueFlow Workflow Dashboard all retire in
favor of a headless **`apps/agent-app`** running the **Claude Agent SDK**. Each workflow is a
goal prompt + a closed toolbox of zod-validated custom tools; the agent sequences steps at
runtime. Four workflows (`exerciser`, `sync-breweries`, `sync-airports`, `asset-scan`) + a
deterministic croner reaper. App-side observability is `agent.workflow_run` (new `db/fnb-agent`
package, with per-run `model` + `usage`); step-level record is per-run transcript JSONL on the
`agent-transcripts` volume. fnb→agent is trigger-endpoint-only (shared-secret header); agent→fnb
is the `agent_worker` PG role calling `_fn` functions from tool handlers only. No new database,
no import job. All decisions are locked in the spec README.

## Findings from planning (verified against source 2026-07-17)

Findings 1–7 were verified during the same-day planning of the sibling n8n plan (identical
retirement blast radius, same clean tree) and re-apply here; 8–9 are agentic-specific.

1. **`app_fn.raise_exception` does not exist** — only `app_api.raise_exception(_message citext)`
   (`db/fnb-app/deploy/00000000010240_app_fn.sql:1439`, SECURITY INVOKER, no permission gate,
   just raises). The spec's grant table (`_shared.data.md` → fnb-app row) and the exerciser's
   `raise_db_exception` tool say `app_fn.raise_exception`. **Correction:** the tool handler and
   the `fnb-app` grants change target `app_api.raise_exception` (`USAGE` on `app_api` +
   `EXECUTE` on that one function to `agent_worker`; INVOKER is fine — it only raises). Fold
   into `_shared.data.md` + `exerciser.workflow.data.md` at Phase 7.
2. **Sync-status anchors:** `brewery_sync_status` reads `wf.wf`/`wf.uow` at
   `db/fnb-location-datasets/deploy/00000000010710_location_datasets_fn.sql:167–190`;
   `airport_sync_status` at `db/fnb-airports/deploy/00000000010810_airports_fn.sql:531–560`
   (`in_progress` at :549). Both packages carry `fnb-wf:00000000010500_wf` cross-project deps on
   their `_fn` change (`sqitch.plan:5` in each) — the rework swaps those deps to the new
   `fnb-agent` change. Per memory `feedback_sqitch_edit_in_place`, edit deploy files in place
   (dev env is rebuild-from-scratch; no rework choreography).
3. **Storage grant targets** live in
   `db/fnb-storage/deploy/00000000010625_storage_resolve_asset_scan.sql` (`resolve_asset_scan`,
   `insert_derived_asset`, `add_asset_tags` — each already has revoke/grant blocks to extend).
   The `ensure_asset_scan_wf` change is `00000000010630…` (plan line 10, dep on
   `fnb-wf:00000000010520_wf_fn`) — deleted at Phase 6.
4. **`@vue-flow/*` + `elkjs`** appear in exactly one manifest
   (`apps/graphql-api-app/package.json:24–26`, direct semver, not catalogued) → safe to remove
   with the workflow UI. `graphile-worker` is catalogued (`pnpm-workspace.yaml:23`) with exactly
   two consumers (`worker-app`, `graphql-api-app`) — both retire, so the catalog entry prunes
   too (R24).
5. **Env anchors:** `DEPLOY_PACKAGES` lives in `.env:17` + `.env.example:42` only. The retained
   tunables (`ASSET_SCAN_MAX_WF_ATTEMPTS`, `ASSET_SCAN_STUCK_MINUTES`, `CLAMAV_HOST/PORT`,
   `S3_*`) are at `.env:35–49`; `ASSET_SCAN_REAPER_CRON` (`.env:49`) is **retained** here —
   the croner schedule reads it (unlike the n8n plan, which retired it). No `AGENT_*` vars
   exist yet.
6. **Upload endpoint anchor:** `packages/storage-layer/server/api/upload.post.ts:166–176` is the
   `ensure_asset_scan_wf` + `wf_api.queue_workflow` block to replace with the post-commit POST.
7. **wf client inventory confirmed:** composables `useWfInstances`, `useWfDetail`,
   `useWfTemplates`, `useQueueWorkflow`, `usePullTrigger` + barrel lines
   `packages/graphql-client-api/src/index.ts:28–32`; app-side
   `apps/graphql-api-app/app/composables/` adds `useWfFlowGraph.ts`; pages/components and
   `packages/fnb-types/src/workflow.ts` as inventoried in `decommission.data.md`.
   `apps/graphql-api-app/server/api/mutation-hooks/` contains only the five wf files
   (re-verified by listing 2026-07-17) — still re-check `index.ts` registers nothing else
   before deleting (Phase 6).
8. **None of the three new deps are catalogued:** `pnpm-workspace.yaml` has no
   `@anthropic-ai/claude-agent-sdk`, `croner`, or `zod` entries (verified by grep). Add all
   three to the default catalog at Phase 1 and declare them `"catalog:"` in agent-app (R24).
   Pin the SDK's latest stable + `claude-haiku-4-5` at Phase-1 time (README open-question
   resolution is procedural — resolve via the `claude-api` skill, not memory).
9. **worker-app slot anchors:** compose service at `docker-compose.yml:520` (custom
   ffmpeg-bearing `apps/worker-app/Dockerfile` — the image precedent agent-app inherits);
   its `node_modules_worker_app` volume is referenced at `:83` and `:562` and retires with it
   (Phase 6). agent-app gets its own `node_modules_agent_app` volume in the dev-mode compose
   pattern (mirror the worker-app block's shape, minus graphile-worker env).

## Implementation phases

Follows the spec README task list. **`pnpm build` is the gate** (repo lint is broken).
New deps: `@anthropic-ai/claude-agent-sdk`, `croner`, `zod` (finding 8) — catalog entries +
`"catalog:"` declarations in agent-app only. Old engine stays live through Phase 5
(parallel-run window); nothing wf/worker-owned is touched before Phase 6.

### Phase 1 — Infrastructure (`infrastructure.md`)
- `apps/agent-app` skeleton via `fnb-create-app` **adapted headless** (worker-app precedent: no
  nginx location, no `NUXT_APP_BASE_URL`, no layers, no pages; listens on `:3000`
  compose-internal). Depends on `fnb-types` only — no db-access/graphql-client-api.
- `apps/agent-app/Dockerfile` (same node/pnpm stages as other apps + `apk add --no-cache ffmpeg
  clamav-clients`) + `apps/agent-app/clamd-remote.conf` (`TCPSocket 3310` / `TCPAddr clamav`).
- `docker-compose.yml`: add `agent-app` service (block verbatim from `infrastructure.md`, incl.
  the SOFT clamav gate + `depends_on` db-migrate/minio-init) + `agent-transcripts` volume +
  `node_modules_agent_app` volume (finding 9). Remove nothing yet (worker-app `:520` stays
  until Phase 6). Add `AGENT_INTERNAL_URL` + `AGENT_TRIGGER_SECRET` to `graphql-api-app` and
  `storage-app` service env now (consumed at Phase 5; harmless earlier).
- Env: add `ANTHROPIC_API_KEY`, `AGENT_MODEL_DEFAULT`, `AGENT_TRIGGER_SECRET`,
  `AGENT_INTERNAL_URL`, `AGENT_WORKER_PG_PASSWORD`, `AGENT_RUN_TIMEOUT_MINUTES` to `.env` +
  `.env.example` (+ `scripts/env-build.ts` docs if it enumerates vars). `ASSET_SCAN_REAPER_CRON`
  stays (finding 5). **`ANTHROPIC_API_KEY` value comes from the user** — ask, never invent.
- Catalog: add `@anthropic-ai/claude-agent-sdk` (pin latest stable now), `croner`, `zod`
  (finding 8); declare in `apps/agent-app/package.json` as `"catalog:"`. `pnpm dep-audit` green.
- SDK smoke test: a trivial hello-world `query()` run wired behind a dev-only route or boot log,
  proving `ANTHROPIC_API_KEY` + the pinned SDK work inside the container (verified after the
  rebuild gate).

### Phase 2 — `db/fnb-agent` package + grants + sync-status reworks (`_shared.data.md`)
- Scaffold via `/new-db-package` → registers in `DEPLOY_PACKAGES` (both `.env:17` and
  `.env.example:42`); **place `fnb-agent` after `fnb-app`, keep `fnb-wf` for now** (removed
  Phase 6).
- Changes: `agent` schema + `workflow_run` + `workflow_run_status` enum + the two indexes;
  `agent_fn` (`begin_run/attach_session/complete_run/error_run/running_count`, SECURITY
  DEFINER); `agent_api.workflow_runs` (gated `p:app-admin-super`); policies change (RLS per
  spec: super-admin SELECT incl. `tenant_id IS NULL` anchor rows); `agent_worker` role
  (idempotent `DO $$` guard, `LOGIN NOINHERIT`, password `:'agent_worker_password'` from
  `AGENT_WORKER_PG_PASSWORD` at deploy — mirror how sqitch passwords flow today) + grants on
  `agent`/`agent_fn`. Cross-project dep on `fnb-app:00000000010250_app_policies` (jwt
  helpers/grants precedent from the breweries plan).
- Grants changes in owning packages (edit-in-place memory applies):
  - `fnb-storage`: new change — `agent_worker` grants (`resolve_asset_scan`,
    `insert_derived_asset`, `add_asset_tags` per finding 3) + new
    `storage_fn.asset_for_scan(uuid)` + `storage_fn.stuck_pending_assets(stuck_minutes int,
    max_attempts int)` (attempt count via `agent.workflow_run` where
    `workflow_key='asset-scan'`; dep on the new `fnb-agent` change) + `USAGE` on
    `storage`/`storage_fn`.
  - `fnb-location-datasets`: grants (`upsert_breweries`, schema USAGE); rework
    `…10710_location_datasets_fn.sql:167–190` `brewery_sync_status` →
    `agent_fn.running_count('sync-breweries') > 0`; swap the plan dep `fnb-wf:…_wf` →
    `fnb-agent:<new change>` (finding 2).
  - `fnb-airports`: grants (`upsert_*` ×6, `record_sync_source` (`…10810_airports_fn.sql:504`),
    `SELECT` on `airports.sync_source` (`…10800_airports.sql:179`), schema USAGE); same
    `airport_sync_status` rework (:549) + dep swap.
  - `fnb-app`: grants — **`app_api.raise_exception`** (finding 1, not `app_fn`).
- PostGraphile: add `agent, agent_api` to `schemas`
  (`apps/graphql-api-app/server/graphile.config.ts:29`). **Do not remove `wf, wf_api` yet**
  (parallel-run window; removal is Phase 6).
- Parallel-window caveat (accepted): once reworked, `brewerySyncStatus`/`airportSyncStatus`
  report agent runs only — old-engine syncs during Phases 2–5 won't show `in_progress`.
  Dev-only, transient.

### ⏸ USER REBUILD GATE 1
Phases 1–2 land together on one rebuild (agent-app container + fnb-agent schema +
`agent_worker` role + env). **Ask the user to run it** (and to supply `ANTHROPIC_API_KEY` +
generated `AGENT_TRIGGER_SECRET`/`AGENT_WORKER_PG_PASSWORD` values first). Then verify
read-only per `infrastructure.md` §Verification: `docker compose ps` (agent-app up, db-migrate
exited 0 with fnb-agent deployed); SDK smoke test ran; `psql` as `agent_worker` can execute
granted fns and **cannot** `select from app.profile`.

### Phase 3 — Harness + toolbox plumbing, proven by `exerciser` (`_shared.data.md`,
`exerciser.workflow.data.md`)
Code-only from here to Phase 5 — agent-app runs `nuxt dev` in the container, so iterate without
rebuilds.
- `server/lib/agent-workflows/types.ts` (`AgentWorkflowDefinition<TInput>`) + static registry
  `agent-workflows/index.ts`.
- Trigger route `server/api/trigger/[key].post.ts`: secret header → 401; unknown key → 404;
  zod `inputSchema` parse → 400 + issues; `singleton` pre-begin guard via
  `agent_fn.running_count` → `200 { accepted: false, reason: 'already-running' }`;
  `agent_fn.begin_run` → `202 { accepted: true, runId }`, run detached.
- `server/lib/agent-harness.ts` `runWorkflow(def, input, { tenantId })`: toolbox = `def.tools`
  + harness-injected `complete_run` (hands resultData to the harness — **the tool never writes
  the DB**); `query()` with `model`/`maxTurns`/`mcpServers: { fnb: createSdkMcpServer(…) }`/
  `allowedTools` = the `mcp__fnb__*` set only/`settingSources: []`/
  `permissionMode: 'bypassPermissions'`; transcript JSONL append per message to
  `/data/transcripts/<runId>.jsonl`; `attach_session` on init; wall-clock cap
  `AGENT_RUN_TIMEOUT_MINUTES`; terminal accounting → `agent_fn.complete_run` else
  `agent_fn.error_run` (SDK error / timeout / maxTurns / missing terminal tool).
- `server/lib/agent-tools/` utilities: the `agent_worker` pg pool (host/port/db from env,
  password `AGENT_WORKER_PG_PASSWORD`) — tools only; nothing else holds it.
- `server/plugins/agent-scheduler.ts`: croner plugin skeleton (reaper job added Phase 4).
- **`exerciser` workflow** (`agent-workflows/exerciser.ts`): tools `get_stock_quote`,
  `throw_error`, `raise_db_exception` (→ `app_api.raise_exception`, finding 1),
  `await_operator_trigger` (EventEmitter waiter keyed by runId + resume route
  `POST /api/trigger/exerciser/resume/<runId>` with the same secret; records the resume URL in
  `result_data`; does not survive restart — accepted); `maxTurns: 10`.
- Verify via curl with the secret (compose-internal or temp-mapped port): (a) clean path incl.
  wait/resume, (b) `throwError`, (c) `raiseExceptionMessage`, (d) `burnTurns` → maxTurns →
  `error_run`; plus wrong secret 401 / unknown key 404 / malformed body 400 + zod issues.
  Each run: `agent.workflow_run` terminal row with `model`, `usage` populated + transcript file.
  This proves trigger auth, grants, error catch-all, budgets, run log — end-to-end.

### Phase 4 — Convert workflows (per-workflow spec files; old engine still live)
1. **`sync-breweries`** (`dataset-sync.workflow.data.md`): tools `get_breweries_meta`,
   `sync_breweries_page` (fetch retry 3×10s on network/5xx, none on 4xx →
   `location_datasets_fn.upsert_breweries($1::jsonb)` per page — same payload as the retired
   handler; returns counts, never rows); `maxTurns: 60`; `singleton: true`; goal prompt:
   strictly sequential pages (volunteer-run API — API facts via `breweries-expert`). Verify by
   curl-triggering: counts stable vs the existing ~11.7k rows, no dupes; second trigger while
   running → `accepted: false`.
2. **`sync-airports`**: tool `sync_airport_file` (etag read from `airports.sync_source` →
   conditional GET/304-skip → CSV parse → chunked `airports_fn.upsert_*` → `record_sync_source`;
   file list/order/chunk size lifted from the retired `airports/sync-airports.ts` — read it;
   quirks via `airports-expert`); `maxTurns: 25`; `singleton: true`; goal prompt carries the
   parent-vs-child partial-failure policy (parents countries/regions/airports stop the run;
   child failures record-and-continue). Verify a full run, then a second run hits the 304/skip
   path.
3. **`asset-scan` + reaper** (`asset-scan.workflow.data.md`): tools `get_asset`
   (`storage_fn.asset_for_scan`), **atomic `scan_and_resolve`** (S3 Get → `/tmp` →
   `clamdscan --config-file=/etc/clamav/clamd-remote.conf --stream`, internal retry 5×30s →
   verdict → clean: Copy+Delete+`resolve_asset_scan('clean')` / infected:
   Delete+resolve / error: resolve, bytes stay; idempotent, `/tmp` cleanup in `finally`),
   `make_thumbnail` (in-handler `scan_status='clean'` guard → ffmpeg 256px webp →
   `insert_derived_asset`), `add_asset_tags` (`ai-tags-coming-soon` stub); `maxTurns: 12`; not
   singleton. Reaper croner job in `agent-scheduler.ts` (`ASSET_SCAN_REAPER_CRON`):
   `storage_fn.stuck_pending_assets($ASSET_SCAN_STUCK_MINUTES, $ASSET_SCAN_MAX_WF_ATTEMPTS)` →
   sequential self-POST per row — deterministic code, no agent. Verify by curl-POSTing
   `{ assetId, tenantId, aiTagsRequested }` for a real quarantined upload (uploads still ride
   the old engine until Phase 5 — use a manually re-fired asset or set one `pending`); verify
   clean promote, thumbnail on `image/*`, and the reaper re-fire + at-cap flip to `error`.

### Phase 5 — App integration (`_shared.data.md`)
- `triggerWorkflow` extendSchema plugin in `apps/graphql-api-app/server/api/` (R7-thin: claims
  401 gate → static allow-map `{ 'sync-breweries': null, 'sync-airports': null, 'exerciser':
  'p:app-admin-super' }` → POST `{ ...inputData, tenantId, profileId }` with secret header →
  `{ accepted, runId }`); register in `server/graphile.config.ts` presets
  (→ `postgraphile-5-expert`). `asset-scan` deliberately absent from the map.
- Restart of graphql-api-app needed for the schema change — ask the user; then codegen:
  `packages/graphql-client-api/src/graphql/agent/mutation/triggerWorkflow.graphql` →
  `pnpm -F @function-bucket/fnb-graphql-client-api generate` → `useTriggerWorkflow` composable
  + **barrel line** (`src/index.ts` — the #1 miss).
- Rewire `useBreweries.ts` (:7, :54, :73) and `useAirports.ts` (:10, :60, :79):
  `useQueueWorkflow` → `useTriggerWorkflow`; public API + pages unchanged (R1). Polling loops
  keep working via the reworked sync-status fns.
- `upload.post.ts`: strip lines ~166–176 (`ensure_asset_scan_wf` + `queue_workflow`) from the
  transaction; after commit, POST `{ assetId, tenantId, aiTagsRequested }` to
  `${AGENT_INTERNAL_URL}/api/trigger/asset-scan`; log-and-swallow failures (reaper owns strays).
- `pnpm build` green. End-to-end verify (read-only; parallel-run window): upload → scan →
  clean promote via the agent; Datasets "Sync now" via `triggerWorkflow` (any authenticated
  user — parity gate); exerciser via GraphiQL as super-admin.

### Phase 6 — Decommission (`decommission.data.md` — the complete inventory; nothing before
this phase touched wf/worker code)
- Delete: `apps/worker-app/` + compose service (`docker-compose.yml:520`) + volume
  `node_modules_worker_app` (`:83`, `:562` — finding 9); `db/fnb-wf/`; `mutation-hooks/`
  (after confirming `index.ts` registers only the wf hooks — finding 7); `src/graphql/wf/**`;
  the five wf composables + barrel lines (`index.ts:28–32`) + any wf mappers;
  `fnb-types/src/workflow.ts` + barrel line; workflow pages/components + the six app
  composables (incl. `useWfFlowGraph`); `.claude/specs/graphql-api-app/workflow/`;
  `db/fnb-storage` change `00000000010630_storage_ensure_asset_scan_wf` (deploy/revert/verify
  + plan line 10 — `sqitch-expert` for plan-edit mechanics).
- Edit: `DEPLOY_PACKAGES` drop `fnb-wf` (both files; `ASSET_SCAN_REAPER_CRON` **stays** —
  finding 5); `db/fnb-storage/sqitch.plan` drop the `fnb-wf:…_wf_fn` dep from `00000000010630`'s
  line (gone with the deletion) — no other fnb-wf deps remain (finding 2 swapped the other two);
  `db/fnb-app/deploy/00000000010240_app_fn.sql:356` remove the `tenant-site-admin-wf` tool row
  (R14); `db/seed.sql` remove the wf-exerciser (:125+) and sync-breweries (:269+) /
  sync-airports template blocks; `graphile.config.ts:29` remove `wf, wf_api`;
  `apps/graphql-api-app/package.json` remove `graphile-worker`, `@vue-flow/*`, `elkjs`
  (finding 4) + prune the `graphile-worker` catalog entry (`pnpm-workspace.yaml:23`); verify
  `auth-server`/`useFnbPgClient` remaining consumers (msg/storage carve-outs) — keep the
  package, prune only if orphaned.
- Codegen re-run (schema loses wf types, keeps `agent_api` + `triggerWorkflow`); fix fallout.
  `pnpm build` + `pnpm dep-audit` green.

### ⏸ USER REBUILD GATE 2
Fresh rebuild without `fnb-wf`/worker-app. Then the full post-decommission checklist
(`decommission.data.md` §Verification): repo-wide greps clean (`graphile.worker`,
`graphile_worker`, `wf_api\.`, `wf_fn\.`, `wf\.uow`, `queueWorkflow`, `workflow_handler_key`,
`ensure_asset_scan_wf` — nothing outside `.claude/` history); four workflow definitions
registered + reaper scheduled; upload → scan → promote end-to-end; "Sync now" works; exerciser
error paths land as `error` with `usage` populated; nav shows no Workflow Dashboard;
`/graphql-api/workflow` 404s.

### Phase 7 — R21 propagation + wrap-up (`decommission.data.md` §Spec/skill propagation)
- `global-rules.md`: rewrite R22 (agent-app is the only workflow engine; fnb→agent
  trigger-endpoint-only with shared secret; agent→fnb `agent_worker`-via-`_fn` only, from tool
  handlers only; closed toolboxes — no built-in tools, no SQL tool; invariant-bearing
  transitions are single deterministic tools); prune R5/R17 worker mentions.
- Pattern files: `monorepo-bootstrap-pattern.md` (headless-apps → agent-app topology + deploy
  order), `graphql-api-pattern.md` + `graphql-api-app/server-pattern.md` (mutation-hooks →
  `triggerWorkflow` plugin), `graphql-api-app/worker-pattern.md` → tombstone,
  `asset-storage/asset-scan-workflow.data.md` → superseded-by pointer (+ README/infrastructure
  worker mentions).
- Skills via `.claude/skills/skill-map.md`: demote `graphile-worker-expert`; **author + register
  a `claude-agent-sdk` specialist skill** (tool definition, `query()` options,
  session/permission semantics — the harness is now house infrastructure); rewrite worker/wf
  references in `fnb-stack-implementor` + `fnb-stack-spec`; update `vue-flow-expert`'s UOW note
  (the vue-flow deps went at Phase 6).
- `CLAUDE.md` (apps table worker-app → agent-app, db list `fnb-wf` → `fnb-agent`, tech stack
  graphile-worker → Claude Agent SDK); `.claude/memory/` sweep for wf-era memories.
- Mark `.claude/specs/n8n-workflow-engine/README.md` **superseded — the agentic alternative was
  chosen** (or delete the dir — user's call), and disposition its plan file
  (`0010__wf________n8n-workflow-engine…`) with the user.
- Fold this plan's findings (1–9) into the spec files; flip spec Status lines.
- Ask the user before moving this plan to `addressed/` (completion hand-off).

## Sequencing summary

1. Phases 1–2 (app skeleton + compose/env + catalog + sqitch sessions — **no git ever**) →
   **user rebuild 1** (user supplies `ANTHROPIC_API_KEY` + secrets) → infra verification + SDK
   smoke test.
2. Phase 3 harness + exerciser, then Phase 4 workflow-by-workflow (breweries → airports →
   asset-scan/reaper), all hot-reloading in the dev container — curl-verified against the run
   log + transcripts as each lands.
3. Phase 5 app integration (graphql-api-app restart → codegen → rewires) → parallel-run
   end-to-end verify.
4. Phase 6 decommission → **user rebuild 2** → full checklist → Phase 7 propagation → sign-off.
5. User touchpoints: two rebuilds, one graphql-api-app restart, the three secret values at
   gate 1, the n8n-spec disposition, final sign-off.

## Out of scope / linked (spec README deferrals)

- Durable wait/resume via SDK session resume — exerciser's waiter dies with the process
  (accepted).
- Real AI tagging (`add_asset_tags` stays the stub); admin "runs panel" over
  `agent_api.workflow_runs`; scheduled nightly syncs (one croner line later); cost guardrails
  beyond per-run budgets; production posture (scale/backpressure/prompt-injection review).
- `0030__wf________wf-rls-missing__________________CRT__.plan.md` — **mooted for the wf module**
  (it retires) but re-check at Phase 7: its residue (`queueWorkflow` gating) is replaced by the
  `triggerWorkflow` allow-map; annotate or retire 0030 with the user's sign-off.
- `0010__wf________n8n-workflow-engine…` — the competing plan; superseded if this one executes.
