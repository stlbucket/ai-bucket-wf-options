# Plan: n8n dataset-sync twins — `n8n-sync-breweries` + `n8n-sync-airports` parallel workflows

> **Execution Directive:** Implement this plan via `/fnb-stack-implementor <this-file>`.
> The authoritative spec is `.claude/specs/n8n-parallel-engine/dataset-sync.workflow.data.md`
> (+ the README's extension Phases 7–8 and the *(draft)*-marked blocks in `_shared.data.md`) —
> this plan sequences it; it does not restate the spec (R21). Specialist skills:
> `sqitch-expert` (cross-package deps, edit-in-place), `n8n-cli` (Phase B operator loop),
> `breweries-expert` / `airports-expert` (source mechanics), `fnb-db-designer` (grant review).
> **Never run any `git` command** (user global rule). **Never rebuild/restart the env
> yourself** — ask the user, then verify read-only.

**Severity: MED** (additive feature work) · Workstream: wf · Planned: 2026-07-19
· Spec status: Draft, decisions locked 2026-07-19 (user choices: **parallel new keys**, not an
engine move; **manual trigger only**), no `[FILL IN]`s, no blocking open questions.

## Context

Two n8n twins of the live agentic dataset syncs, under their **own keys** — the agentic
`sync-breweries` / `sync-airports` (and everything in `apps/agent-app`) are **untouched**.
Registry entries gated `p:app-admin-super` (the datasets UI keeps triggering the agentic keys).
Each twin opens with a **cross-engine dataset guard** (`agent_fn.running_count + n8n_fn.running_count`
before `begin_run` — no run row when either engine is busy). The one shared surface: both
sync-status fns' `in_progress` becomes a dual-engine OR (GraphQL shape unchanged — **no codegen,
no composable, no mapper work anywhere in this plan**). n8n reaches the upsert fns as
`n8n_worker` via grants in the **owning packages** (deploy order already puts `fnb-n8n` before
`fnb-location-datasets`/`fnb-airports`).

## Verified code anchors (2026-07-19)

1. **Registry**: `apps/graphql-api-app/server/graphile/trigger-workflow.plugin.ts:18–23` —
   `WORKFLOW_REGISTRY`; append the two `{ engine: 'n8n', permission: 'p:app-admin-super' }`
   entries (spec → Trigger surface). GraphQL shape unchanged.
2. **fnb-n8n guard helper** *(corrected at execution — spec §Status)*: no `agent_fn` grant to
   `n8n_worker` (no `revoke from public` exists anywhere, so schema USAGE is the only `_fn`
   gate — issue `0020__security__fn-schema-grant-bypass`); instead
   `n8n_fn.dataset_sync_busy(citext, citext)` added to
   `db/fnb-n8n/deploy/00000000011210_n8n_fn.sql` (+ verify line), and that change's
   `sqitch.plan:5` deps gain `fnb-agent:00000000011110_agent_fn`
   (`agent_fn.running_count` signature verified at
   `db/fnb-agent/deploy/00000000011110_agent_fn.sql:138`).
3. **Breweries**: `db/fnb-location-datasets/deploy/00000000010710_location_datasets_fn.sql:181`
   (`in_progress := agent_fn.running_count('sync-breweries') > 0` → dual-engine OR with
   `n8n_fn.running_count('n8n-sync-breweries')`); `:187–192` `agent_worker` grants block —
   append the mirrored `n8n_worker` block (usage ×2 + `upsert_breweries(jsonb)`).
   `sqitch.plan:5` deps gain `fnb-n8n:00000000011230_n8n_policies`.
4. **Airports**: `db/fnb-airports/deploy/00000000010810_airports_fn.sql:549` (`in_progress` →
   dual-engine OR with `n8n_fn.running_count('n8n-sync-airports')`); `:555–567` grants block —
   mirror all nine lines for `n8n_worker` (usage ×2, six upserts,
   `record_sync_source(citext,text,text,int)`, `select on airports.sync_source`).
   `sqitch.plan:5` deps gain `fnb-n8n:00000000011230_n8n_policies`.
5. **n8n_fn coverage**: `00000000011230_n8n_policies.sql:43–44` grants EXECUTE on **all**
   `n8n_fn.*` (+ default privileges) to `n8n_worker` — `begin_run`/`complete_run`/
   `running_count` need no new grants.
6. **UI**: `apps/tenant-app/app/pages/site-admin/wf-n8n/index.vue:15` —
   `const triggerableKeys = ['n8n-exerciser']` → add the two new keys. No other client change.
7. **Workflow-as-code loop**: `n8n/workflows/{error-handler,n8n-exerciser}.json` are the
   node precedents (header-auth `fnb-webhook-secret` credential, `fnb-n8n-worker` PG
   credential, params as ONE `options.queryReplacement` array expression, `"active": true` in
   the export; the `n8n-import` one-shot publishes by id). Build corrections live in
   `exerciser.workflow.data.md` §Status + the spec README §Status.
8. **Sources**: Open Brewery DB meta/page endpoints (`breweries-expert`), OurAirports CSV URLs +
   header quirks (`airports-expert`); the coercion maps to replicate in the airports Code node
   are `apps/agent-app/server/lib/agent-tools/airports.ts:35–142` (read-only reference).

## Implementation phases

**`pnpm build` is the gate** (repo lint broken). No new npm dependencies, no codegen.

### Phase A — DB grants + sync-status rework + registry + UI list

1. `db/fnb-n8n` policies change (edit-in-place, memory `feedback_sqitch_edit_in_place`):
   `agent_fn` usage + `running_count` grant; sqitch dep (anchor 2) — via `sqitch-expert`.
2. `db/fnb-location-datasets` fn change: `n8n_worker` grants + `brewery_sync_status` OR;
   sqitch dep (anchor 3). True-up the change's verify file if it enumerates grants/fn behavior.
3. `db/fnb-airports` fn change: `n8n_worker` grants + `airport_sync_status` OR; sqitch dep
   (anchor 4). Same verify-file true-up check.
4. `trigger-workflow.plugin.ts`: the two registry entries (anchor 1).
5. `wf-n8n/index.vue`: `triggerableKeys` + `selectedKey` default unchanged (anchor 6).
6. `pnpm build` green.

### ⏸ USER REBUILD GATE
Ask the user for one rebuild (sqitch redeploy + graphql-api-app/tenant-app restart). Then
verify read-only:
- psql as `n8n_worker`: can `select agent_fn.running_count('sync-breweries')`, execute
  `location_datasets_fn.upsert_breweries('[]')` and the airports upserts, `select` from
  `airports.sync_source`; **cannot** `select from location_datasets.brewery` or
  `airports.airport`.
- GraphiQL: `brewerySyncStatus`/`airportSyncStatus` still resolve (shape unchanged).
- wf-n8n page: the select lists three keys; triggering a twin now 200s but 404s in n8n
  (workflow not yet built) — expected until Phase B.

### Phase B — build + export the two workflows (`n8n-cli` / editor)

1. `n8n-sync-breweries` per the spec node graph: webhook (header auth, respond immediately) →
   cross-engine guard → `begin_run` → meta → sequential page loop (Loop Over Items batch 1,
   HTTP retryOnFail 3×/10s, PG upsert per page) → sum → `complete_run`; Error Workflow →
   `error-handler`.
2. `n8n-sync-airports` per the spec node graph: guard → `begin_run` → six-file loop in
   dependency order (etag read → conditional GET, 304 → skipped → Extract From File CSV →
   coercion-map Code node (anchor 8) → 1000-row chunks → Switch → six **static** PG upsert
   nodes → `record_sync_source`) with parent-stop/child-continue error routing → per-file map
   → `complete_run`; Error Workflow → `error-handler`.
3. Export both **active** to `n8n/workflows/n8n-sync-{breweries,airports}.json`.
4. Run the spec's six verification steps (`dataset-sync.workflow.data.md` §Verification):
   clean runs with sane counts, airports second-run all-`skipped` (etag), guard no-row while
   the other engine runs, datasets-page `in_progress` during an n8n run, kill-path →
   error-handler → terminal `error` row, and boot-import reproduction (**needs one more user
   rebuild** — fold into final sign-off).
5. Spec propagation: README extension phases checked + Status lines → Implemented;
   `_shared.data.md` *(draft)* markers cleared; `wf-n8n.ui.md` status note. No global-rules /
   pattern-file change (R22 already describes dual engines and the registry — inventory lists
   in R22/skill prose gain the two keys only if they enumerate n8n inventory).

## Sequencing summary

1. Phase A (SQL edits + plugin + one-line UI — **no git ever**) → `pnpm build` → **user
   rebuild** → grant/negative-path verification.
2. Phase B workflows on the live editor via `n8n-cli`, exported to the repo as each verifies →
   final boot-import rebuild check with the user → sign-off.
User touchpoints: two rebuilds (post-Phase-A; final boot-import proof), n8n editor/API access
for the build loop, final sign-off.

## Out of scope / linked

- Moving the agentic syncs or `asset-scan` to n8n (README open question — asset-scan would
  resurrect the superseded custom image).
- Schedule Trigger / nightly syncs (user decision: manual only).
- Datasets-page UI changes (Sync buttons keep the agentic keys); per-run detail pages;
  pagination.
- `tenant-app/datasets/*` spec staleness (`in_progress` still described in retired wf-era
  vocabulary) — pre-existing; a separate Mode-4 cleanup item if wanted.
