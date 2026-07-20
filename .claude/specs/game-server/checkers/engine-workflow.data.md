---
name: checkers-engine-workflow
description: The checkers game-engines module (engine, legal-move generator, views, referee, select-move, agent), its case in the top-level referee dispatcher, the generalized game-agnostic agent branch delta to the game-event n8n workflow, the embed step, and the vitest matrix.
---

# Checkers — Engine + Workflow

## Status
Draft — decisions locked 2026-07-20 (see `README.md`). No `[FILL IN]` markers.

Read the parent `../game-event.workflow.data.md` and `../infrastructure.md` §1 first — the
node graph, the `record_referee_result` actions contract, the embed script, and the vitest
conventions are the platform's and are **not** re-specified here. This file covers only the
new `checkers/` module and the one workflow change (generalizing the agent branch).

---

## 1. `packages/game-engines/src/checkers/` (new module)

```
src/checkers/
├── engine.ts          # board model + apply a validated move → new state; win/no-move detection
├── legal-moves.ts     # enumerate legal moves for a seat under English rules (forced capture,
│                       #   maximal jump chains, kinging-ends-turn)
├── views.ts           # per-seat view: identity board + yourSeat/toMove/lastMove/legalMoves
├── serialize.ts       # identity hydrate/dehydrate (state is JSON-native — no Set)
├── referee.ts         # setup / validate+apply / expectation + outcome → ordered actions list
├── select-move.ts     # machine algorithm: forced-capture-aware heuristic over the seat's view
└── agent.ts           # agent system prompt (checkers) + completeAgentMove(payload, text, rand)
```

### `engine.ts`

- **State**: `{ boardSize: 8, board: (CheckersPiece|null)[][], moveCount }` — 8×8, row 0 top.
  Playable square ⟺ `(row + col) % 2 === 1`. `createInitialState(boardSize = 8)`: seat 1 (red)
  men on rows 5–7 dark squares, seat 2 (black) men on rows 0–2 dark squares (12 each).
- **`applyMove(state, seat, move)`** — assumes `move` is already validated legal (the referee
  calls `legalMoves` first): walk `move.path` from `move.from`, removing each jumped piece
  (midpoint of each two-step hop), moving the piece to the final square, crowning it if it
  lands on the far row (seat 1 → row 0, seat 2 → row 7) **and ending the move** (no post-crown
  continuation — enforced by `legal-moves.ts` never emitting such a chain), `moveCount++`.
  Returns the new state. Throws on any inconsistency (referee treats as engine bug).
- **`hasAnyMove(state, seat)`** and **`pieceCount(state, seat)`** for win detection.

### `legal-moves.ts` — the ruleset (English/American draughts)

`legalMovesFor(state, seat): CheckersLegalMove[]`:
1. Directions: a **man** for seat 1 moves toward row 0 (`dr = -1`), seat 2 toward row 7
   (`dr = +1`), both `dc = ±1`; a **king** moves all four diagonals.
2. **Captures** (single hop): from a square, over an adjacent enemy piece to the empty square
   beyond. Enumerate all capture chains by DFS: after a jump, if the **same** piece can jump
   again (from its new square, respecting man/king directions), continue; a chain terminates
   when no further jump exists **or** the piece just reached the crowning row (kinging ends the
   turn). Each maximal chain is one `CheckersLegalMove` (`path` = landing squares, `captures`
   = jumped squares).
3. **Forced capture**: if the seat has **any** capture, return **only** captures (all of them —
   free choice among pieces; **no** maximal-length restriction). Otherwise return the simple
   slides (one-step diagonal to an empty square).
4. A capture may not jump the same piece twice in one chain; a man promoted mid-implementation
   is handled by rule 2's kinging-terminates clause.

This one function is the single source of checkers rule truth — consumed by `referee.ts`
(validation), `select-move.ts`, `agent.ts`, and surfaced in the view for the UI.

### `views.ts`

`computeViews(state, toMoveSeat, lastMove): { [seat]: CheckersPlayerView }` — for each seat:
the **same** full `board`, `yourSeat`, `toMove`, `lastMove`, and `legalMoves` populated **only**
for `seat === toMoveSeat` (via `legalMovesFor`), empty otherwise. Identity redaction (no hidden
info) — but structurally the same per-seat-view contract battleship uses, so
`record_referee_result` stores it in `player_views_after` unchanged.

### `referee.ts` — checkers dispatch target (`context, op) → actions payload`

Called by the top-level `src/referee.ts` when `gameType.id === 'checkers'`. Builds the
platform's ordered `actions` list (parent contract) with per-action `stateAfter`/`viewsAfter`
snapshots:
- **op `setup`** (status `lobby`): re-validate the roster (exactly 2 seats — defense-in-depth;
  `create_game` already enforced it via the registry) → illegal ⇒
  `{ actions: [], gameStatus: 'abandoned', abortReason: 'illegal_roster' }`. Legal ⇒
  `createInitialState(gameType.defaultConfig.boardSize ?? 8)`, compute views (seat 1 to move) →
  one **`system` `setup` action** with `eventData: { gameType: 'checkers', boardSize }`
  (non-secret marker) and the initial board in `stateAfter`. `expectingSeats: [1]`,
  `gameStatus: 'in_progress'`.
- **op `event`** (no pending events / not `in_progress` ⇒ noop): process pending events
  oldest-first. Per event:
  - `resign`: platform-generic — accepted, seat resigned, one active seat left ⇒ complete +
    outcomes (unchanged from battleship).
  - `move` from a seat ∉ `expecting_seats` ⇒ `reject` (`not_expected`).
  - `move` from the expected seat: compute `legalMovesFor(state, seat)`; if the submitted
    `{from, path}` is **not** structurally one of them ⇒ `reject` with reason
    (`illegal_move`, or `not_a_legal_capture` when captures were forced and a slide was sent);
    else `applyMove` → `apply` action with the new snapshot. Then **check the opponent**:
    `pieceCount(opp) === 0 || !hasAnyMove(opp)` ⇒ `gameStatus: 'complete'`,
    `outcomes: { mover: 'won', opp: 'lost' }`, `expectingSeats: []`; otherwise flip
    `expectingSeats` to the opponent (round-robin ascending, skipping resigned — for 2 seats,
    strict alternation, exactly the platform's generic rule).
- **Machine loop** (identical structure to battleship): while `in_progress` and
  `expectingSeats` contains a machine seat —
  - `machine_algorithm`: `selectMachineMove(view)` → append a `machine` action + snapshot,
    re-run the opponent win-check, continue.
  - `machine_agent`: emit `needsAgentMove: true` + `agentContext` (below) and **stop** — the
    HTTP branch completes it (≤ 1 agent call per execution; sufficient for 2 seats).
- Output: the platform contract (`actions`, `expectingSeats`, `gameStatus`, `outcomes?`,
  `abortReason?`, `expectedEventCount`) + `needsAgentMove` + `agentContext?`.
- **Machine-loop termination guard** (implementation note): unlike battleship (every shot
  consumes a board cell ⇒ finite), checkers has no draw rule in v1, so two kings could shuffle
  forever. In production seat 1 is always human, so the inline machine loop runs ≤ 1 move per
  execution and never approaches this — but a both-machine config (or a future N-player game)
  could otherwise hang the referee. `runMachineLoop` therefore carries a defensive
  `MACHINE_LOOP_CAP` (500): on the (unreachable-in-prod) cap it breaks safely, leaving the game
  `in_progress`, instead of looping forever. A real draw rule (40-ply/repetition) is the
  deferred open question.

### `select-move.ts` — the machine algorithm (fairness: own view only)

```ts
import type { CheckersPlayerView, CheckersLegalMove } from '@function-bucket/fnb-types'

// Operates ONLY on the acting seat's redacted view (identity here, but the same fairness
// contract as battleship). Never illegal — always returns one of view.legalMoves.
export function selectMachineMove(
  view: CheckersPlayerView,
  rand: () => number = Math.random,
): CheckersLegalMove {
  const moves = view.legalMoves
  if (!moves.length) throw new Error('No legal moves remain')      // referee treats as engine bug
  // Forced capture already guarantees moves are captures when any exist. Prefer the longest
  // capture chain (most pieces taken); among ties, and among non-captures, pick at random.
  const maxCap = Math.max(...moves.map((m) => m.captures.length))
  const best = moves.filter((m) => m.captures.length === maxCap)
  return best[Math.floor(rand() * best.length)]
}
```

(`rand` injectable for deterministic vitest. A stronger minimax is a deferred open question —
this keeps parity with battleship's "good-enough hunt/target" heuristic.)

### `agent.ts` — the checkers agent contract

```ts
export const CHECKERS_AGENT_SYSTEM =
  "You are playing Checkers (English draughts, 8x8). You will be given your view of the " +
  "board and a numbered list `legalMoves` of every move you may legally make (captures are " +
  "forced when present). Choose the strongest move. Respond with ONLY a JSON object " +
  '{"moveIndex": <n>} where n is the 0-based index into legalMoves. No prose.'

// Parse + validate the agent reply; fall back to the algorithm on anything unusable.
export function completeAgentMove(
  view: CheckersPlayerView,
  responseText: string,
  rand: () => number = Math.random,
): { move: CheckersLegalMove; fallback: boolean } {
  try {
    const obj = JSON.parse(firstJsonObject(responseText))
    const i = obj.moveIndex
    if (Number.isInteger(i) && i >= 0 && i < view.legalMoves.length)
      return { move: view.legalMoves[i], fallback: false }
  } catch { /* fall through */ }
  return { move: selectMachineMove(view, rand), fallback: true }   // locked: games never wedge
}
```

Index-based selection (vs. battleship's free-form `{row,col}`) makes the agent reply trivially
validatable and the fallback safe — the agent can only ever return a legal move or trigger the
algorithm.

## 2. Top-level dispatcher (`src/referee.ts`) — add checkers

```ts
switch (context.gameType.id) {
  case 'battleship': return battleshipReferee(context, op)
  case 'checkers':   return checkersReferee(context, op)     // NEW
  default: throw new Error(`unimplemented game type: ${context.gameType.id}`)
}
```

Same for the agent-completion dispatch consumed by `parse-agent-move` (below):

```ts
export function completeAgentMove(gameTypeId, view, responseText, rand) {
  switch (gameTypeId) {
    case 'battleship': return battleshipCompleteAgentMove(view, responseText, rand)
    case 'checkers':   return checkersCompleteAgentMove(view, responseText, rand)
    default: throw new Error(`unimplemented game type: ${gameTypeId}`)
  }
}
```

## 3. Generalize the agent branch in `game-event.json` (the one workflow change)

Today the workflow is game-agnostic **except** the agent branch, which hardcodes battleship's
prompt in the HTTP node's `system` field. Generalize it so every game type — checkers and all
future ones — needs **zero** workflow edits:

1. **Referee output** — `agentContext` gains an engine-supplied `system` string and carries a
   `payload` (the acting seat's redacted view + `legalMoves`):
   `agentContext = { gameType, system, payload }`. Battleship's `agent.ts` supplies its
   existing prompt **verbatim** as its `system` (moved out of the node, no wording change).
2. **HTTP `anthropic-move` node** — change only two expression fields (model, headers, retry,
   credential all unchanged):
   - `system` ← `{{ $json.agentContext.system }}` (was the hardcoded battleship string)
   - user content ← `{{ JSON.stringify($json.agentContext.payload) }}`
3. **`parse-agent-move` Code node** (embedded) — dispatch by `gameType`:
   `completeAgentMove(agentContext.gameType, agentContext.payload, responseText)` → append the
   chosen move as a `machine` action with its snapshot (record `agentFallback` in the run
   summary). Battleship's parse/validate/fallback moves into `battleship/agent.ts` verbatim.

This is a Mode-3 change to the platform — **update the parent
`../game-event.workflow.data.md` §agent branch and `../_shared.data.md` (the `record_referee_result`
`agentContext` shape) in the same change (R21)**. Battleship behavior is unchanged (its prompt
and `{row,col}` reply contract are identical, just sourced from `agent.ts`).

## 4. Embed + build

- `scripts/embed.ts` is unchanged in shape — it bundles `src/referee.ts` (which now imports
  both `battleship/` and `checkers/`) and rewrites the `jsCode` of nodes `referee` and
  `parse-agent-move` in `n8n/workflows/game-event.json`. Re-run
  `pnpm --filter @function-bucket/fnb-game-engines embed` after the checkers module lands, then
  export the workflow **active**. The bundle-hash drift vitest asserts JSON ↔ source parity.
- No new external deps (esbuild already catalogued for battleship).

## 5. vitest matrix (`src/tests/checkers.*.spec.ts`)

House testing convention (own `vitest.config.ts`, deterministic `rand`):
- **Legal-move generation**: opening position (7 slides for red), forced-capture position
  (only captures returned), a **multi-jump** chain enumerated as one move, a **kinging** move
  terminating the chain, king omnidirectional moves, men-cannot-move-backward.
- **applyMove**: piece moved, jumped pieces removed, crowning on the far row, `moveCount`++.
- **Win detection**: opponent with 0 pieces ⇒ complete + outcomes; opponent with pieces but
  **0 legal moves** (blocked) ⇒ complete + outcomes.
- **Referee**: setup emits one `system` action with a non-secret `eventData` marker + full
  board in `stateAfter`; a legal move ⇒ `apply` + flipped expectation; an illegal move / a
  slide when a capture was forced ⇒ `reject` with the right reason and unchanged expectation;
  algorithm-vs-algorithm game plays to a terminal win (per-seat outcomes).
- **Views**: identity board for both seats; `legalMoves` populated only for the seat to move;
  no board mutation across `computeViews`.
- **Selector**: never returns an illegal move; prefers the longest capture; deterministic with
  a seeded `rand`.
- **Agent**: `completeAgentMove` parses a valid `{moveIndex}`, and **falls back** to the
  algorithm on out-of-range / non-integer / garbage / non-JSON (`fallback: true`).
- **Drift alarm**: the embedded bundle hash in `game-event.json` matches the freshly built
  bundle (shared with battleship's test).

## 6. Live verification (at/after the USER REBUILD GATE — read-only)

Mirror the platform's Phase-3 matrix for checkers against the running stack: setup → `setup`
event + snapshot + `expecting_seats {1}`; a PvP slide applies and flips the turn; a **forced
capture** and a **multi-jump** apply as single events; a **kinging** move crowns and ends the
turn; an **algorithm reply** lands same-execution; an **agent reply** (real Anthropic call via
the now-generalized branch) lands, and the fallback is covered by vitest; an **illegal move**
is `rejected` with a reason and no snapshot; a **resign** completes with per-seat outcomes; a
**win by no legal moves** completes; the **replay scrubber** walks fwd/back over a finished
game; a **3-way concurrent** trigger yields exactly one apply + `stale_context` noops
(the platform's `expectedEventCount` guard — unchanged). Confirm **battleship still works**
after the agent-branch generalization (one vs-agent battleship move end to end).
