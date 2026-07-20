> **Execution Directive:** plan + build this spec via `/fnb-stack-implementor <this-README>` —
> the implementor derives the `.claude/issues/` plan file (R23) from the task list below,
> then executes it.

# Game Server — generic multi-game engine + battleship

## Status
Draft — decisions locked 2026-07-19; no `[FILL IN]` markers remain. Ready for implementation.

## Purpose

A generic, game-type-agnostic game platform: the DB stores one record per game with jsonb
state; a new **`game-layer` + `game-app`** pair (mirroring msg-layer/msg-app) pushes real-time
state updates to each player over WebSockets; and an **n8n workflow (`game-move`) referees all
gameplay** — every move (human or machine) is validated and applied by the engine running in an
n8n Code node, written back via the `n8n_worker` role, with `pg_notify` driving the live UI.

Games are tenant-scoped and either **PvP** (two residents of the tenant) or **vs the machine**,
where the machine is either an **algorithm** (deterministic move-selection script in a Code
node) or an **agent** (Anthropic Messages API call from n8n, using the same `ANTHROPIC_API_KEY`
as the agentic engine).

A new **Games** menu section (DB-registered module, R14) carries one tool per game type.
**Only battleship is implemented** (list + detail); Tic-Tac-Toe and Checkers are Coming Soon
pages. The battleship engine is the user-supplied `battleship.ts` (single-board,
`createInitialGameState` + `applyMove`), used verbatim per seat inside a two-board wrapper.

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| PvP battleship model | **Classic two-board**: each seat owns a hidden fleet (one engine board per seat); seats alternate firing at the opponent's board; first to sink all opponent ships wins | User decision 2026-07-19. Standard battleship; the same `{ seats: { 1, 2 } }` wrapper serves vs-machine unchanged (machine holds seat 2) |
| Turn rule | Strict alternation — a hit does **not** grant an extra shot | Simplest classic variant; the "shoot-again-on-hit" house rule rejected to keep the referee's turn logic trivial |
| Move authority | **n8n referees all moves**: players submit raw moves via GraphQL (`game_api.submit_move` inserts a `pending` row); the `game-move` workflow validates + applies every move in a Code node and writes state via `n8n_worker` | User decision 2026-07-19. Matches "n8n manages the gameplay"; client is never trusted with the engine |
| n8n loop shape | **One execution per move** (webhook per submitted move; `op: 'setup'` initializes). Strict alternation means at most one machine reply per human move, so the "loop until completion" is the per-move trigger stream + the in-execution machine reply | User decision 2026-07-19. Durable, respond-immediately, no signed Wait-node resume URLs in the DB |
| DB game-type agnosticism | `game.game` has no battleship columns — state is jsonb; `game_type` is an enum the referee dispatches on | User requirement. Tic-tac-toe/checkers add an enum value + engine module, zero DDL |
| Secret state placement | Authoritative `game_state` + per-seat `player_views` live in a separate **deny-all** table `game.game_engine_state` (RLS enabled, zero policies, explicit revoke — `auth.session` precedent); only SECURITY DEFINER `game_fn.*` touch it | Ship positions must be invisible to players. Column-level carve-outs on a broadly-granted table don't work in PG (table-level SELECT wins); a deny-all side table is the house pattern |
| Per-seat redaction | The **engine computes `player_views`** (own fleet fully visible; opponent board redacted to hit/miss/sunk) on every write; players read only their seat's view via `game_api.game_view` → definer `game_fn.player_view` | Keeps the DB agnostic — redaction is game logic, so it lives in the engine, not SQL |
| Machine fairness | The machine (algorithm **and** agent) selects moves from the machine seat's **redacted view only** — never from `game_state` | The agent prompt must not leak the human fleet; algorithm uses the same information |
| Server topology | New **`packages/game-layer`** (extends tenant-layer; WS route + pg-notify bridge) + **`apps/game-app`** (extends game-layer, nginx `/game`) — mirror of msg-layer/msg-app | User requirement ("similarly to the msg server"); tenant-app pages connect cross-app to `/game/_ws/...` exactly as they do to `/msg/_ws/...` |
| Real-time refresh path | On WS notify, the composable re-executes the GraphQL detail query (`network-only`) — **no REST/`withClaims` carve-out** | Deviation from msg (which fetches incremental single messages): game updates are whole-state, and the query already exists. R5 default path preferred over a new carve-out |
| Engine source of truth | New **`packages/game-engines`** (pure TS, vitest-covered, no runtime app consumers): battleship engine verbatim + JSON serialization adapters + wrapper/referee + machine-move selector; an **embed script** injects the built JS into the `game-move.json` Code nodes | n8n Code nodes can't import repo packages; a tested canonical source + mechanical embed beats hand-synced inline JS (the drift hazard) |
| Engine JSON adaptation | `PlacedShip.hits: Set<string>` dehydrates to `string[]` for jsonb persistence; hydrate/dehydrate helpers wrap the engine — engine internals unmodified | jsonb can't hold a `Set`; the supplied engine is otherwise used as-is |
| Move write shape | ONE granted write fn: `game_fn.record_referee_result(game_id, result jsonb)` applies the whole referee output atomically (initialize / apply+reject / machine move insert+apply) | Collapses per-step Postgres nodes; atomicity; smallest possible `n8n_worker` grant inventory (2 fns) |
| Agent model + fallback | HTTP Request → Anthropic Messages API, `claude-haiku-4-5-20251001`, `x-api-key` header credential rendered from the existing `ANTHROPIC_API_KEY`; on unparseable/illegal agent output, **fall back to the algorithm move** | User requirement (n8n + agentic-engine credentials). Haiku is ample for move selection; the fallback keeps games unstuck |
| Trigger path | One registry key **`game-move`** (`engine: 'n8n'`, `permission: 'p:app-user'`) in the `triggerWorkflow` plugin; input `{ op: 'setup' \| 'move', gameId }`; composables call the existing `triggerWorkflow` mutation after `create_game`/`submit_move` | R22 house plumbing; rogue triggers are harmless (referee no-ops without a pending move) |
| PvP invitation | **None in v1** — creating a PvP game immediately seats the chosen opponent; the game appears in their list | Smallest viable PvP; accept/decline ceremony deferred |
| Tenancy | Games are tenant-scoped: `tenant_id` + both players are residents of the same tenant (URN FKs into `res.resource`) | House model; cross-tenant play deferred with everything else multi-tenant |
| Permissions | Module + tools gated `p:app-user`/`p:app-admin` (todo/locations precedent); no new permission key. RLS SELECT is tenant-scoped (msg precedent); mutations enforce seat membership in `_api`/`_fn` | No new license machinery for v1 |
| URN registration | `game.game` is a registered business table (generated `urn`, deferred FK, `register_resource` in the create path, `game` module row); `game.game_move` and `game.game_engine_state` are unregistered children | urn-registry forward-only convention for new business tables |
| Nav | New module `games` (`i-lucide-gamepad-2`) with tools Battleship (`i-lucide-ship`, live), Tic-Tac-Toe (`i-lucide-hash`), Checkers (`i-lucide-circle-dot`) — the latter two route to Coming Soon pages | R14; all four icons verified in lucide |
| Scope of playable games | Battleship only: list + detail. Coming Soon pages for the other two tools share one `GamesComingSoon` component | User requirement |
| List page freshness | The battleship list is fetch-on-load + manual refresh — **not** real-time; only the detail page holds a WS | One WS per open game matches the msg model; list-level LISTEN deferred |

## Files in this spec

| File | Contents |
|---|---|
| `README.md` | This index: decisions, task list, open questions |
| `_shared.data.md` | The `db/fnb-game` package (schemas, tables, deny-all engine state, `_fn`/`_api`, RLS, triggers, `n8n_worker` grants), state-shape contracts, PostGraphile exposure, engine registry entry, fnb-types, composables, WS architecture, security model |
| `infrastructure.md` | `packages/game-layer`, `apps/game-app` (compose + nginx), `packages/game-engines` (+ embed script), the n8n Anthropic credential template, env changes |
| `game-move.workflow.data.md` | The `game-move` n8n workflow: node graph, referee Code-node contract, the machine move-selection script (full source), the agent (Anthropic) branch, error handling + recovery |
| `battleship-index.ui.md` / `battleship-index.data.md` | `/tenant/games/battleship` — list + New Game modal |
| `battleship-[id].ui.md` / `battleship-[id].data.md` | `/tenant/games/battleship/[id]` — live two-board detail page |
| `coming-soon.ui.md` / `coming-soon.data.md` | `/tenant/games/tic-tac-toe` + `/tenant/games/checkers` — shared Coming Soon banner |

## Implementation Task List

- [ ] **Phase 1 — DB (`db/fnb-game`)**: scaffold via `new-db-package`; enums, `game.game`
      (registered, URN), `game.game_move`, deny-all `game.game_engine_state`; update trigger →
      `pg_notify('game:{id}:state', …)`; `game_fn` (definers: `engine_context`,
      `record_referee_result`, `player_view`, + invoker helpers) + `game_api` (`create_game`,
      `submit_move`, `resign_game`, `my_games`, `game_view`); RLS + policies; `n8n_worker`
      grants (2 fns); `res.module_permission` row; `DEPLOY_PACKAGES` += `fnb-game` (end);
      PostGraphile `pgServices.schemas` += `game, game_api` + smart tags; the `games` nav
      module + 3 tool rows in `00000000010240_app_fn.sql` (`_shared.data.md`)
- [ ] **Phase 2 — Infrastructure**: `packages/game-engines` (engine verbatim + adapters +
      wrapper/referee + machine selector + vitest + embed script); `packages/game-layer` (WS
      route, pg-notify bridge, upgrade auth); `apps/game-app` via `fnb-create-app` (WS variant);
      compose service + volumes + nginx `/game` + pinger; `n8n/credentials/anthropic-api-key.json.tpl`
      + `ANTHROPIC_API_KEY` into the `n8n-import` service env (`infrastructure.md`)
- [ ] ⏸ **USER REBUILD GATE** — Phases 1–2 land on one rebuild; then verify read-only per
      `infrastructure.md` §Verification (schema + grants + deny-all negative tests, WS upgrade
      401 unauthenticated, credential imported)
- [ ] **Phase 3 — n8n workflow + registry**: build `game-move` via the editor/`n8n-cli`, embed
      referee/selector JS from `game-engines`, export **active** to `n8n/workflows/game-move.json`;
      add `'game-move': { engine: 'n8n', permission: 'p:app-user' }` to the trigger plugin;
      verify setup / PvP move / algorithm reply / agent reply + fallback / rejection / error-handler
      paths via psql + the n8n editor (`game-move.workflow.data.md`)
- [ ] **Phase 4 — Client + pages**: fnb-types (`game.ts`, `games/battleship-view.ts`);
      `.graphql` documents + codegen (verify generated names in GraphiQL first); mappers;
      `useGames` / `useGame` (hybrid WS) composables + barrel + tenant-app re-exports;
      `BattleshipBoard.vue` + `GamesComingSoon.vue`; the four pages; `pnpm build` green
- [ ] **Phase 5 — E2E + propagation**: full browser pass (create PvP + both machine modes, live
      two-client update, resign, Coming Soon pages, nav gating); inventory updates per R21 —
      CLAUDE.md (apps/layer/db lists), `package-layers-pattern.md` (game-layer),
      `monorepo-bootstrap-pattern.md` (game-app service), skill-map if any skill inventories apps

## Remaining Open Questions (deferred — none block implementation)

- [ ] PvP invitation/accept ceremony + notification (msg integration?) — v1 seats the opponent
      silently
- [ ] Stale-game reaper (abandon `in_progress` games idle > N days) — natural n8n Schedule
      Trigger candidate; scheduling remains a deferred product call (n8n spec precedent)
- [ ] Spectating / tenant-admin read of finished games' full state
- [ ] List pagination — no house convention yet (global-rules Known Gaps); fixed window + refresh
- [ ] Agent model env-override + prompt tuning; per-move model usage/cost logging
- [ ] Tic-Tac-Toe / Checkers engines (each: enum value + `game-engines` module + referee dispatch
      + UI page — no DB change)
- [ ] Win/loss stats, leaderboards

## Considered & rejected

| Alternative | Why rejected |
|---|---|
| Single shared-board or race battleship (engine used as one board for both players) | Non-standard; user chose classic two-board. Engine still used verbatim — one instance per seat |
| Server-side (game-app) move application for humans, n8n only for machine turns | Splits the referee across two runtimes; user explicitly wants n8n managing gameplay |
| One long-lived n8n execution per game (Wait-node loop) | Signed per-execution resume URLs would have to be stored in the DB and POSTed by the app on every move; per-move executions are simpler and match the respond-immediately invariant |
| Secret columns on `game.game` hidden via smart tags + column REVOKE | PG table-level SELECT grant overrides column revokes; smart tags alone are schema-shaping, not enforcement (R12). Deny-all side table is enforceable and precedented (`auth.session`) |
| pg LISTEN/NOTIFY as the n8n trigger (workflow listens on move insert) | n8n has no durable LISTEN trigger node; webhook-per-move via the existing registry is the R22 contract |
| A new `p:games` permission key | No license-tier distinction needed for v1; `p:app-user` matches todo/locations |
| WS handler authorizing peers per-game (seat check in `upgrade`) | The socket carries only `{ event, id }` pings — no data to leak; session validation matches msg. Data access is gated at GraphQL/RLS on refetch |
| Storing the engine only inline in the workflow JSON | Untestable and drift-prone; `game-engines` + embed script keeps one tested source |
