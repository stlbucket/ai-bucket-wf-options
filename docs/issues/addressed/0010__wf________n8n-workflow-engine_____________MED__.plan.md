# Plan: n8n workflow engine — full replacement of graphile-worker + wf module + dashboard

> **SUPERSEDED 2026-07-17 — DO NOT EXECUTE.** The competing agentic plan
> (`0015__wf________agentic-workflow-engine_________MED__`) was executed instead; the shared
> retirement inventory (worker-app, db/fnb-wf, dashboard, wf client code) is already done and
> `apps/agent-app` is the stack's workflow engine (R22). Kept as the record of the road not
> taken; spec `.claude/specs/n8n-workflow-engine/` carries the matching supersede marker.

> ~~**Execution Directive:** Implement this plan via `/fnb-stack-implementor <this-file>`.~~
> The authoritative spec is `.claude/specs/n8n-workflow-engine/` (README + `_shared.data.md` +
> `infrastructure.md` + `asset-scan.workflow.data.md` + `dataset-sync.workflow.data.md` +
> `exerciser.workflow.data.md` + `decommission.data.md`) — this plan sequences it and records
> the corrections below; it does not restate the spec (R21). Specialist skills:
> `new-db-package` (Phase 2), `sqitch-expert` (all DB phases), `fnb-db-designer` (RLS/grants),
> `postgraphile-5-expert` (Phase 5 extendSchema plugin), `n8n-cli` (Phases 3–4 operator loop),
> `breweries-expert` / `airports-expert` (Phase 4 API facts), `graphile-worker-expert` (read-only,
> for understanding the retired handlers). **Never run any `git` command** (user global rule —
> no git actions ever, including during sqitch sessions). **Never rebuild/restart the env
> yourself** — ask the user, then verify read-only.

**Severity: MED** (feature/migration work) · Workstream: wf → n8n · Planned: 2026-07-17
· Spec status: Draft, decisions locked 2026-07-17, no `[FILL IN]`s, open questions all deferred
non-blocking.

## Context

Full replacement of the fnb workflow system: the graphile-worker runner (`apps/worker-app`), the
`db/fnb-wf` module (schema/UOW DAG/templates), and the VueFlow Workflow Dashboard all retire in
favor of a self-hosted n8n container (custom image, own host port, state in a separate
`n8n_engine` database in the existing postgis cluster). Five workflows: `asset-scan`,
`asset-scan-reaper`, `sync-breweries`, `sync-airports`, `exerciser`, plus the shared
`error-handler`. App-side observability shrinks to `n8n.workflow_run` (new `db/fnb-n8n` package);
fnb→n8n is webhook-only (shared-secret header); n8n→fnb is the `n8n_worker` PG role calling `_fn`
functions only. All decisions are locked in the spec README.

## Spec corrections / findings from planning (verified against source 2026-07-17)

1. **`app_fn.raise_exception` does not exist** — only `app_api.raise_exception(_message citext)`
   (`db/fnb-app/deploy/00000000010240_app_fn.sql:1439`, SECURITY INVOKER, no permission gate,
   just raises). The retired handler (`wf-exerciser/maybe-raise-exception.ts:11`) calls
   `app_fn.raise_exception` — a call that "worked" only because a nonexistent function itself
   raises. **Correction:** the exerciser's PG node and the `fnb-app` grants change target
   `app_api.raise_exception` (`USAGE` on `app_api` + `EXECUTE` on that one function to
   `n8n_worker`). Fold into `_shared.data.md`'s grant table + `exerciser.workflow.data.md` at
   Phase 7.
2. **`n8n_engine` DB creation precedent:** the `zitadel` database is created by
   `docker/db-init/10-create-zitadel-db.sh` (a `/docker-entrypoint-initdb.d` fresh-volume
   script), not by a one-shot service — `zitadel-init` does other work. The spec locks a
   `n8n-db-init` one-shot service; implement as specced (it is idempotent on every boot, strictly
   more robust than fresh-volume-only). Noting the nearer precedent for the record only.
3. **Sync-status anchors:** `brewery_sync_status` reads `wf.wf`/`wf.uow` at
   `db/fnb-location-datasets/deploy/00000000010710_location_datasets_fn.sql:167–190`;
   `airport_sync_status` at `db/fnb-airports/deploy/00000000010810_airports_fn.sql:531–560`
   (`in_progress` at :549). Both packages carry `fnb-wf:00000000010500_wf` cross-project deps on
   their `_fn` change (`sqitch.plan:5` in each) — the rework swaps those deps to the new
   `fnb-n8n` change. Per memory `feedback_sqitch_edit_in_place`, edit the deploy files in place
   (dev env is rebuild-from-scratch; no rework choreography).
4. **Storage grant targets** live in
   `db/fnb-storage/deploy/00000000010625_storage_resolve_asset_scan.sql` (`resolve_asset_scan`,
   `insert_derived_asset`, `add_asset_tags` — each already has revoke/grant blocks to extend).
   The `ensure_asset_scan_wf` change is `00000000010630…` (plan line 10, dep on
   `fnb-wf:00000000010520_wf_fn`) — deleted at Phase 6.
5. **`@vue-flow/*` + `elkjs`** appear in exactly one manifest
   (`apps/graphql-api-app/package.json:24–26`, direct semver, not catalogued) → safe to remove
   with the workflow UI. `graphile-worker` is catalogued (`pnpm-workspace.yaml:23`) with exactly
   two consumers (`worker-app`, `graphql-api-app`) — both retire, so the catalog entry prunes
   too (R24).
6. **Env anchors:** `DEPLOY_PACKAGES` lives in `.env:17` + `.env.example:42` only. The retained
   tunables (`ASSET_SCAN_MAX_WF_ATTEMPTS`, `ASSET_SCAN_STUCK_MINUTES`, `CLAMAV_HOST/PORT`,
   `S3_*`) are at `.env:35–49`; `ASSET_SCAN_REAPER_CRON` (`.env:49`) retires into the reaper
   workflow JSON. No `N8N_*` vars exist yet.
7. **Upload endpoint anchor:** `packages/storage-layer/server/api/upload.post.ts:166–176` is the
   `ensure_asset_scan_wf` + `wf_api.queue_workflow` block to replace with the post-commit POST.
8. **wf client inventory confirmed:** composables `useWfInstances`, `useWfDetail`,
   `useWfTemplates`, `useQueueWorkflow`, `usePullTrigger` + barrel lines
   `packages/graphql-client-api/src/index.ts:28–32`; app-side
   `apps/graphql-api-app/app/composables/` adds `useWfFlowGraph.ts`; pages/components and
   `packages/fnb-types/src/workflow.ts` as inventoried in `decommission.data.md`.
   `apps/graphql-api-app/server/api/mutation-hooks/` contains only the five wf files — still
   re-verify `index.ts` registers nothing else before deleting (Phase 6).

## Implementation phases

Follows the spec README task list. **`pnpm build` is the gate** (repo lint is broken). New env
vars but no new npm dependencies (workflow logic moves into n8n JSON; the custom image is
Docker-side) — R24 impact is only the Phase 6 *removals*.

### Phase 1 — Infrastructure (`infrastructure.md`)
- `docker/n8n/Dockerfile` (FROM `docker.n8n.io/n8nio/n8n:<pin>` — **resolve the latest stable
  tag now, at implementation time**, zitadel precedent; + ffmpeg, clamav-clients, gettext) +
  `docker/n8n/clamd-remote.conf` (`TCPSocket 3310` / `TCPAddr clamav` — clamav service is
  `docker-compose.yml:155`, image `clamav/clamav:1.5.3`).
- `docker-compose.yml`: add `n8n-db-init` (one-shot, `depends_on: db healthy`), `n8n-import`
  (one-shot, custom image, mounts `./n8n/{workflows,credentials}` ro), `n8n` (service block
  verbatim from `infrastructure.md`, incl. the SOFT clamav gate), volume `n8n-data`; remove
  nothing yet (worker-app `:520` stays until Phase 6 — parallel-run window). Add
  `N8N_INTERNAL_URL` + `N8N_WEBHOOK_SECRET` to `graphql-api-app` and `storage-app` service env
  now (consumed at Phase 5; harmless earlier).
- Env: add the six `N8N_*` vars to `.env` + `.env.example` (+ `scripts/env-build.ts` docs if it
  enumerates vars); keep `ASSET_SCAN_REAPER_CRON` until Phase 6.
- No nginx change (own host port, locked decision).

### Phase 2 — `db/fnb-n8n` package + grants + sync-status reworks (`_shared.data.md`)
- Scaffold via `/new-db-package` → registers in `DEPLOY_PACKAGES` (both `.env:17` and
  `.env.example:42`); **place `fnb-n8n` after `fnb-app`, keep `fnb-wf` for now** (removed
  Phase 6).
- Changes: `n8n` schema + `workflow_run` + enum + indexes; `n8n_fn`
  (`begin_run/complete_run/error_run/error_run_by_execution/running_count`, SECURITY DEFINER);
  `n8n_api.workflow_runs` (gated `p:app-admin-super`); policies change (RLS per spec: super-admin
  SELECT incl. `tenant_id IS NULL` anchor rows); `n8n_worker` role (idempotent guard, password
  `:'n8n_worker_password'` from env at deploy — mirror how sqitch passwords flow today) + grants
  on `n8n_fn`. Cross-project dep on `fnb-app:00000000010250_app_policies` (jwt helpers/grants
  precedent from the breweries plan).
- Grants changes in owning packages (edit-in-place memory applies; each package's grant surface):
  - `fnb-storage`: new change — `n8n_worker` grants (`resolve_asset_scan`,
    `insert_derived_asset`, `add_asset_tags` per finding 4) + new
    `storage_fn.asset_for_scan(uuid)` + `storage_fn.stuck_pending_assets(stuck_minutes int,
    max_attempts int)` (attempt count via `n8n.workflow_run` per
    `asset-scan.workflow.data.md`; dep on the new `fnb-n8n` change) + `USAGE` on
    `storage`/`storage_fn`.
  - `fnb-location-datasets`: grants (`upsert_breweries`, schema USAGE); rework
    `…10710_location_datasets_fn.sql` `brewery_sync_status` → `n8n_fn.running_count(
    'sync-breweries') > 0`; swap the plan dep `fnb-wf:…_wf` → `fnb-n8n:<new change>` (finding 3).
  - `fnb-airports`: grants (`upsert_*` ×6, `record_sync_source`
    (`…10810_airports_fn.sql:504`), `SELECT` on `airports.sync_source`
    (`…10800_airports.sql:179`), schema USAGE); same `airport_sync_status` rework + dep swap.
  - `fnb-app`: grants — **`app_api.raise_exception`** (finding 1, not `app_fn`).
- PostGraphile: add `n8n, n8n_api` to `schemas` (`apps/graphql-api-app/server/graphile.config.ts:29`).
  **Do not remove `wf, wf_api` yet** (parallel-run window; removal is Phase 6).
- Parallel-window caveat (accepted): once reworked, `brewerySyncStatus`/`airportSyncStatus`
  report n8n runs only — old-engine syncs during Phases 2–5 won't show `in_progress`. Dev-only,
  transient.

### Phase 3 — Workflow-as-code plumbing (`_shared.data.md` conventions)
- Repo dirs `n8n/workflows/`, `n8n/credentials/`; credential templates
  (`fnb-n8n-worker` PG, `fnb-minio` S3, `fnb-webhook-secret` header auth) as `*.json.tpl` with
  `${ENV_VAR}` placeholders.
- `error-handler` workflow JSON (`n8n_fn.error_run_by_execution($execution.id, error)`); every
  later workflow names it as Error Workflow.
- A trivial throwaway workflow to prove the import loop end-to-end.

### ⏸ USER REBUILD GATE 1
Phases 1–3 land together on one rebuild (`n8n_engine` DB + fnb-n8n schema + import job + engine).
**Ask the user to run it.** Then verify read-only per `infrastructure.md` §Verification:
`docker compose ps` (n8n healthy, one-shots exited 0); editor reachable on `N8N_HOST_PORT`
(owner-account setup is the user's, dev-only); `n8n-cli workflow list` shows error-handler +
trivial workflow; wrong secret → 403; `psql` as `n8n_worker` can execute granted fns and cannot
`select from app.profile`. Set up the `n8n-cli` API key with the user for the Phase 4 loop.

### Phase 4 — Convert workflows (per-workflow spec files; old engine still live)
Build in the editor / via `n8n-cli`, then export each to `n8n/workflows/<key>.json` (the
export-to-repo loop) so boot import reproduces it. Order proves plumbing incrementally:
1. **`exerciser`** (`exerciser.workflow.data.md`): webhook → begin_run → validate → Set
   stockQuote → IF throwError → Stop and Error; IF raiseExceptionMessage → PG
   `app_api.raise_exception` (finding 1); resume-URL PG write → Wait (webhook resume) →
   complete_run. Verify all three paths land correctly in `n8n.workflow_run`
   (clean+resume / error via Stop-and-Error / error via DB exception → error-handler).
2. **`sync-breweries`** (`dataset-sync.workflow.data.md`): meta → sequential page loop
   (`per_page=200`) → `location_datasets_fn.upsert_breweries` per page → complete_run; new
   concurrency guard (`running_count > 1` → skip). Verify by curl-triggering the webhook:
   counts stable vs the existing ~11.7k rows, no dupes.
3. **`sync-airports`**: per-file sequential chain (order from the retired
   `airports/sync-airports.ts` — read it for the exact file list/chunk size), etag
   conditional-GET against `airports.sync_source`, Extract From File CSV, chunked upserts,
   `record_sync_source`; verify full run then a second run hits the 304/skip path.
4. **`asset-scan` + `asset-scan-reaper`** (`asset-scan.workflow.data.md`): the diamond
   (clamdscan --stream with node retry 5×30s, verdict IF, clean → S3 promote →
   `resolve_asset_scan` → thumbnail(ffmpeg, continue-on-fail) ∥ ai-tag branches → Merge →
   complete_run; infected/error terminals; /tmp cleanup both paths). Reaper: Schedule Trigger
   (cadence = old `ASSET_SCAN_REAPER_CRON` default `*/15 * * * *`), `stuck_pending_assets`,
   sequential re-POST to own webhook. Verify by curl-POSTing `{assetId, tenantId,
   aiTagsRequested}` for a real quarantined upload (uploads still ride the old engine until
   Phase 5 — use a manually re-fired asset or set one `pending`).

### Phase 5 — App integration (`_shared.data.md`)
- `triggerWorkflow` extendSchema plugin in `apps/graphql-api-app/server/api/` (R7-thin: claims
  401 gate → static allow-map `{ 'sync-breweries': null, 'sync-airports': null, 'exerciser':
  'p:app-admin-super' }` → POST with secret header → `{ accepted: true }`); register it in
  `server/graphile.config.ts` presets (→ `postgraphile-5-expert`). `asset-scan` deliberately
  absent from the map.
- Restart of graphql-api-app needed for the schema change — ask the user; then codegen:
  `packages/graphql-client-api/src/graphql/n8n/mutation/triggerWorkflow.graphql` →
  `pnpm -F @function-bucket/fnb-graphql-client-api generate` → `useTriggerWorkflow` composable
  + **barrel line** (`src/index.ts` — the #1 miss).
- Rewire `useBreweries.ts` (:7, :54, :73) and `useAirports.ts` (:10, :60, :79):
  `useQueueWorkflow` → `useTriggerWorkflow`; public API + pages unchanged (R1). Polling loops
  keep working via the reworked sync-status fns.
- `upload.post.ts`: strip lines ~166–176 (`ensure_asset_scan_wf` + `queue_workflow`) from the
  transaction; after commit, POST `{ assetId, tenantId, aiTagsRequested }` to
  `${N8N_INTERNAL_URL}/webhook/asset-scan`; log-and-swallow failures (reaper owns strays).
- `pnpm build` green. End-to-end verify (read-only; parallel-run window): upload → scan →
  clean promote via n8n; Datasets "Sync now" via `triggerWorkflow` (any authenticated user —
  parity gate); exerciser via GraphiQL as super-admin.

### Phase 6 — Decommission (`decommission.data.md` — the complete inventory; nothing before this
phase touched wf/worker code)
- Delete: `apps/worker-app/` + compose service (`docker-compose.yml:520`) + volume;
  `db/fnb-wf/`; `mutation-hooks/` (after confirming `index.ts` registers only the wf hooks —
  finding 8); `src/graphql/wf/**`; the five wf composables + barrel lines (`index.ts:28–32`) +
  any wf mappers; `fnb-types/src/workflow.ts` + barrel line; workflow pages/components + the six
  app composables (incl. `useWfFlowGraph`); `.claude/specs/graphql-api-app/workflow/`;
  `db/fnb-storage` change `00000000010630_storage_ensure_asset_scan_wf` (deploy/revert/verify +
  plan line 10 — `sqitch-expert` for plan-edit mechanics).
- Edit: `DEPLOY_PACKAGES` drop `fnb-wf` (both files); drop `ASSET_SCAN_REAPER_CRON`;
  `db/fnb-storage/sqitch.plan` drop the `fnb-wf:…_wf_fn` dep from `00000000010630`'s line (gone
  with the deletion) — no other fnb-wf deps remain (finding 3 swapped the other two);
  `db/fnb-app/deploy/00000000010240_app_fn.sql:356` remove the `tenant-site-admin-wf` tool row
  (R14); `db/seed.sql` remove the wf-exerciser (:125+) and sync-breweries (:269+) /
  sync-airports template blocks; `graphile.config.ts:29` remove `wf, wf_api`;
  `apps/graphql-api-app/package.json` remove `graphile-worker`, `@vue-flow/*`, `elkjs` (finding
  5) + prune the `graphile-worker` catalog entry (`pnpm-workspace.yaml:23`); verify
  `auth-server`/`useFnbPgClient` remaining consumers (msg/storage carve-outs) — keep the package.
- Codegen re-run (schema loses wf types); fix fallout. `pnpm build` + `pnpm dep-audit` green.

### ⏸ USER REBUILD GATE 2
Fresh rebuild without `fnb-wf`/worker-app. Then the full post-decommission checklist
(`decommission.data.md` §Verification): repo-wide greps clean (`graphile.worker`,
`graphile_worker`, `wf_api\.`, `wf_fn\.`, `wf\.uow`, `queueWorkflow`, `workflow_handler_key`,
`ensure_asset_scan_wf` — nothing outside `.claude/` history); all five workflows active;
upload → scan → promote end-to-end; "Sync now" works; exerciser error paths land as `error`;
nav shows no Workflow Dashboard; `/graphql-api/workflow` 404s.

### Phase 7 — R21 propagation + wrap-up (`decommission.data.md` §Spec/skill propagation)
- `global-rules.md`: rewrite R22 (n8n is the only workflow engine; fnb→n8n webhook-only; n8n→fnb
  `n8n_worker`-via-`_fn` only); prune R5/R17 worker mentions.
- Pattern files: `monorepo-bootstrap-pattern.md` (headless-apps → n8n topology),
  `graphql-api-pattern.md` + `graphql-api-app/server-pattern.md` (mutation-hooks →
  `triggerWorkflow` plugin), `graphql-api-app/worker-pattern.md` → tombstone,
  `asset-storage/asset-scan-workflow.data.md` → superseded-by pointer (+ README/infrastructure
  worker mentions).
- Skills via `.claude/skills/skill-map.md`: demote `graphile-worker-expert`, route `n8n-cli`,
  rewrite worker/wf references in `fnb-stack-implementor` + `fnb-stack-spec`, update
  `vue-flow-expert`'s UOW note.
- `CLAUDE.md` (apps table, db list, tech stack); `.claude/memory/` sweep for wf-era memories.
- Fold this plan's spec corrections (findings 1–8) into the spec files; flip spec Status lines.
- Ask the user before moving this plan to `addressed/` (completion hand-off).

## Sequencing summary

1. Phases 1–3 (compose/env + sqitch sessions — **no git ever** + repo `n8n/` dir) →
   **user rebuild 1** → infra verification + n8n-cli setup.
2. Phase 4 workflow-by-workflow on the live editor (exerciser → breweries → airports →
   asset-scan/reaper), exporting JSON to the repo as each verifies.
3. Phase 5 app integration (graphql-api-app restart → codegen → rewires) → parallel-run
   end-to-end verify.
4. Phase 6 decommission → **user rebuild 2** → full checklist → Phase 7 propagation → sign-off.
5. User touchpoints: two rebuilds, one graphql-api-app restart, editor owner-account setup +
   n8n-cli API key, final sign-off.

## Out of scope / linked (spec README deferrals)

- Admin "runs panel" over `n8n_api.workflow_runs` — revisit post-migration.
- Scheduled nightly dataset syncs — product call, trivially possible later.
- Production posture (queue mode, webhook worker split, editor SSO) — no deployed env yet.
- `0030__wf________wf-rls-missing__________________CRT__.plan.md` — the wf RLS/permissions issue
  is **mooted for the wf module** (it retires) but re-check that plan at Phase 7: its residue
  (`queueWorkflow` gating) is replaced by the `triggerWorkflow` allow-map; annotate or retire
  0030 with the user's sign-off.
