> **Execution Directive:** plan + build this spec via `/fnb-stack-implementor <this-README>` —
> the implementor derives the `.claude/issues/` plan file (R23) from the task list below,
> then executes it. The platform this rides on is **already implemented** — the parent
> `.claude/specs/game-server/` (README + `_shared.data.md` + `infrastructure.md` +
> `game-event.workflow.data.md`) is the source of truth for everything that does **not**
> change; this spec restates none of it (R21). Never run `git` in a sqitch session; never
> rebuild/restart the env yourself — ask the user, then verify read-only.

# Checkers — a second game type on the game-server platform

## Status
**Implemented — 2026-07-20.** Ruleset: **English/American draughts** (8×8, forced capture,
chained multi-jumps, men forward-only, single-step kings). Everything except the game itself is
the already-built battleship platform, reused unchanged (zero DDL, zero new GraphQL
documents/composables). Built + live-verified against the running stack (`pnpm build` green,
72 game-engines vitest pass); the plan
`.claude/issues/in-flight/0370__app_______game-server-checkers____________MED__.plan.md` holds
the phase-by-phase record. Sole open item: the interactive browser click-through (the
platform's known gap — browser tool can't reach this Docker network).

## Purpose

Add **Checkers** as the second playable game type on the event-sourced game-server platform.
Per the platform's core promise (parent README, "DB game-type agnosticism" + "Game-type
registry table" locked decisions), a new game type is **a registry seed flip + a
`game-engines` module + referee dispatch + a UI page — zero DDL, zero new tables, zero new
composables or GraphQL documents.** Checkers is exactly that.

Every platform behavior is identical to battleship and is **not re-specified here**: N-seat
`game_player` roster, event-sourced `game_event` log with dense `event_number`, deny-all
per-event `game_event_state` snapshots, `expecting_seats` turn model, per-seat `outcome`,
the `game-event` n8n referee (`engine_context` → Code node → `record_referee_result` with the
`expectedEventCount` optimistic-concurrency guard), `pg_notify('game:{id}:state')` → the
`game-layer`/`game-app` WebSocket → `network-only` refetch, the replay scrubber, and the
`p:app-user`/`p:app-admin` gating. A checkers seat is independently **human**,
**machine_algorithm**, or **machine_agent** — the same three kinds battleship supports (user
requirement: "can play a human or algorithm or agent").

Checkers is **not a hidden-information game** — both players see the whole board. The
platform's secret-state machinery (deny-all `game_event_state`, per-seat redaction, pending
visibility) therefore still runs but redacts nothing: each seat's `player_view` is the full
board plus that seat's legal-move list. Nothing about the security model changes; it simply has
no secret to hide (contrast: battleship's fleets).

## What actually changes (the entire surface area)

| Area | Change | New DDL? |
|---|---|---|
| `db/fnb-game` | Flip the **existing** `game.game_type` `checkers` seed row: `status` `coming_soon`→`live`, `supported_player_kinds` `{human}`→`{human,machine_algorithm,machine_agent}`, `default_config` `{}`→`{"boardSize":8}` (edit-in-place seed; dev rebuilds from scratch — same pattern battleship's rows use). Nav tool `games-checkers` **already exists** and already routes to `/tenant/games/checkers` (R14) — unchanged | **No** |
| `packages/game-engines` | New `src/checkers/` module (engine, legal-move generator, views, referee, `select-move`, `agent`) + a `case 'checkers'` in the top-level `src/referee.ts` dispatcher + vitest; re-run the embed script | — |
| `game-event` n8n workflow | **Generalize the agent branch** (the one battleship-specific seam): the HTTP `anthropic-move` node's `system` field moves from a hardcoded battleship string to `{{ $json.agentContext.system }}` (engine-supplied), and `parse-agent-move` dispatches by `gameType`. Battleship's existing prompt moves verbatim into `game-engines/src/battleship/agent.ts` — **no battleship behavior change**. Re-embed, export **active** | — |
| `packages/fnb-types` | New `src/games/checkers-view.ts` (view shapes) + barrel line. `GameTypeId` **already lists** `'checkers'` — no change | — |
| `graphql-client-api` | **No new documents, no new composables.** `useGames('checkers')`, `useGame(id)`, `useGameTypes()` are game-agnostic and reused as-is. Two small Mode-3 tweaks: widen `useGame`'s `view` to a `GamePlayerView` union, and dispatch the move-toast narrator by `gameTypeId` (checkers supplies a light narrator) | — |
| `tenant-app` | New `CheckersBoard.vue`; `app/pages/games/checkers/index.vue` (real list — **replaces** the Coming Soon page) + `app/pages/games/checkers/[id].vue` (detail + replay scrubber). `routeRules: { '/games/**': { ssr: false } }` **already covers** these | — |

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| Ruleset | **English/American draughts** — 8×8, 12 pieces/side on dark squares; **forced capture** (must jump if able); **chained multi-jumps** (a jump continues until the piece can jump no more); free choice among capturing pieces (**no maximal-capture rule** — that is international); men move/capture **diagonally forward only**; reaching the far row crowns a **king** (one step, any diagonal, captures any diagonal — **not** flying) | User decision 2026-07-20. The classic default; simplest engine consistent with "real" checkers |
| Seat 1 moves first | Creator (seat 1) is **red**, moves first; seat 2 is **black** | Matches the platform's generic turn rule (round-robin ascending picks seat 1 first); no new turn semantics |
| One event = one complete move | A `move` event's `event_data` is `{ from, path }` — `path` is the ordered list of landing squares (length 1 for a slide; ≥1 for a jump chain). The referee validates + applies the **whole** move atomically, then flips the expectation | Mirrors battleship's "one event per turn, then alternate" — the platform's `expecting_seats` round-robin stays trivial (strict 2-seat alternation). Per-jump events (using `expecting_seats` to hold the same seat) considered & rejected below |
| Kinging ends the turn | A man that reaches the back row **during** a jump is crowned and the move **ends** (it may not continue jumping as a fresh king that turn) | Standard English rule; keeps the legal-move generator terminating |
| Win / outcome | On each applied move the referee checks the **opponent**: 0 pieces **or** 0 legal moves ⇒ `gameStatus: complete`, `outcomes: { mover: won, opponent: lost }`. Resign ends the game exactly as on the platform (per-seat outcomes, machines never resign) | Mirrors battleship's "board reaches `won` ⇒ complete"; reuses the platform's completion path verbatim |
| No automatic draws in v1 | No 40-move / repetition draw detection; a game ends by no-move/no-pieces or resign. The `drew` outcome exists on the platform but is unused by checkers v1 | Keeps the engine small (battleship has no draws either); repetition/40-move draw is a recorded open question |
| No hidden information ⇒ identity redaction | `game_state_after` and each seat's `player_views_after` share the **same full board**; a seat's view adds only `yourSeat`, `toMove`, `lastMove`, and (for the seat to move) the enumerated `legalMoves`. The deny-all snapshot table + `player_view` fn are used unchanged — they just don't hide anything | Reuses the platform's replay + machine-fairness plumbing with no special case; a future hidden-info game type still works because the seam is per-game view logic in the engine |
| Machine kinds | `checkers` supports **all three** kinds (human, machine_algorithm, machine_agent) — the registry `supported_player_kinds` flip; the algorithm is a forced-capture-aware heuristic, the agent picks from the **enumerated legal-move list by index** (robust parse; illegal/garbage ⇒ fall back to the algorithm) | User requirement ("human or algorithm or agent"); enumerated-index selection makes agent parsing and the fallback trivial and safe (vs. battleship's free-form `{row,col}`) |
| Agent branch is generalized, not duplicated | The engine supplies the agent **system prompt** per game type (`agentContext.system`) and each engine module owns its `completeAgentMove(payload, responseText, rand)`; the workflow's HTTP node + `parse-agent-move` become game-agnostic. Battleship's prompt/parse move into `battleship/agent.ts` **verbatim** | The only battleship-specific thing in the "everything works the same" platform was the hardcoded prompt; generalizing it once means every future game type needs **zero** workflow edits (R21 — parent workflow/shared specs updated in the same change) |
| No new client transport | Reuse `myGames` / `gameById` / `gameViewAt` / `gameTypes` / `createGame` / `submitEvent` / `resignGame` / `triggerWorkflow` documents and the `useGames`/`useGame`/`useGameTypes` composables unchanged; the `view` blob is cast to `CheckersPlayerView` by the checkers pages (gameTypeId-driven) | The platform data layer is agnostic by design (parent `_shared.data.md` §Client) — adding a game type must not touch it |
| Replay scrubber included | The checkers detail page carries the **same** prev/next/live replay scrubber as battleship (`gameView(gameId, eventNumber)` per step) | "Same behaviors as battleship"; the platform provides it for free |
| Coming Soon page retired for checkers | `games/checkers/index.vue` becomes the real list; the shared `GamesComingSoon.vue` now serves **only** Tic-Tac-Toe. Parent `coming-soon.*` spec updated to drop checkers | Checkers is now `live` |

## Files in this spec

| File | Contents |
|---|---|
| `README.md` | This index: what changes, locked decisions, task list, open questions |
| `_shared.data.md` | Checkers-specific shared data: the registry seed flip, the state-shape + view-shape contracts, fnb-types additions, the client-layer deltas (view union + narrator), and how each is a **reuse** of the platform. References the parent `_shared.data.md` for everything unchanged |
| `engine-workflow.data.md` | `packages/game-engines/src/checkers/` (engine, legal-move generator, views, referee, `select-move`, `agent`) + the top-level dispatch case + the **generalized agent branch** workflow delta + embed + vitest matrix |
| `checkers-index.ui.md` / `checkers-index.data.md` | `/tenant/games/checkers` — list + New Game modal (a near clone of battleship's) |
| `checkers-[id].ui.md` / `checkers-[id].data.md` | `/tenant/games/checkers/[id]` — live board detail page + replay scrubber |

## Implementation Task List

- [x] **Phase 1 — DB seed flip** (`sqitch-expert`, `fnb-db-designer` for the seed dialect):
      edit the `game.game_type` `checkers` seed row in the `fnb-game` deploy change in place —
      `status = 'live'`, `supported_player_kinds = '{human,machine_algorithm,machine_agent}'`,
      `default_config = '{"boardSize":8}'`. **No new sqitch change, no DDL.** Confirm the
      `games-checkers` nav tool already points at `/tenant/games/checkers` (no nav edit).
- [x] **Phase 2 — Engine + workflow generalization** (done; see the plan's execution record):
      `packages/game-engines/src/checkers/` (engine + `legal-moves` + `views` + `serialize` +
      `select-move` + `referee` with `CHECKERS_AGENT_SYSTEM` — actual layout: the agent prompt
      lives in `referee.ts`, not a separate `agent.ts`; tests in `src/tests/`, embed via
      `scripts/embed.mjs`), a `case 'checkers'` in `src/referee.ts` `runReferee` **and**
      `completeAgentMove`; **agent branch generalized** — `AgentMoveContext.system` (engine-
      supplied), battleship's prompt moved verbatim into `battleship/referee.ts`
      `BATTLESHIP_AGENT_SYSTEM`, the `anthropic-move` node `system` ←
      `$json.result.agentContext.system`; **72 vitest pass** (forced capture / multi-jump /
      kinging-ends-turn / win by no-pieces & no-moves / identity view / selector / agent
      index-parse + fallback / drift alarm); re-embedded; `game-event.json` **active**; added a
      `MACHINE_LOOP_CAP` termination guard (no draw rule yet). R21: parent
      `game-event.workflow.data.md` updated for the generalized agent branch.
- [x] ⏸ **USER REBUILD GATE** — user rebuilt; **read-only verification passed live** (see the
      plan's Verification record): `game.game_type` `checkers` = `live` / 3 kinds /
      `{"boardSize":8}`; setup → `in_progress`, `expecting {1}`, one snapshot, non-secret marker
      only (no board leak); a slide + inline algorithm reply; a **forced-capture rejection**
      (`not_a_legal_capture`); a **capture/jump** applied + the algorithm's forced counter-jump;
      **replay walk** fwd/back (live = latest snapshot); run log all `success`; **battleship
      regression** (real agent call, `agentFallback: false`) — generalization non-breaking. (The
      unrelated n8n `workflow_statistics` rollup `firstEvent.getTime` error is engine-internal
      noise, not our workflow.)
- [x] **Phase 3 — Client + pages**: `fnb-types` `src/games/checkers-view.ts` + barrel; `useGame`
      `view` widened to `GamePlayerView` union + game-typed move-toast narrator (no battleship
      change); `CheckersBoard.vue` (8×8, select-piece→destination, flips for seat 2);
      `games/checkers/index.vue` (**replaced** the Coming Soon page) + `games/checkers/[id].vue`
      (banners, board, replay scrubber). **`pnpm build` green (14/14).**
- [x] **Phase 4 — E2E + propagation**: R21 propagation done — parent `game-server/README.md`
      (battleship + checkers playable), parent `coming-soon.*` (Tic-Tac-Toe only), `fnb-stack-spec`
      Implemented Modules `games` row; parent `game-event.workflow.data.md` (generalized agent
      branch). CLAUDE.md's `fnb-game` note was already game-agnostic (no change). **Interactive
      browser click-through remains the platform's open gap** (browser tool can't reach this
      Docker network) — all non-browser checks passed live (see the gate above).

## Remaining Open Questions (deferred — none block implementation)

- [ ] Draw detection (40-ply no-capture/no-advance, or threefold repetition) — v1 ends only by
      no-move/no-pieces or resign, same minimalism as battleship. `drew` outcome already exists.
- [ ] Optional-capture / maximal-capture house rules, and the international 10×10 variant —
      each is a `default_config` flag + engine branch, no platform change.
- [ ] Move-hint UI depth (highlight only immediate destinations vs. full jump-path preview) —
      spec picks path preview; tune in-flight.
- [ ] Consecutive **agent** seats — inherits the platform's one-agent-call-per-execution limit
      (fine for 2-seat checkers; N-player is the platform's open question).
- [ ] Agent model / prompt tuning + per-move cost logging — inherits the platform's open item.
- [ ] Interactive browser E2E — inherits the platform's still-open click-through item if the
      browser tool remains unreachable at build time.

## Considered & rejected

| Alternative | Why rejected |
|---|---|
| Per-jump events (submit one jump; hold `expecting_seats` on the same seat until the chain ends) | Technically elegant use of the phase model, but it complicates the UI (partial-move state) and the replay stream (a "turn" spans several events) for no gain; one-event-per-complete-move mirrors battleship and keeps the referee's turn logic trivial |
| A second battleship-style hidden-info treatment / secret columns | Checkers has no hidden information; identity redaction reuses the deny-all plumbing at zero cost — no special-casing needed |
| A separate checkers-agent HTTP node with its own hardcoded prompt | Duplicates the one battleship-specific seam per game type; generalizing the agent branch once (engine-supplied `system`, per-engine `completeAgentMove`) makes it game-agnostic forever |
| New GraphQL documents / composables for checkers | The platform data layer is game-agnostic (queries take `gameTypeId`, views are jsonb); adding any would violate the agnosticism the platform was built for |
| International (flying kings, 10×10, backward capture) or optional-capture v1 | User chose English/American draughts; the others are deferred `default_config` variants |
| Maximal-capture (must take the longest jump) | International rule, not English/American; free choice among capturing pieces is the chosen variant |
