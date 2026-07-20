> **Execution Directive:** plan + build this spec via `/fnb-stack-implementor <this-README>` —
> the implementor derives the `.claude/issues/` plan file (R23) from the task list below,
> then executes it.

# Game Server — generic multi-game engine + battleship

## Status
**Implemented — 2026-07-20.** `db/fnb-game`, `packages/game-engines` (fresh battleship
engine — see Locked decisions), `packages/game-layer` + `apps/game-app`, the `game-event` n8n
referee, and the client/UI layer are all built, live-verified against the running stack, and
`pnpm build` green. See `.claude/issues/in-flight/0010__app_______game-server-battleship__________MED__.plan.md`
for the phase-by-phase execution record, including two real defects caught by live
verification (a referee concurrency race and a ship-position leak — both fixed and
re-verified) and the remaining open item (no interactive browser E2E pass — see Known Gaps).

## Purpose

A generic, game-type-agnostic, **event-sourced** game platform: every state change — setup,
human moves, machine moves, resigns — is a `game.game_event` row with a dense event number
and a per-event state snapshot, so any game is **replayable forward and backward as a rule**.
A game expects events from **one or more seats at a time** (`expecting_seats` — one seat for
1v1 games; several during simultaneous phases like blackjack bets or trivia answers). A new
**`game-layer` + `game-app`** pair (mirroring msg-layer/msg-app) pushes real-time state
updates to each player over WebSockets; and an **n8n workflow (`game-event`) referees all
gameplay** — every event is validated and applied by the engine running in an n8n Code node,
written back via the `n8n_worker` role, with `pg_notify` driving the live UI.

Games are tenant-scoped and **multi-player**: an N-seat roster (`game.game_player`) where each
seat is independently a **human** (a resident of the tenant) or a **machine** — either an
**algorithm** (deterministic move-selection script in a Code node) or an **agent** (Anthropic
Messages API call from n8n, using the same `ANTHROPIC_API_KEY` as the agentic engine). The
creator seats everyone at create time. Game types are rows in a **`game.game_type` registry
table** (not an enum): id, display metadata, lifecycle status (`live`/`coming_soon`/`retired`),
seat bounds, supported machine kinds, and per-type engine config — so per-game-type rules
(battleship: exactly 2 seats) are enforced at create against the registry, with the referee's
setup validation as defense-in-depth.

A new **Games** menu section (DB-registered module, R14) carries one tool per game type.
**Only battleship is implemented** (list + detail); Tic-Tac-Toe and Checkers are Coming Soon
pages. The battleship engine is a single-board engine (`createInitialGameState` + `applyMove`,
`PlacedShip.hits: Set<string>`) used per seat inside a two-board wrapper — **authored fresh in
`packages/game-engines`** (user decision 2026-07-19 at implementation go/no-go: the originally
referenced user-supplied `battleship.ts` was never added to the repo).

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| PvP battleship model | **Classic two-board**: each seat owns a hidden fleet (one engine board per seat); seats alternate firing at the opponent's board; first to sink all opponent ships wins | User decision 2026-07-19. Standard battleship; the same `{ seats: { 1, 2 } }` wrapper serves vs-machine unchanged (machine holds seat 2) |
| **Event-sourced model** | Every state change is a `game.game_event` row (setup carries the generated initial state; resigns are events too — the log has **no holes**); applied events form a dense `event_number 1..N` sequence | User decision 2026-07-19 ("each move is an event; replayable forward and backward, as a rule") |
| Replay mechanism | **Per-event snapshots**: each applied event writes `game_state_after` + `player_views_after` to deny-all `game.game_event_state`; replay = walk `event_number` (no engine in the replay path; current state = latest snapshot) | User decision 2026-07-19. Backward stepping is trivial and replay is immune to engine-version drift; storage negligible at board-game scale. Deterministic re-fold rejected |
| Expectation model | `game.game.expecting_seats int[]` — the seats the game awaits events from; referee-owned. Always one seat for 1v1; several during simultaneous phases (blackjack bets, trivia answers), which hold submissions `pending` until the phase resolves | User decision 2026-07-19. A scalar `current_turn_seat` cannot express simultaneous expectations |
| Outcome model | **Per-seat**: `game_player.outcome` (`won`/`lost`/`drew`) set at completion; no `winner_seat` on `game.game` | User decision 2026-07-19. Blackjack resolves per seat, trivia ties, and draws get a home; a scalar winner column can't represent any of those |
| Replay scrubber | **Ships in v1** on the battleship detail page: step prev/next through `event_number` via `game_view(gameId, eventNumber)` | User decision 2026-07-19 — proves the replay contract end-to-end |
| Turn rule | Strict alternation — a hit does **not** grant an extra shot. Generic rule: battleship expects **one seat, round-robin ascending**, skipping resigned seats (2 seats ⇒ alternation); phase advancement is always the engine's call | Simplest classic variant; the "shoot-again-on-hit" house rule rejected to keep the referee's turn logic trivial |
| **N-seat player model** | Seats live in a **`game.game_player` roster** (seat, `player_kind`, `resident_urn`, `resigned_at`); `game.game` carries only `seat_count` — the two `player_*_resident_urn` columns and game-level `opponent_kind` are gone | User decision 2026-07-19 ("support multi-player games"). Future game types with any player count need zero DDL; the game record stays fully game-type-agnostic |
| Multi-player scope | **Generalize the core only** — DB/API/referee contract are N-seat; battleship remains the only playable game (2 seats). No N-player game ships in v1 | User decision 2026-07-19. Smallest change that satisfies the requirement |
| Seating | **Creator seats everyone at create** (`create_game(game_type, players[])` — caller is seat 1); no join/lobby or invite ceremony | User decision 2026-07-19. Extends the existing no-invite v1 lock; open-lobby join flow deferred |
| Machine seats | **Per-seat `player_kind`**: any seat is independently `human` \| `machine_algorithm` \| `machine_agent`; the referee **loops machine events** while `expecting_seats` contains machine seats (`machine` actions in the result contract) | User decision 2026-07-19. Symmetric model — e.g. 1 human vs 3 bots works when an N-player game type lands; for 2-seat battleship the loop degenerates to ≤ 1 reply |
| Event authority | **n8n referees all events**: players submit raw events via GraphQL (`game_api.submit_event` inserts a `pending` row — **one pending per seat**, partial unique index); the `game-event` workflow validates + applies every event in a Code node and writes via `n8n_worker`. `record_referee_result` serializes per game (`pg_advisory_xact_lock` + still-pending re-check) so concurrent duplicate executions cannot double-apply | User decision 2026-07-19. Matches "n8n manages the gameplay"; client is never trusted with the engine; the double-apply race is closed in the DB, not in n8n |
| Pending visibility | RLS hides a `pending` event (and its payload) from everyone but the submitting seat; applied event data is public | Simultaneous-submission games must not leak held bets/answers; battleship data is never secret so this costs nothing in v1 |
| n8n loop shape | **One execution per trigger** (webhook per submitted event; `op: 'setup'` initializes). Machine events loop **inside** the execution until an all-human expectation or terminal; at most one **agent** call per execution in the current graph (enough for all 2-seat games) | User decision 2026-07-19. Durable, respond-immediately, no signed Wait-node resume URLs in the DB |
| DB game-type agnosticism | `game.game` has no battleship columns — state is jsonb; `game_type_id` FKs the registry, whose `id` the referee dispatches on | User requirement. Tic-tac-toe/checkers add a registry row + engine module, zero DDL |
| **Game-type registry table** | `game.game_type` is a **seeded reference table, not an enum**: `id` (the old enum values), `name`, `description`, `icon`, `ordinal`, `status` (`live`/`coming_soon`/`retired`), `min`/`max_player_seats`, `supported_player_kinds game.player_kind[]`, `default_config jsonb` | User decision 2026-07-19 (all four optional column groups accepted). Per-type rules become data: `create_game` enforces availability + seat bounds + machine-kind support (errors `30003`–`30005`); the registry powers the New Game modal and any future Games hub; the referee's setup `abort` stays as defense-in-depth |
| Secret state placement | Authoritative `game_state_after` + per-seat `player_views_after` snapshots live in the **deny-all** table `game.game_event_state` (RLS enabled, zero policies, explicit revoke — `auth.session` precedent); only SECURITY DEFINER `game_fn.*` touch it | Ship positions must be invisible to players — live **and** at every replay step. Column-level carve-outs on a broadly-granted table don't work in PG (table-level SELECT wins); a deny-all side table is the house pattern |
| Per-seat redaction | The **engine computes `player_views_after`** (own fleet fully visible; opponent board redacted to hit/miss/sunk) per applied event; players read only their seat's view via `game_api.game_view(gameId, eventNumber)` → definer `game_fn.player_view` (NULL event = live) | Keeps the DB agnostic — redaction is game logic, so it lives in the engine, not SQL; one function serves live play and the scrubber |
| Machine fairness | Every machine seat (algorithm **and** agent) selects moves from **its own seat's redacted view only** — never from `game_state` | The agent prompt must not leak any human fleet; algorithm uses the same information |
| Server topology | New **`packages/game-layer`** (extends tenant-layer; WS route + pg-notify bridge) + **`apps/game-app`** (extends game-layer, nginx `/game`) — mirror of msg-layer/msg-app | User requirement ("similarly to the msg server"); tenant-app pages connect cross-app to `/game/_ws/...` exactly as they do to `/msg/_ws/...` |
| Real-time refresh path | On WS notify, the composable re-executes the GraphQL detail query (`network-only`) — **no REST/`withClaims` carve-out** | Deviation from msg (which fetches incremental single messages): game updates are whole-state, and the query already exists. R5 default path preferred over a new carve-out |
| Engine source of truth | New **`packages/game-engines`** (pure TS, vitest-covered, no runtime app consumers): battleship engine verbatim + JSON serialization adapters + wrapper/referee + machine-move selector; an **embed script** injects the built JS into the `game-event.json` Code nodes | n8n Code nodes can't import repo packages; a tested canonical source + mechanical embed beats hand-synced inline JS (the drift hazard) |
| Engine JSON adaptation | `PlacedShip.hits: Set<string>` dehydrates to `string[]` for jsonb persistence; hydrate/dehydrate helpers wrap the engine — engine internals unmodified | jsonb can't hold a `Set`; the supplied engine is otherwise used as-is |
| Event write shape | ONE granted write fn: `game_fn.record_referee_result(game_id, result jsonb)` applies the referee's ordered **`actions` list** atomically (system/apply/reject/machine, each applied action with its snapshot) | Collapses per-step Postgres nodes; atomicity; smallest possible `n8n_worker` grant inventory (2 fns) |
| Agent model + fallback | HTTP Request → Anthropic Messages API, `claude-haiku-4-5-20251001`, `x-api-key` header credential rendered from the existing `ANTHROPIC_API_KEY`; on unparseable/illegal agent output, **fall back to the algorithm move** | User requirement (n8n + agentic-engine credentials). Haiku is ample for move selection; the fallback keeps games unstuck |
| Trigger path | One registry key **`game-event`** (`engine: 'n8n'`, `permission: 'p:app-user'`) in the `triggerWorkflow` plugin; input `{ op: 'setup' \| 'event', gameId }`; composables call the existing `triggerWorkflow` mutation after `create_game`/`submit_event`/`resign_game` | R22 house plumbing; rogue triggers are harmless (referee no-ops without pending events; the advisory lock makes duplicates safe) |
| PvP invitation | **None in v1** — creating a game immediately seats the chosen player(s); the game appears in their list | Smallest viable PvP; accept/decline ceremony deferred |
| Resign rule | **Resign is an event through the referee** (any pending event of the resigner is rejected `superseded_by_resign`): applied generically — `resigned_at`, `expecting_seats` recomputed without the seat, and when one active seat remains → `complete` with per-seat outcomes (v1 2-seat: every resign ends the game; machines never resign) | The event log has no holes — a direct-update resign would break replay |
| Tenancy | Games are tenant-scoped: `tenant_id` + all human seats are residents of the same tenant (URN FKs into `res.resource`) | House model; cross-tenant play deferred with everything else multi-tenant |
| Permissions | Module + tools gated `p:app-user`/`p:app-admin` (todo/locations precedent); no new permission key. RLS SELECT is tenant-scoped (msg precedent); mutations enforce seat membership in `_api`/`_fn` | No new license machinery for v1 |
| URN registration | `game.game` is a registered business table (generated `urn`, deferred FK, `register_resource` in the create path, `game` module row); `game.game_player`, `game.game_event`, and `game.game_event_state` are unregistered children | urn-registry forward-only convention for new business tables |
| Nav | New module `games` (`i-lucide-gamepad-2`) with tools Battleship (`i-lucide-ship`, live), Tic-Tac-Toe (`i-lucide-hash`), Checkers (`i-lucide-circle-dot`) — the latter two route to Coming Soon pages | R14; all four icons verified in lucide |
| Scope of playable games | Battleship only: list + detail. Coming Soon pages for the other two tools share one `GamesComingSoon` component | User requirement |
| List page freshness | The battleship list is fetch-on-load + manual refresh — **not** real-time; only the detail page holds a WS | One WS per open game matches the msg model; list-level LISTEN deferred |

## Files in this spec

| File | Contents |
|---|---|
| `README.md` | This index: decisions, task list, open questions |
| `_shared.data.md` | The `db/fnb-game` package (schemas, the `game_type` registry + seeds, N-seat game record + `game_player` roster, the `game_event` log + deny-all per-event snapshots, `_fn`/`_api`, RLS, triggers, `n8n_worker` grants), state-shape contracts, PostGraphile exposure, engine registry entry, fnb-types, composables, WS architecture, security model |
| `infrastructure.md` | `packages/game-layer`, `apps/game-app` (compose + nginx), `packages/game-engines` (+ embed script), the n8n Anthropic credential template, env changes |
| `game-event.workflow.data.md` | The `game-event` n8n workflow: node graph, referee Code-node contract (event-sourced actions list), the machine move-selection script (full source), the agent (Anthropic) branch, error handling + recovery |
| `battleship-index.ui.md` / `battleship-index.data.md` | `/tenant/games/battleship` — list + New Game modal |
| `battleship-[id].ui.md` / `battleship-[id].data.md` | `/tenant/games/battleship/[id]` — live two-board detail page + replay scrubber |
| `coming-soon.ui.md` / `coming-soon.data.md` | `/tenant/games/tic-tac-toe` + `/tenant/games/checkers` — shared Coming Soon banner |

## Implementation Task List

- [x] **Phase 1 — DB (`db/fnb-game`)**: scaffold via `new-db-package`; enums, the
      `game.game_type` registry (+ 3 seed rows), `game.game`
      (registered, URN, `seat_count`, `expecting_seats`, `event_count`, `game_type_id` FK),
      the `game.game_player` roster (with `outcome`), the `game.game_event` log (dense
      `event_number`, one-pending-per-seat partial unique index), deny-all per-event
      `game.game_event_state`; update trigger →
      `pg_notify('game:{id}:state', …)`; `game_fn` (definers: `engine_context`,
      `record_referee_result` with the advisory-lock serialization, `player_view(event#)`,
      + invoker helpers) + `game_api` (`create_game`
      with the `_players jsonb` roster, `submit_event`, `resign_game` (resign-as-event),
      `my_games`, `game_view(event#)`);
      RLS + policies (incl. pending-visibility on `game_event`); `n8n_worker` grants (2 fns);
      `res.module_permission` row;
      `DEPLOY_PACKAGES` += `fnb-game` (end); PostGraphile `pgServices.schemas` += `game,
      game_api` + smart tags; the `games` nav module + 3 tool rows in
      `00000000010240_app_fn.sql` (`_shared.data.md`)
- [x] **Phase 2 — Infrastructure**: `packages/game-engines` (fresh battleship engine — see
      Locked decisions — + adapters + wrapper/referee + machine selector + vitest + embed
      script); `packages/game-layer` (WS route, pg-notify bridge, upgrade auth); `apps/game-app`
      via `fnb-create-app` (WS variant); compose service + volumes + nginx `/game` + pinger;
      `n8n/credentials/anthropic-api-key.json.tpl` + `ANTHROPIC_API_KEY` into the `n8n-import`
      service env (`infrastructure.md`)
- [x] ⏸ **USER REBUILD GATE** — Phases 1–2 landed on one rebuild; verified read-only per
      `infrastructure.md` §Verification (schema + grants + deny-all negative tests, WS upgrade
      401 unauthenticated, credential imported) — all passing
- [x] **Phase 3 — n8n workflow + registry**: built `game-event`, embedded referee/selector JS
      from `game-engines`, exported **active** to `n8n/workflows/game-event.json`; added
      `'game-event': { engine: 'n8n', permission: 'p:app-user' }` to the trigger plugin; verified
      setup / PvP event / algorithm reply / agent reply (real Anthropic call) / rejection /
      3-way concurrent-duplicate noop / resign / replay walk fwd+back / pending-visibility /
      error-handler paths live against the running stack (`game-event.workflow.data.md`
      §Verification has the full run-by-run record). **Two real defects found and fixed here**:
      (1) the advisory lock alone did not prevent two racing executions from each inserting
      their own machine event — closed with an `expectedEventCount` optimistic-concurrency
      guard in `record_referee_result`; (2) the `setup` event's `event_data` was found to leak
      the full unredacted fleet layout (tenant-readable once applied) — fixed to a non-secret
      marker, full state confined to the deny-all `game_event_state` snapshot as designed.
- [x] **Phase 4 — Client + pages**: fnb-types (`game.ts`, `games/battleship-view.ts`);
      `.graphql` documents + codegen (verified generated names in GraphiQL); mappers;
      `useGames` / `useGame` (hybrid WS + replay scrubber state) / `useGameTypes` composables +
      barrel + tenant-app re-exports; `BattleshipBoard.vue` + `GamesComingSoon.vue`; the four
      pages incl. the detail page's replay scrubber; `pnpm build` green across all 14
      packages/apps.
- [x] **Phase 5 — E2E + propagation**: HTTP-level verification of all four routes (200 after
      fixing a missed `routeRules: { ssr: false }` entry that 500'd every `/tenant/games/**`
      page — tenant-app's urql plugin is client-only, same requirement as every other
      data-driven section); DB-level nav/RLS/grant checks (Phase 1); referee logic checks
      (Phase 3). **No interactive browser click-through was completed** — the available browser
      automation tool could not reach this host's Docker network (connection refused after an
      initial crash); see Known Gaps. R21 propagation done — see the propagation commits to
      CLAUDE.md, `package-layers-pattern.md`, `monorepo-bootstrap-pattern.md`,
      `graphql-api-pattern.md`, and skill-map.

## Remaining Open Questions (deferred — none block implementation)

- [ ] **Interactive browser E2E pass** — click-through verification (create PvP, live
      two-client WS update, the New Game modal, the replay scrubber UI, nav gating) was not
      completed; the session's browser automation tool could not reach this host's Docker
      network. Everything reachable without a browser (HTTP-level route checks, DB/RLS/grant
      state, the referee's full behavior matrix under real concurrency) was verified live and
      passed. Do this pass when a working browser tool is available.
- [ ] PvP invitation/accept ceremony + notification (msg integration?) — v1 seats everyone
      silently at create; an open-lobby/join flow is the natural N-player extension
- [ ] Consecutive **agent** seats in an N-player game need an n8n loop around the HTTP branch
      (current graph: one agent call per execution — sufficient for all 2-seat games)
- [ ] Turn/seated notifications (nothing tells a PvP opponent a game exists or that it's their
      turn; the list page is not real-time) — msg integration is the natural path
- [ ] Turn clock / per-move timeout (an absent opponent leaves a game `in_progress`; resign is
      the only out) — distinct from the stale-game reaper below
- [ ] Agent-move cost ceiling (every human move in a vs-agent game is an Anthropic call; no
      per-tenant/per-user rate or spend guard yet) — pairs with the usage-logging item below
- [ ] Event-log/snapshot retention for chatty future game types (one snapshot per event is
      trivial for battleship; compaction policy TBD if a game type generates hundreds)
- [ ] Engine-version policy for in-flight games (replay is snapshot-immune, but a deployed
      engine change can strand an in-progress game's *next* move; "abandon in-flight on
      engine change" is an acceptable v1 answer — decide and record)
- [ ] Stale-game reaper (abandon `in_progress` games idle > N days) — natural n8n Schedule
      Trigger candidate; scheduling remains a deferred product call (n8n spec precedent)
- [ ] Spectating / tenant-admin read of finished games' full state
- [ ] List pagination — no house convention yet (global-rules Known Gaps); fixed window + refresh
- [ ] Agent model env-override + prompt tuning; per-move model usage/cost logging
- [ ] Tic-Tac-Toe / Checkers engines (each: flip the registry row to `live` (+ seat
      bounds/kinds/config) + `game-engines` module + referee dispatch + UI page — no DDL)
- [ ] Win/loss stats, leaderboards
- [ ] `game.game_type` registry management (admin UI / API for flipping `status`, tuning
      `default_config`) — seed/deploy-only for now
- [ ] Driving the Coming Soon pages and a Games hub from `gameTypeList` (name/description/
      status from the registry) — pages stay hardcoded in v1

## Considered & rejected

| Alternative | Why rejected |
|---|---|
| Single shared-board or race battleship (engine used as one board for both players) | Non-standard; user chose classic two-board. Engine still used verbatim — one instance per seat |
| Mutable current-state snapshot (`game_engine_state` overwritten per move) | The original design — rejected 2026-07-19: not replayable (setup randomness never hit the log, resign bypassed it, backward stepping had nothing to step to). Replaced by the event log + per-event snapshots |
| Deterministic re-fold replay (events + RNG seed, recompute state) | Minimal storage but puts the engine in the replay path and breaks old replays on engine changes; user chose per-event snapshots |
| Scalar `winner_seat` / `current_turn_seat` columns | Cannot express simultaneous expectations (blackjack bets, trivia answers), per-seat outcomes, or draws — replaced by `expecting_seats int[]` + `game_player.outcome` |
| Keeping `player_one/two_resident_urn` columns + game-level `opponent_kind` (2-seat model) | Hard-wires two players into the DB/API/referee; user requires multi-player support. The `game_player` roster generalizes with no extra ceremony for 2-seat games |
| `game_type` as an enum | User decision 2026-07-19: an enum can't carry per-type data (seat bounds, status, machine support), forcing those rules into engine code and hardcoded UI. A seeded registry table makes them data the DB enforces at create |
| Turn structure / win rules / redaction rules as `game.game_type` columns | Engine logic — duplicating it in SQL invites drift with the embedded engine (the DB-stays-agnostic lock) |
| Open lobby + join flow for multi-player seating | Adds a join mutation, lobby UI, and lobby real-time concerns; user chose creator-seats-everyone (extends the no-invite v1 lock). Deferred, not rejected outright |
| Machines restricted to 2-player games (keep game-level `opponent_kind`) | Asymmetric model; per-seat `player_kind` costs little now (referee machine-loop) and makes mixed human/bot N-player games possible later |
| Server-side (game-app) move application for humans, n8n only for machine turns | Splits the referee across two runtimes; user explicitly wants n8n managing gameplay |
| One long-lived n8n execution per game (Wait-node loop) | Signed per-execution resume URLs would have to be stored in the DB and POSTed by the app on every move; per-move executions are simpler and match the respond-immediately invariant |
| Secret columns on `game.game` hidden via smart tags + column REVOKE | PG table-level SELECT grant overrides column revokes; smart tags alone are schema-shaping, not enforcement (R12). Deny-all side table is enforceable and precedented (`auth.session`) |
| pg LISTEN/NOTIFY as the n8n trigger (workflow listens on move insert) | n8n has no durable LISTEN trigger node; webhook-per-move via the existing registry is the R22 contract |
| A new `p:games` permission key | No license-tier distinction needed for v1; `p:app-user` matches todo/locations |
| WS handler authorizing peers per-game (seat check in `upgrade`) | The socket carries only `{ event, id }` pings — no data to leak; session validation matches msg. Data access is gated at GraphQL/RLS on refetch |
| Storing the engine only inline in the workflow JSON | Untestable and drift-prone; `game-engines` + embed script keeps one tested source |
