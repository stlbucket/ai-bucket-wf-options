---
name: game-move-workflow
description: The game-move n8n workflow — the referee for all gameplay. Node graph, referee Code-node contract, the machine move-selection algorithm (full source), the agent (Anthropic) branch with fallback, error handling, and verification.
---

# `game-move` — the n8n gameplay workflow (the referee)

## Status
Draft — decisions locked 2026-07-19 (see `README.md`). No `[FILL IN]` markers.

One execution per submitted move (or setup). Definition is code:
`n8n/workflows/game-move.json`, imported **active** at boot; Code-node sources are embedded
from `packages/game-engines` by the embed script (`infrastructure.md` §1 — never hand-edit
`jsCode`).

---

## Trigger

- Webhook node: path `game-move`, header-auth credential `fnb-webhook-secret`
  (`X-Fnb-Webhook-Secret`), **Respond Immediately** (R22 n8n invariant).
- Payload (from the `triggerWorkflow` plugin): `{ op: 'setup' | 'move', gameId, tenantId, profileId }`.
- Callers: `useGames.createGame` (op `setup`, right after `createGame` mutation) and
  `useGame.submitMove` (op `move`, right after `submitMove` mutation). Re-triggering `move` is
  the recovery path for a stranded pending move (referee no-ops when there is nothing to do).

## Node graph

```
Webhook (respond immediately)
  → PG: begin_run            select n8n_fn.begin_run('game-move', $execution.id, <payload>, <tenantId>)
  → PG: engine_context       select game_fn.engine_context(<gameId>)
  → Code: referee            (embedded from game-engines — contract below)
  → IF needsAgentMove?
      ├─ true  → HTTP: anthropic-move → Code: parse-agent-move (embedded) ─┐
      └─ false ──────────────────────────────────────────────────────────┤
  → PG: record_referee_result  select game_fn.record_referee_result(<gameId>, <result jsonb>)
  → PG: complete_run           select n8n_fn.complete_run(<runId>, <summary>)
```

All PG nodes use the `fnb-n8n-worker` Postgres credential. Fixed SQL text with parameters only
(no expression-built identifiers — dataset-sync locked rule). Workflow error settings point at
the shared **`error-handler`** workflow (must stay active), which records a terminal
`n8n.workflow_run` error row via `n8n_fn.error_run_by_execution`.

## Code node `referee` (embedded from `game-engines/src/referee.ts`)

Input: the `engine_context` jsonb (`{ game, gameState, pendingMove }`) + the webhook `op`.
Dispatches on `game.game_type` (battleship only; unknown type → throw → error-handler).

Behavior:
- **op `setup`** (status must be `lobby`, else `action: 'noop'`):
  `createInitialGameState()` per seat (random fleet placement), dehydrate, compute both views
  → `{ action: 'initialize', gameState, playerViews, currentTurnSeat: 1, gameStatus: 'in_progress' }`.
- **op `move`** (no pending move or game not `in_progress` → `action: 'noop'`):
  validate the oldest pending move — correct seat's turn, in-bounds, not already fired
  (engine `applyMove` throws are caught and mapped) → on failure
  `{ action: 'reject', moveId, rejectionReason }` (turn does not advance); on success apply to
  the opponent seat's board, recompute views, detect winner (a seat's board `status: 'won'`
  ⇒ that seat lost), alternate `currentTurnSeat`
  → `{ action: 'apply', moveId, gameState, playerViews, currentTurnSeat, gameStatus, winnerSeat }`.
- **Machine reply** (game still `in_progress`, next turn is seat 2, `opponent_kind` is machine):
  - `machine_algorithm`: run `selectMachineMove(playerViews["2"])` (below) **inside the same
    Code node**, apply it, and attach the full `machineMove` block to the output. Strict
    alternation ⇒ exactly one reply per human move — no n8n loop nodes needed.
  - `machine_agent`: emit `needsAgentMove: true` + `agentContext` (the machine seat's redacted
    view + legal-move list) and **do not** apply a machine move — the HTTP branch completes it.
- Output: the `record_referee_result` contract (`_shared.data.md`), plus
  `needsAgentMove: boolean`, `agentContext?`.

## The machine move-selection algorithm (canonical: `game-engines/src/battleship/select-move.ts`)

Hunt/target with parity. Operates **only on the machine seat's redacted view** (fairness —
locked decision):

```ts
import type { BattleshipPlayerView } from '@function-bucket/fnb-types'

export interface Cell { row: number; col: number }

/**
 * Selects the machine's next shot from its redacted view of the opponent board.
 * - TARGET mode: if any 'hit' cell is not part of a sunk ship, fire at a random
 *   orthogonal 'unknown' neighbor of a hit (finishes wounded ships).
 * - HUNT mode: otherwise fire at a random 'unknown' cell, preferring checkerboard
 *   parity cells (every ship of size ≥ 2 covers at least one parity cell).
 * Never repeats a shot; throws if no legal cell exists (referee treats as engine bug).
 */
export function selectMachineMove(view: BattleshipPlayerView, rand: () => number = Math.random): Cell {
  const size = view.boardSize
  const board = view.opponent.board // 'unknown' | 'hit' | 'miss' | 'sunk'
  const unknown: Cell[] = []
  const targets: Cell[] = []

  const inBounds = (r: number, c: number) => r >= 0 && r < size && c >= 0 && c < size

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (board[row][col] === 'unknown') unknown.push({ row, col })
      if (board[row][col] === 'hit') {
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const r = row + dr, c = col + dc
          if (inBounds(r, c) && board[r][c] === 'unknown') targets.push({ row: r, col: c })
        }
      }
    }
  }

  const pick = (cells: Cell[]) => cells[Math.floor(rand() * cells.length)]
  if (targets.length) return pick(targets)
  if (!unknown.length) throw new Error('No legal moves remain')
  const parity = unknown.filter(({ row, col }) => (row + col) % 2 === 0)
  return pick(parity.length ? parity : unknown)
}
```

(`'hit'` cells inside sunk ships are repainted `'sunk'` by the view computation, so TARGET mode
naturally ignores finished ships. `rand` is injectable for deterministic vitest coverage.)

## The agent branch (`machine_agent` only)

**HTTP Request node `anthropic-move`** — POST `https://api.anthropic.com/v1/messages`
- Auth: credential `anthropic-api-key` (httpHeaderAuth → `x-api-key`; `infrastructure.md` §4)
- Header: `anthropic-version: 2023-06-01`; retry on fail: 2 tries, ≤ 5 s wait (dataset-sync cap)
- Body:

```jsonc
{
  "model": "claude-haiku-4-5-20251001",        // locked default; env-override deferred
  "max_tokens": 100,
  "system": "You are playing Battleship. You will be given your view of the opponent board as JSON: a grid of 'unknown' | 'hit' | 'miss' | 'sunk' cells (your shots so far) plus the list of opponent ships already sunk. Choose the best next shot. Respond with ONLY a JSON object {\"row\": <0-9>, \"col\": <0-9>} targeting an 'unknown' cell. No prose.",
  "messages": [{ "role": "user", "content": "{{ JSON.stringify($json.agentContext) }}" }]
}
```

The prompt receives **only** `agentContext` (the machine seat's redacted view) — never
`game_state` (fairness lock).

**Code node `parse-agent-move`** (embedded from `game-engines` — shares the selector source):
1. Extract the first JSON object from the response text; validate: integers in bounds and the
   targeted cell is `'unknown'` in the machine's view.
2. Invalid / unparseable / illegal → **fall back to `selectMachineMove`** (locked decision —
   games never wedge on a bad completion). Record `agentFallback: true` in the result summary.
3. Apply the chosen move exactly as the referee's algorithm path does (same embedded engine
   code) and attach the `machineMove` block to the referee output flowing to
   `record_referee_result`.

## Writes + notifications

`game_fn.record_referee_result` applies everything atomically (move status + engine state +
`game.game` columns + optional machine move insert/apply). Each `game.game` UPDATE fires
`pg_notify('game:{id}:state', …)` — one notify for a plain apply/reject, two when a machine
reply lands (clients refetch idempotently). `complete_run` records
`{ action, moveStatus, machineMove: bool, agentFallback: bool, gameStatus }` as `result_data`.

## Failure & recovery

| Failure | Outcome |
|---|---|
| Any node throws (bad game_type, engine invariant, PG error, Anthropic 4xx after retries with no fallback path reached) | error-handler → `n8n_fn.error_run_by_execution` → terminal `error` run row; the pending move stays `pending` |
| Stranded pending move (execution died) | User re-triggers (resubmitting is blocked by the one-pending-move pre-check; the composable exposes retry on the detail page — or simply re-clicking after the rejection surfaces). `op: 'move'` processes the oldest pending move idempotently |
| Duplicate/rogue trigger | Referee `action: 'noop'`; run completes with a noop summary |
| Agent responds illegally | Algorithm fallback (`agentFallback: true`) — never an error |

## Verification (Phase 3)

1. `setup`: create a vs-algorithm game via GraphiQL → trigger → `game.game` `in_progress`,
   engine state row populated, both views present, `n8n.workflow_run` success.
2. PvP move: submit + trigger → move `applied`, `move_number` 1, turn flips, notify observed
   (`LISTEN` in psql).
3. Algorithm reply: vs-machine move → human move + machine reply both applied in one execution;
   two notifies.
4. Agent reply: vs-agent move → Anthropic call visible in the execution log; legal machine move
   applied. Force a garbage completion (temporarily bad prompt in the editor) → fallback move +
   `agentFallback: true`.
5. Rejection: submit an out-of-turn / repeated-cell move → `rejected` + reason, turn unchanged.
6. Error path: trigger with a nonsense `gameId` → error-handler → terminal `error` run row.
7. Win: play an algorithm game to completion (psql-driven shots at known fleet via
   `engine_context` as postgres superuser) → `complete`, `winner_seat` set, `finished_at` set.
