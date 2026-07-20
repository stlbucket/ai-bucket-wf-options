# Plan: Game server — event-sourced multi-game platform + battleship (game-layer/game-app, n8n referee, replay scrubber)

> **Execution Directive:** Implement this plan via `/fnb-stack-implementor <this-file>`.
> The authoritative spec is `.claude/specs/game-server/` (README + `_shared.data.md` +
> `infrastructure.md` + `game-event.workflow.data.md` + `battleship-*` + `coming-soon.*`) —
> this plan sequences it and records planning findings; it does not restate the spec (R21).
> Specialist skills: `new-db-package` (Phase 1 scaffold), `sqitch-expert` (all DB work),
> `fnb-db-designer` (RLS/grants dialect), `postgraphile-5-expert` (exposure + smart tags),
> `fnb-create-app` (Phase 2 game-app, WS variant), `n8n-cli` (Phase 3 workflow build/export).
> Never run `git` in a sqitch session; never rebuild/restart the env yourself — ask the user,
> then verify read-only.

**Severity: MED** (feature work) · Workstream: games · Planned: 2026-07-19
· Spec status: Draft, decisions locked 2026-07-19 (N-seat + game_type registry + event-sourced
model + v1 replay scrubber), no `[FILL IN]`s.

## Context

A generic, game-type-agnostic, **event-sourced** game platform (spec README Purpose): every
state change is a `game.game_event` row with a dense `event_number` + a per-event deny-all
snapshot (`game.game_event_state`) — replayable forward/backward as a rule; `expecting_seats
int[]` awaits events from 1..n seats; per-seat `game_player.outcome`. New `db/fnb-game`
package, `packages/game-engines` (canonical engine + embed script), `packages/game-layer` +
`apps/game-app` (msg-layer/msg-app WS mirror, nginx `/game`), the `game-event` n8n referee
workflow (registry key `engine: 'n8n'`, `p:app-user`), and tenant-app pages (battleship
list/detail **with the v1 replay scrubber**, two Coming Soon pages). Machine seats: algorithm
(embedded selector) or agent (Anthropic Messages API from n8n, `claude-haiku-4-5-20251001`,
existing `ANTHROPIC_API_KEY`).

## Prerequisite — engine source (RESOLVED at go/no-go, 2026-07-19)

Spec locked decision said "the user-supplied `battleship.ts` … used verbatim," but no such
file exists in the tree (grep for `createInitialGameState`/`applyMove` = zero hits outside
the spec). **User decision at go/no-go: write the engine fresh in Phase 2** —
`packages/game-engines/src/battleship/engine.ts` authored to the spec's documented contract
(single-board `createInitialGameState()` + `applyMove()`, `PlacedShip.hits: Set<string>`,
board `status: 'won'` when all ships sunk), vitest-covered. The spec README's "engine
verbatim" wording is amended accordingly (done alongside this plan).

## Planning findings (verified 2026-07-19)

1. **`.env:17` already lists `fnb-game`** at the end of `DEPLOY_PACKAGES`; **`.env.example:43`
   does not** — Phase 1 edits only `.env.example` (and confirms `new-db-package` doesn't
   double-append to `.env`).
2. Registry anchor: `apps/graphql-api-app/server/graphile/trigger-workflow.plugin.ts:18`
   (`WORKFLOW_REGISTRY: Record<string, { engine, permission: string | null }>`) — the spec's
   `'game-event': { engine: 'n8n', permission: 'p:app-user' }` fits the existing shape.
3. n8n run-log fns verified: `n8n_fn.begin_run` / `complete_run` / `error_run_by_execution` at
   `db/fnb-n8n/deploy/00000000011210_n8n_fn.sql:13/36/94`. n8n compose trio exists
   (image pinned `2.30.7`; `n8n-import` service at `docker-compose.yml:626`);
   `ANTHROPIC_API_KEY` is already env-plumbed for agent-app (`docker-compose.yml:562`) — add
   it to `n8n-import` only, per `infrastructure.md` §4. Existing credential templates + 
   `n8n/scripts/render-credentials.mjs` confirmed.
4. Nav anchor: mirror the `datasets` module block at
   `db/fnb-app/deploy/00000000010240_app_fn.sql:385` (games module + 3 tools, spec
   `_shared.data.md` §Navigation; icons verified in the spec).
5. WS mirror anchors: `packages/msg-layer/server/routes/_ws/topics/[id]/messages.ts`,
   `server/utils/getWsUpgradeClaims.ts`, `nitro.experimental.websocket: true`
   (`packages/msg-layer/nuxt.config.ts:7`), the pg-notify-bridge `websocket.resolve` override
   note (package-layers-pattern §msg-layer) — game-layer must carry the same fix.
6. **R24/catalog**: `esbuild` (embed script) and any other new external deps of
   `game-engines` are not in the pnpm catalog yet — add catalog entries first, declare
   `"catalog:"`. `@urql/vue`, `vitest`, `typescript` already catalogued.
7. `db/fnb-game` does not exist; no game code anywhere — greenfield, no reconciliation needed.

## Implementation phases

Follows the spec README task list. **`pnpm build` is the gate** (repo lint is broken).
Read the spec files for every contract — SQL shapes, the `record_referee_result` actions
contract, view shapes, and UI layouts are all specified there.

### Phase 1 — DB: `db/fnb-game` (skills: `new-db-package`, `sqitch-expert`, `fnb-db-designer`)
Per `_shared.data.md`: enums; `game.game_type` registry (+3 seed rows, battleship `live`);
`game.game` (registered URN table; `seat_count`, `expecting_seats int[]`, `event_count`,
`game_type_id citext` FK); `game.game_player` roster (`player_kind`, `outcome`,
`resigned_at`, one-seat-per-resident partial unique); `game.game_event` log (dense
`event_number` unique per game, **one-pending-per-seat partial unique index**, pending-
visibility RLS policy); deny-all `game.game_event_state` (per-event snapshots — RLS zero
policies + revoke); `pg_notify('game:{id}:state', …)` update trigger; `game_fn`
(`engine_context`, `record_referee_result` with **`pg_advisory_xact_lock` + still-pending
re-checks**, `player_view(game, resident, event# DEFAULT NULL)`, invoker helpers incl.
resign-as-event) + `game_api` (`create_game(_game_type_id, _players jsonb)`, `submit_event`,
`resign_game`, `my_games`, `game_view(_game_id, _event_number DEFAULT NULL)`) with
`jwt.enforce_any_permission('{p:app-user,p:app-admin}')` gates; error codes 30000–30005 per
spec; `n8n_worker` grants (exactly 2 EXECUTEs); `res.module_permission` `game` row; sqitch
deps on `fnb-res` + `fnb-app` policies + `fnb-n8n` role change (spec §package intro).
Also in this sqitch window: `.env.example` `DEPLOY_PACKAGES` += `fnb-game`; the `games` nav
module + 3 tool rows in `00000000010240_app_fn.sql` (finding 4); PostGraphile
`pgServices.schemas` += `game, game_api` + the smart-tag block
(`game_event_state` `-*`; list/connection drops; `game_type` keeps root list) in
`postgraphile.tags.json5`.

### Phase 2 — Infrastructure (skills: `fnb-create-app`; spec `infrastructure.md`)
- **`packages/game-engines`** (⛔ needs the user's `battleship.ts`): engine verbatim +
  `serialize.ts` (Set⇄string[]) + `views.ts` (redaction) + `battleship/referee.ts` +
  `select-move.ts` (full source in `game-event.workflow.data.md`) + top-level dispatcher →
  the **actions-list contract**; vitest (`src/tests/*.spec.ts`, own `vitest.config.ts` — house
  testing convention) covering adapters, validation/rejection, expectation + outcomes,
  redaction (no ship leaks), selector legality, **and the bundle-hash drift alarm**;
  `scripts/embed.ts` → rewrites `jsCode` of nodes `referee` + `parse-agent-move` in
  `n8n/workflows/game-event.json`. New deps via catalog (finding 6).
- **`packages/game-layer`**: msg-layer mirror (WS route `_ws/games/[id]`, upgrade auth via
  `getWsUpgradeClaims` pattern, pg-notify bridge **including the `websocket.resolve`
  override fix**, `nitro.experimental.websocket: true`); R24 self-preparable (own tsconfig +
  `nuxt prepare`, explicit `h3` imports, `"@nuxt/ui": "catalog:"`).
- **`apps/game-app`** via `fnb-create-app` (WS variant): extends game-layer,
  `NUXT_APP_BASE_URL=/game`, no user pages; compose service + `node_modules_game_app`
  volumes + pnpm-install volume + nginx `location /game` **before** `location /` + pinger +
  `depends_on`.
- **n8n credential**: `n8n/credentials/anthropic-api-key.json.tpl` (spec §4 verbatim);
  `ANTHROPIC_API_KEY` into the `n8n-import` service env (finding 3).

### ⏸ USER REBUILD GATE
Phases 1–2 land on one rebuild — **ask the user to run it**, then verify read-only per
`infrastructure.md` §Verification (schema incl. `game_type` seeds + event tables; deny-all +
pending-visibility negatives; `n8n_worker` grant boundary; nav; WS 401/101; credential
imported; GraphQL surface incl. `GameType` object type + `gameView(gameId, eventNumber)`).

### Phase 3 — n8n workflow + registry (skill: `n8n-cli`; spec `game-event.workflow.data.md`)
Build `game-event` (webhook `game-event`, respond-immediately, `fnb-webhook-secret` header
auth): begin_run → `engine_context` → Code `referee` (embedded) → IF `needsAgentMove` →
HTTP `anthropic-move` (haiku, redacted `agentContext` only) → Code `parse-agent-move`
(embedded; algorithm fallback) → `record_referee_result` → `complete_run`; error workflow =
the shared active `error-handler`. Run the embed script; export **active** to
`n8n/workflows/game-event.json`. Add `'game-event': { engine: 'n8n', permission:
'p:app-user' }` to `WORKFLOW_REGISTRY` (finding 2). Verify the 10-step checklist in the
workflow spec (setup event 1 / PvP event / algorithm + agent replies + fallback / rejection /
**concurrent double-fire noop** / error path / resign / **replay walk fwd+back** /
pending-visibility) via psql + the n8n editor.

### Phase 4 — Client + pages (spec `_shared.data.md` §Client, `battleship-*`, `coming-soon.*`)
- `fnb-types`: `game.ts` (`GameTypeId/GameTypeStatus/GameTypeInfo`, `PlayerKind`,
  `GameEventType/GameEventStatus`, `SeatOutcome`, `GamePlayer`, `NewGamePlayer`,
  `GameSummary` with `expectingSeats`/`eventCount`/`players`, `GameEvent`) +
  `games/battleship-view.ts` + barrel lines.
- graphql-client-api: documents (`myGames`, `gameById` incl. `gamePlayers`+`gameEvents`+live
  `gameView`, `gameViewAt`, `gameTypes`, `createGame`, `submitEvent`, `resignGame`) —
  **verify inflected names in GraphiQL first**; codegen; mappers (`toGameSummary`,
  `toGameEvent`, `toGameTypeInfo`); composables `useGames` (list + create + setup trigger),
  `useGame` (hybrid WS + submit/resign + **replay scrubber state** + stuck-lobby setup
  re-fire + view-diff toasts), `useGameTypes`; **barrel lines** (the #1 miss) + tenant-app
  thin re-exports.
- Pages/components (Nuxt UI **v4**, UC13 `TableColumn`/`row.original`; UC4/5/6/7/8/11/12):
  `games/battleship/index.vue` (+ New Game modal, machine options gated by
  `supportedPlayerKinds`), `games/battleship/[id].vue` (turn banner from `isExpectingMe`,
  outcome banner from `myOutcome`, **replay scrubber row**, `BattleshipBoard.vue` own/target
  modes), `GamesComingSoon.vue` + the two static pages. `pnpm build` green.

### Phase 5 — E2E + propagation (read-only; user runs any restart)
Full browser pass per README Phase 5: create PvP + both machine modes, live two-client
update, resign, **replay scrubber forward/backward on a finished game**, Coming Soon pages,
nav gating. Then R21 propagation: CLAUDE.md (apps/layer/db lists), `package-layers-pattern.md`
(game-layer + game-engines), `monorepo-bootstrap-pattern.md` (game-app service),
`graphql-api-pattern.md`/`fnb-stack-implementor` schema lists (`game, game_api`),
`skill-map.md` if any skill inventories apps; fold in-flight corrections back into the spec
files; ask the user before moving this plan to `addressed/`.

## Sequencing summary

1. Get `battleship.ts` from the user (blocks Phase 2's engine package; Phase 1 can start
   immediately) → Phases 1–2 (sqitch sessions — no `git`) → **user rebuild** → read-only
   verify → Phase 3 (needs live DB + n8n) → Phase 4 (codegen needs the live schema; UI
   hot-reloads via packages-watch) → Phase 5 → spec reconcile + sign-off.
2. User touchpoints: supply the engine file, the rebuild, and Phase 5 sign-off.

## Out of scope / linked (spec README Open Questions — all deferred by user decision)

Invitation/turn notifications, turn clock, agent cost ceiling, snapshot retention/compaction,
engine-version policy for in-flight games, N-player agent-seat n8n loop, lobby/join flow,
registry admin UI, `gameTypeList`-driven Coming Soon pages, stats/leaderboards, list
pagination (no house convention), spectating, **interactive browser E2E** (this session's
browser tool could not reach the docker-compose stack).

---

## Execution record (2026-07-20 — all phases complete, `pnpm build` green)

**Battleship engine decision**: no `battleship.ts` was ever supplied. At go/no-go the user
chose "write it fresh" — `packages/game-engines/src/battleship/engine.ts` was authored to the
spec's documented contract (`createInitialGameState`/`applyMove`, `PlacedShip.hits:
Set<string>`, board `status: 'won'`), vitest-covered (32 unit tests). Spec README amended.

**Phase 1 (DB)**: `db/fnb-game` built exactly per plan — `game_type` registry (+3 seeds),
`game`/`game_player`/`game_event`/`game_event_state`, `game_fn`/`game_api`, RLS, `n8n_worker`
grants, nav rows, PostGraphile exposure + smart tags. Note: house style uses `CREATE OR
REPLACE FUNCTION` throughout — the initial pass used plain `CREATE FUNCTION`; corrected during
Phase 3 fixes (see below) for consistency and so live SQL patches apply cleanly.

**Phase 2 (Infra)**: `game-engines`, `game-layer` (msg-layer mirror, incl. the
`websocket.resolve` fix), `game-app` (via manual scaffold matching `fnb-create-app`'s
template), compose/nginx/credential wiring — all landed. `esbuild` added to the pnpm catalog.

**Rebuild gate**: user rebuilt; full read-only verification per `infrastructure.md`
§Verification passed (schema, deny-all negatives, `n8n_worker` grant boundary, nav, WS
401, credential imported, GraphQL surface).

**Phase 3 (n8n workflow)** — **two real defects found and fixed by live verification, not
by inspection**:
1. **Concurrency bug**: a 3-way concurrent-trigger test against one pending move showed TWO
   machine replies landing for one human move (the referee's advisory lock only serializes
   the *write*; it did nothing to stop two racing executions from each independently
   computing and inserting their own `machine`/`system` event from a stale `engine_context`
   read taken *before* either lock). Fixed with an `expectedEventCount` optimistic-concurrency
   stamp: the referee records the `event_count` it read; `record_referee_result` discards the
   entire result as a stale noop if that no longer matches under the lock. Re-verified: 3
   concurrent triggers → exactly one apply + one machine reply, two clean `stale_context`
   noops.
2. **Security bug**: the `setup` event's `event_data` held the full unredacted state (both
   players' ship positions) — and `game.game_event` is tenant-readable once applied (by
   design; only *pending* rows are seat-gated). Any tenant member could have read both fleets
   straight out of the event log, defeating the entire deny-all `game_event_state` design.
   Fixed: `setup`'s `event_data` is now `{ gameType, boardSize }` only; the fleet layout lives
   solely in `stateAfter` (deny-all). Re-verified live — no ship data reachable outside
   `game_fn.player_view`. Both fixes are folded into `_shared.data.md` and
   `game-event.workflow.data.md` as the documented rule, not a footnote.

Also verified live: setup, PvP moves, algorithm reply (same-execution), agent reply (real
Anthropic call, model behaved — fallback path covered by vitest instead), rejection
(`already_fired`), resign (outcomes + `finished_at`), replay walk forward+backward on a
resigned game, error path (nonsense `gameId` → terminal error run row).

**Phase 4 (Client)**: fnb-types, `.graphql` documents (inflected names verified in GraphiQL
first — PostGraphile kept the leading underscore on SQL param names, e.g. `_gameTypeId`),
codegen, mappers, `useGameTypes`/`useGames`/`useGame` composables, barrel, tenant-app
re-exports, `BattleshipBoard.vue`/`GamesComingSoon.vue`, all four pages incl. the replay
scrubber. Two small type fixes during `nuxt typecheck` (UTable `@select` signature, a
null-vs-undefined `USelectMenu` v-model) — both pre-existing-pattern issues in my own new
code, not systemic.

**Phase 5 (E2E + propagation)** — two more real gaps found here:
1. **Missing `routeRules`**: every other tenant-app data section (`/msg`, `/loc`, `/tools`,
   `/datasets`, …) has a `routeRules: { ssr: false }` entry because tenant-app's urql plugin
   is client-only (`urql.client.ts`). The plan/spec never called this out for `/games/**` —
   every game page 500'd on first SSR request (`No urql Client was provided`) until it was
   added. Now documented in `infrastructure.md` §5 as a required step, not optional.
2. **Dev-server page-discovery gap**: after Phase 4 landed, all four new page routes 404'd
   server-side even though the client-side route table (HMR) picked them up — a Docker-for-Mac
   file-watcher gap where brand-new nested page *directories* don't reliably trigger Nitro's
   page-manifest rebuild. A `tenant-app` service restart fixed it. Documented in
   `infrastructure.md` as a dev-server gotcha for future phases.
3. **Interactive browser E2E was not completed** — the session's browser automation tool
   could not reach this host's Docker network (crashed once, then connection-refused on every
   retry). Everything reachable without a browser passed: HTTP-level route checks (all four
   pages 200 after the two fixes above), full DB/RLS/grant verification, and the referee's
   complete behavior matrix under real concurrency (Phase 3). Recorded as an open question in
   the spec README — do the click-through pass when a working browser tool is available.

R21 propagation done: `CLAUDE.md` (apps/packages/db lists — also fixed a pre-existing
`fnb-n8n` omission from the db list while touching the same line), `package-layers-pattern.md`
(new `game-layer` section + `game-engines` callout; also corrected a stale `worker-app`
reference in the same paragraph being edited), `monorepo-bootstrap-pattern.md` (nginx
template + depends_on), `graphql-api-pattern.md` + `fnb-stack-implementor` skill (schema
lists — also added the pre-existing-but-missing `n8n, n8n_api` entries), `fnb-stack-spec`
skill (Implemented Modules table). `skill-map.md` needed no change (it doesn't inventory
apps/packages).
