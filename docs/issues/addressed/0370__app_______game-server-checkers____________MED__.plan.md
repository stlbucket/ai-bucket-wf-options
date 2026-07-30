# Plan: Checkers — a second playable game type on the game-server platform (seed flip + game-engines/checkers + generalized agent branch + tenant-app pages)

> **Execution Directive:** Implement this plan via `/fnb-stack-implementor <this-file>`.
> The authoritative spec is `.claude/specs/game-server/checkers/` (README + `_shared.data.md`
> + `engine-workflow.data.md` + `checkers-index.*` + `checkers-[id].*`) — this plan sequences
> it and records planning findings; it does not restate the spec (R21). The platform it rides
> on is **already implemented** (`.claude/specs/game-server/` + `db/fnb-game` +
> `packages/game-engines` + `game-layer`/`game-app` + the `game-event` n8n workflow) and is
> reused unchanged except where noted. Specialist skills: `sqitch-expert` (the seed edit),
> `n8n-cli` (workflow re-embed/export), `fnb-db-designer` (seed dialect if needed).
> Never run `git` in a sqitch session; never rebuild/restart the env yourself — ask the user,
> then verify read-only.

**Severity: MED** (feature work) · Workstream: games · Planned: 2026-07-20
· Spec status: Draft, decisions locked 2026-07-20 (English/American draughts ruleset), no
`[FILL IN]`s. Sibling of the addressed battleship plan
`0010__app_______game-server-battleship__________MED__.plan.md`.

## Context

Add **Checkers** as the second game type. The battleship work built a deliberately
game-agnostic, event-sourced platform whose own spec documents the "add a game type" path as
**a registry seed flip + a `game-engines` module + a referee `case` + a UI page — zero DDL,
zero new tables, zero new GraphQL documents or composables**. Checkers is exactly that, plus
one small generalization of the single battleship-specific seam (the agent prompt). Ruleset:
English/American draughts (8×8, forced capture, chained multi-jumps, men forward-only,
single-step kings) — user decision 2026-07-20.

## Planning findings (verified 2026-07-20 against the running tree)

1. **Seed row** — `db/fnb-game/deploy/00000000011300_game.sql:49`:
   `('checkers', 'Checkers', 'Diagonal capture classic.', 'i-lucide-circle-dot', 2,
   'coming_soon', 2, 2, '{human}', '{}'::jsonb)`. Phase 1 edits this **row in place** to
   `'live'`, `'{human,machine_algorithm,machine_agent}'`, `'{"boardSize": 8}'::jsonb` (dev
   rebuilds from scratch — same edit-in-place pattern battleship's `'live'` row uses two lines
   up; **no new sqitch change, no DDL**).
2. **Dispatcher** — `packages/game-engines/src/referee.ts` exports `runReferee(ctx, op, rand)`
   and `completeAgentMove(ctx, referee, agentText, rand)`, each a `switch (ctx.gameType.id)`
   with only a `battleship` case today. Checkers = one `case 'checkers'` in **each** (import
   `refereeCheckers` + `completeCheckersAgentMove` from `./checkers/referee`). No structural
   change.
3. **Engine module layout** (actual, differs from the spec's `infrastructure.md` sketch):
   `src/battleship/{engine,referee,serialize,views,select-move}.ts` + `src/referee.ts`
   (dispatcher) + `src/referee-types.ts` (`EngineContext`, `RefereeResult`, `RefereeAction`,
   `agentContext`) + `src/index.ts` + `src/n8n-embed.ts`. Tests in **`src/tests/*.spec.ts`**
   (`engine`, `referee`, `select-move`, `embed-drift`) — house convention, not the spec's
   `test/`. Embed scripts: **`scripts/embed.mjs`** (+ `scripts/embed-check.mjs` drift check),
   run via package `test`/`embed` scripts. Mirror this layout for `src/checkers/` and add
   `src/tests/checkers.*.spec.ts`; **the spec's `infrastructure.md` path names are superseded
   by these actual ones.**
4. **Agent branch is only partly generalized.** `completeAgentMove` **already dispatches by
   game type** (finding 2) — good. But the **system prompt is hardcoded** in the
   `anthropic-move` HTTP node's `jsonBody` expression (`n8n/workflows/game-event.json:151`,
   `system: "You are playing Battleship…"`), and `agentContext` today is
   `{ seat, view, legalMoves }` with **no `system`** field (battleship
   `referee.ts:121`). Generalization (Phase 2) is therefore minimal:
   (a) add an engine-supplied `system: string` to `agentContext` in `referee-types.ts` and
   have each game's referee populate it (battleship's exact wording moves into a
   `BATTLESHIP_AGENT_SYSTEM` constant — **no wording change**); (b) change the HTTP node's
   `jsonBody` `system:` from the literal to `$json.result.agentContext.system` (the node
   already reads `$json.result.agentContext` for the user content). `parse-agent-move` needs no
   change (it calls the already-dispatched `completeAgentMove`).
5. **Nav already present** — `db/fnb-app/deploy/00000000010240_app_fn.sql:404` has the
   `games-checkers` tool → `/tenant/games/checkers`. **No nav edit.**
6. **fnb-types** `GameTypeId` (`packages/fnb-types/src/game.ts:5`) already includes
   `'checkers'`. Phase 3 adds only `src/games/checkers-view.ts` + a barrel line.
7. **Coming Soon page** — `apps/tenant-app/app/pages/games/checkers/index.vue` exists as the
   shared-`GamesComingSoon` one-liner; Phase 3 **replaces** it with the real list and adds
   `[id].vue`. `routeRules: { '/games/**': { ssr: false } }` already covers both (battleship
   Phase 5 lesson — already in `apps/tenant-app/nuxt.config.ts`).
8. **No new external deps** — `esbuild` (embed) already catalogued for battleship; checkers
   state is JSON-native (no `Set`), so `serialize.ts` is identity.
9. **No client transport work** — `myGames`/`gameById`/`gameViewAt`/`gameTypes`/`createGame`/
   `submitEvent`/`resignGame` documents + `useGames`/`useGame`/`useGameTypes` composables are
   game-agnostic; the only client-lib change is widening `useGame`'s view type to a union and
   dispatching the toast narrator by `gameTypeId` (Phase 3).

## Implementation phases

Follows the spec README task list. **`pnpm build` is the gate** (repo lint is broken).
Read the spec's `engine-workflow.data.md` for the engine/referee contract, the legal-move
rules, the view shapes, and the vitest matrix; the platform contracts (`record_referee_result`
actions, `engine_context`, `player_view`) are unchanged — see the parent `_shared.data.md`.

### Phase 1 — DB seed flip (skill: `sqitch-expert`)
Edit the `checkers` seed row **in place** at `00000000011300_game.sql:49` (finding 1):
`status → 'live'`, `supported_player_kinds → '{human,machine_algorithm,machine_agent}'`,
`default_config → '{"boardSize": 8}'::jsonb`. No new change file, no DDL, no nav edit
(finding 5). That is the entire DB surface.

### Phase 2 — Engine + workflow generalization (skill: `n8n-cli` for embed/export)
- **`packages/game-engines/src/checkers/`** (mirror battleship's layout, finding 3):
  `engine.ts` (8×8 board model, `createInitialState`, `applyMove` for a validated move,
  crowning-ends-turn, `hasAnyMove`/`pieceCount`), `legal-moves.ts` (`legalMovesFor` — English
  rules: forced capture, maximal DFS jump chains, kinging terminates, men forward-only, kings
  omnidirectional single-step), `views.ts` (`computeViews` — identity board for both seats +
  `legalMoves` only for the seat to move), `serialize.ts` (identity `hydrate`/`dehydrate`),
  `select-move.ts` (`selectMachineMove` — prefer longest capture, injectable `rand`),
  `referee.ts` (`refereeCheckers(ctx, op, rand)` + `completeCheckersAgentMove(...)` + a
  `CHECKERS_AGENT_SYSTEM` constant + the `{ moveIndex }` agent contract with algorithm
  fallback). Emit the platform `RefereeResult` actions list with per-action
  `stateAfter`/`viewsAfter`; setup `eventData` is the non-secret marker
  `{ gameType, boardSize }`.
- **Dispatcher** (`src/referee.ts`): add `case 'checkers'` to **both** `runReferee` and
  `completeAgentMove` (finding 2).
- **Generalize the agent branch** (finding 4): add `system: string` to `agentContext` in
  `src/referee-types.ts`; battleship `referee.ts` populates it from a new
  `BATTLESHIP_AGENT_SYSTEM` constant holding its **current wording verbatim**; change the
  `anthropic-move` node's `jsonBody` `system:` to `$json.result.agentContext.system` in
  `n8n/workflows/game-event.json`. **R21: update the parent
  `game-server/game-event.workflow.data.md` (§agent branch) + `game-server/_shared.data.md`
  (the `agentContext` shape) in this same change.**
- **vitest** `src/tests/checkers.*.spec.ts` (spec §5 matrix): legal-move generation (opening,
  forced capture, multi-jump chain, kinging-terminates, king moves, men-no-backward), applyMove
  (move/capture/crown/moveCount), win detection (0 pieces & 0-legal-moves), referee (setup
  marker, apply+flip, illegal/forced-capture reject, algo-vs-algo to terminal win), views
  (identity board, legalMoves only for mover), selector (never illegal, prefers longest
  capture, deterministic), agent (`{moveIndex}` parse + fallback on garbage), and the
  **bundle-hash drift** (extend/verify `embed-drift.spec.ts`).
- **Re-embed + export**: run the package `embed` script so the `referee` + `parse-agent-move`
  Code nodes in `n8n/workflows/game-event.json` carry the checkers-inclusive bundle; export the
  workflow **active**. Confirm the drift check passes.

### ⏸ USER REBUILD GATE
Phases 1–2 land on one rebuild (re-deploys the seed row, re-imports the workflow with the
embedded checkers code + generalized agent node) — **ask the user to run it**, then verify
read-only per spec README + `engine-workflow.data.md` §6: `game.game_type` `checkers` row is
`live` with the three kinds + `{"boardSize":8}`; GraphiQL `gameTypeList` shows checkers `LIVE`;
a hand-seeded checkers game → `op:'setup'` reaches `in_progress`, `expecting_seats {1}`, one
`game_event_state` snapshot; a PvP slide, a forced capture, and a multi-jump each apply as
single events and flip the turn; a kinging move crowns + ends the turn; an algorithm reply
lands same-execution; an agent reply lands via the **generalized** branch; an illegal move is
`rejected` with a reason; a win-by-no-moves and a resign each complete with per-seat outcomes;
a 3-way concurrent trigger yields one apply + `stale_context` noops; **battleship still works**
(one vs-agent battleship move end-to-end — confirms the agent-branch change is non-breaking);
`n8n_worker` grant boundary unchanged; **no new `game.*` tables/columns**.

### Phase 3 — Client + pages (spec `_shared.data.md` §5–6, `checkers-*` files)
- **fnb-types**: `src/games/checkers-view.ts` (`CheckersSquare`, `CheckersPiece`,
  `CheckersCell`, `CheckersLegalMove`, `CheckersMove`, `CheckersPlayerView`) + barrel line
  `export * from './games/checkers-view'`. (`GameTypeId` already has checkers — finding 6.)
- **graphql-client-api** (Mode-3 tweaks, no new docs/composables — finding 9): widen
  `useGame`'s live/replay `view` type to `GamePlayerView = BattleshipPlayerView |
  CheckersPlayerView`; dispatch the move-toast narrator by `gameTypeId` (add a light checkers
  narrator — "They moved" / "Captured {n}" / "Kinged!"). No battleship behavior change; verify
  the barrel.
- **tenant-app** (Nuxt UI v4; UC4/5/6/7/8/11/12/13): `app/components/games/CheckersBoard.vue`
  (8×8 dark-square board, select-piece→destination with path preview, flips for seat 2,
  **imported explicitly** in `[id].vue` per the `GamesBattleshipBoard` auto-import gotcha);
  **replace** `app/pages/games/checkers/index.vue` with the real list (near-clone of
  `battleship/index.vue`, `useGames('checkers')` + New Game modal); add
  `app/pages/games/checkers/[id].vue` (turn/outcome banners, `CheckersBoard`, replay scrubber —
  near-clone of `battleship/[id].vue`, narrows `view` to `CheckersPlayerView` by `gameTypeId`).
  `pnpm build` green.

### Phase 4 — E2E + propagation (read-only; user runs any restart)
Browser pass per README Phase 4: create PvP + both machine modes, live two-client update, a
forced capture, a multi-jump, a kinging, a win by no-moves, resign, replay scrubber fwd/back,
nav (checkers no longer Coming Soon). Then R21 propagation: flip the parent
`game-server/README.md` (battleship **+ checkers** playable; move the checkers open-question
line to done), the parent `coming-soon.*` (now Tic-Tac-Toe only), CLAUDE.md's `fnb-game`
game-type note, and the `fnb-stack-spec` skill's Implemented Modules `games` row (checkers
`Implemented`). Fold any in-flight corrections back into the spec files; ask the user before
moving this plan to `addressed/`.

## Execution progress (2026-07-20)

- **Phase 1 (DB seed flip)** — DONE. `checkers` row in `00000000011300_game.sql` flipped to
  `live` / `{human,machine_algorithm,machine_agent}` / `{"boardSize": 8}`.
- **Phase 2 (engine + workflow)** — DONE. `packages/game-engines/src/checkers/` (engine,
  legal-moves, views, serialize, select-move, referee + `CHECKERS_AGENT_SYSTEM`); dispatcher
  cases in `src/referee.ts`; agent branch generalized (`AgentMoveContext.system`,
  `BATTLESHIP_AGENT_SYSTEM` moved verbatim into `battleship/referee.ts`, `anthropic-move` node
  `system` ← `$json.result.agentContext.system`); **72 vitest pass**; re-embedded +
  `game-event.json` still `active`; drift check in-sync. Added a `MACHINE_LOOP_CAP` termination
  guard (checkers has no draw rule — see spec). R21: parent `game-event.workflow.data.md`
  updated for the generalized agent branch.
- **Phase 3 (client + pages)** — CODE DONE (hot-reloads; verified at the rebuild). fnb-types
  `checkers-view.ts` + barrel; `useGame` view widened to `GamePlayerView` union + game-typed
  toast narrator; `CheckersBoard.vue`; `checkers/index.vue` (replaced the Coming Soon page) +
  `checkers/[id].vue`. **`pnpm build` green (14/14).**
- **USER REBUILD GATE** — DONE (user rebuilt). **Live read-only verification passed** against a
  hand-seeded checkers vs-algorithm game (`019f8072-…`) and a battleship vs-agent game
  (`019f8076-…`):
  - seed row `live` / 3 kinds / `{"boardSize":8}`;
  - setup → `in_progress`, `expecting {1}`, event 1 snapshot, `event_data` = non-secret marker
    `{gameType, boardSize}` only (no board leak); seat-1 opening `legalMoves` = the 7 slides;
  - seat-1 slide + inline algorithm reply (events 2,3);
  - non-capturing slide while a capture was forced → `rejected` `not_a_legal_capture`;
  - seat-1 capture jump (event 4) + the algorithm's own forced counter-jump (event 5) — piece
    counts 12/12 → 12/11 → 11/11;
  - replay walk fwd/back via `game_fn.player_view` (live = latest snapshot);
  - `n8n.workflow_run` all `success` (2 applied + 1 machine per move; 1 rejected), clean
    `result_data`;
  - **battleship regression**: vs-agent human move → real Anthropic reply, `agentFallback:false`
    through the generalized `agentContext.system` node — non-breaking.
  - Note: the n8n `WorkflowStatisticsRollupService` `r.firstEvent.getTime is not a function`
    error is engine-internal statistics-rollup noise (n8n's private `workflow_statistics`
    table), unrelated to this change; our workflow runs completed clean.
- **Phase 4 (propagation)** — DONE. Parent `README.md`, `coming-soon.*`,
  `game-event.workflow.data.md`, and the `fnb-stack-spec` skill updated; CLAUDE.md already
  game-agnostic. Sub-spec README flipped to **Implemented**. Interactive browser E2E remains the
  platform's open gap (browser tool can't reach this Docker network).

## Sequencing summary

Phase 1 (seed edit — sqitch session, no `git`) + Phase 2 (engine + workflow, needs the embed
run) → **user rebuild** → read-only verify (incl. a battleship regression check for the agent
change) → Phase 3 (fnb-types/client hot-reload via packages-watch; pages) → Phase 4. User
touchpoints: the rebuild and the Phase 4 sign-off.

## Out of scope / linked (spec README Open Questions — all deferred)

Draw detection (40-ply/repetition), optional-capture & international 10×10 variants, stronger
(minimax) algorithm, consecutive-agent N-player loop, agent cost logging, and the platform's
still-open interactive-browser-E2E item if the browser tool remains unreachable at build time.
