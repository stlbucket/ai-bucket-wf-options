---
name: game-event-workflow
description: The game-event n8n workflow — the referee for all gameplay events. Node graph, referee Code-node contract (event-sourced actions list), the machine move-selection algorithm (full source), the agent (Anthropic) branch with fallback, error handling, and verification.
---

# `game-event` — the n8n gameplay workflow (the referee)

## Status
Draft — decisions locked 2026-07-19 (see `README.md`). No `[FILL IN]` markers.

One execution per trigger (setup, or one-or-more pending events to process). Definition is
code: `n8n/workflows/game-event.json`, imported **active** at boot; Code-node sources are
embedded from `packages/game-engines` by the embed script (`infrastructure.md` §1 — never
hand-edit `jsCode`).

---

## Trigger

- Webhook node: path `game-event`, header-auth credential `fnb-webhook-secret`
  (`X-Fnb-Webhook-Secret`), **Respond Immediately** (R22 n8n invariant).
- Payload (from the `triggerWorkflow` plugin): `{ op: 'setup' | 'event', gameId, tenantId, profileId }`.
- Callers: `useGames.createGame` (op `setup`, right after `createGame` mutation) and
  `useGame.submitEvent`/`resign` (op `event`, right after the mutation). Re-triggering
  `event` is the recovery path for stranded pending events (referee no-ops when there is
  nothing to do; `record_referee_result`'s advisory lock + still-pending re-check makes
  concurrent duplicates harmless).

## Node graph

```
Webhook (respond immediately)
  → PG: begin_run            select n8n_fn.begin_run('game-event', $execution.id, <payload>, <tenantId>)
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

Input: the `engine_context` jsonb (`{ game, gameType, players, gameState, playerViews,
pendingEvents }` — `gameType` is the registry row (seat bounds, `supportedPlayerKinds`,
`defaultConfig`), `players` the seat roster (seat, kind, outcome, resigned), `gameState`/
`playerViews` the **latest applied snapshot** (null before setup), `pendingEvents` **all**
pending events oldest-first — several seats may have one) + the webhook `op`. Dispatches on
`gameType.id` (battleship + checkers today — see `checkers/engine-workflow.data.md`;
unknown/unimplemented id → throw → error-handler).

The referee builds an ordered **`actions` list** (the `record_referee_result` contract,
`_shared.data.md`) — each applied action carries its own `stateAfter`/`viewsAfter` snapshot,
so the event stream stays replayable step by step. Empty list = noop.

Behavior:
- **op `setup`** (status must be `lobby`, else noop): re-validate the roster against
  `gameType` (defense-in-depth — `game_fn.create_game` already enforced the registry
  bounds/kinds; battleship: exactly 2 seats) — illegal → `{ actions: [], gameStatus:
  'abandoned', abortReason: 'illegal_roster' }`; legal → `createInitialGameState()` per seat
  (random fleet placement; board size from `gameType.defaultConfig`), dehydrate, compute a
  view per seat → one **`system` `setup` action**. `eventData` is a **non-secret marker only**
  (`{ gameType, boardSize }`) — `game.game_event` is tenant-readable once applied, so the
  generated fleet layout goes ONLY into `stateAfter` (the deny-all `game_event_state` table),
  never into `eventData` (caught live during verification: a cross-seat check showed both
  fleets leaking through `event_data` before this was locked down). `expectingSeats: [1]`,
  `gameStatus: 'in_progress'`.
- **op `event`** (no pending events or game not `in_progress` → noop): process pending
  events **oldest-first**. Per event:
  - `resign`: always accepted — `apply` action (state unchanged, views unchanged), seat
    marked resigned; if one active seat remains → `gameStatus: 'complete'` + `outcomes`.
  - `move` from a seat not in `expecting_seats` → `reject` action (`not_expected`).
  - `move` from an expected seat: engine-validate (in-bounds, not already fired — engine
    `applyMove` throws are caught and mapped) → `reject` with reason, or `apply` with the
    new snapshot. **Whether the phase advances is the engine's call**: battleship advances
    the expectation after every applied move (round-robin ascending, skipping resigned — for
    2 seats, strict alternation); a simultaneous-phase game (blackjack bets, trivia answers)
    holds `expectingSeats` at the not-yet-submitted seats and only resolves the phase when
    the last expected event applies.
- **Machine events** (after processing, **loop** while the game is `in_progress` and
  `expectingSeats` contains machine seats — per-seat `player_kind`, locked decision):
  - `machine_algorithm` seat: run `selectMachineMove(views[seat])` (below) **inside the same
    Code node**, append a `machine` action with its snapshot, and continue the loop (an
    all-human expectation or a terminal state ends it).
  - `machine_agent` seat: emit `needsAgentMove: true` + `agentContext` (the seat number, that
    seat's redacted view + legal-move list) and **stop the loop without applying** — the HTTP
    branch completes it. The current graph makes at most **one** agent call per execution —
    sufficient for every 2-seat game; consecutive agent seats in a future N-player game need
    an n8n loop (deferred, README Open Questions).
- Output: the `record_referee_result` contract (`actions`, `expectingSeats`, `gameStatus`,
  `outcomes?`, `abortReason?`), plus `needsAgentMove: boolean`, `agentContext?`.

## The machine move-selection algorithm (canonical: `game-engines/src/battleship/select-move.ts`)

Hunt/target with parity. Operates **only on the acting machine seat's redacted view**
(fairness — locked decision):

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
  "system": "{{ $json.result.agentContext.system }}",   // ENGINE-SUPPLIED per game type
  "messages": [{ "role": "user", "content": "{{ JSON.stringify($json.result.agentContext) }}" }]
}
```

**The system prompt is game-agnostic** (generalized when checkers landed, 2026-07-20): each
engine's referee puts its own prompt on `agentContext.system` (battleship's wording lives
verbatim in `game-engines/src/battleship/referee.ts` `BATTLESHIP_AGENT_SYSTEM`; checkers'
in `checkers/referee.ts` `CHECKERS_AGENT_SYSTEM`), so this node carries **no** game-specific
text and never changes when a new game type is added. The prompt receives **only**
`agentContext` (the machine seat's redacted view + legal moves) — never `game_state`
(fairness lock).

**Code node `parse-agent-move`** (embedded from `game-engines` — dispatches by game type via
`completeAgentMove(ctx, referee, text)`):
1. Each engine parses + validates its own reply shape (battleship: `{row,col}` targeting an
   `'unknown'` cell; checkers: `{moveIndex}` into the enumerated `legalMoves`).
2. Invalid / unparseable / illegal → **fall back to the game's `selectMachineMove`** (locked
   decision — games never wedge on a bad completion). Record `agentFallback: true` in the
   result summary.
3. Apply the chosen move exactly as the referee's algorithm path does (same embedded engine
   code) and append the `machine` action (with its `stateAfter`/`viewsAfter` snapshot) to the
   `actions` list flowing to `record_referee_result`.

## Writes + notifications

`game_fn.record_referee_result` applies the whole `actions` list atomically and serially
(`pg_advisory_xact_lock` on the game id, then an `expectedEventCount` version check that
discards the WHOLE result as a stale noop if any other execution has written since this
one's `engine_context` read — concurrent duplicates noop cleanly, confirmed live under a
3-way concurrent trigger): assigns dense `event_number`s, writes event rows + one
`game_event_state` snapshot per
applied action, updates `game.game` (`expecting_seats`, `event_count`, status) and, on
completion, `game_player.outcome` per seat. Each `game.game` UPDATE fires
`pg_notify('game:{id}:state', …)` (clients refetch idempotently). `complete_run` records
`{ appliedEvents, rejectedEvents, machineEvents, agentFallback: bool, gameStatus }` as
`result_data`.

## Failure & recovery

| Failure | Outcome |
|---|---|
| Any node throws (bad game_type id, engine invariant, PG error, Anthropic 4xx after retries with no fallback path reached) | error-handler → `n8n_fn.error_run_by_execution` → terminal `error` run row; pending events stay `pending` |
| Stranded pending event (execution died) | Re-trigger `op: 'event'` (resubmitting is blocked by the one-pending-per-seat unique index; the composable exposes retry on the detail page). Pending events are processed oldest-first, idempotently |
| Concurrent duplicate executions | `record_referee_result`'s `expectedEventCount` version check discards the loser's entire result as a stale noop — no double-apply, even for the referee's own `system`/`machine` events (verified live: a 3-way concurrent trigger produced exactly one apply + one machine reply, two clean `stale_context` noops) |
| Duplicate/rogue trigger | Referee returns empty `actions`; run completes with a noop summary |
| Game stuck in `lobby` (lost setup trigger) | Detail page re-fires the `setup` trigger when it loads a stale `lobby` game (setup no-ops unless still `lobby`) |
| Agent responds illegally | Algorithm fallback (`agentFallback: true`) — never an error |

## Verification (Phase 3 — run live 2026-07-20, all passing)

1. **`setup`**: created a vs-algorithm game via `game_fn.create_game` → triggered `op: 'setup'`
   → `game.game` → `in_progress`, `expecting_seats = {1}`, `event_count = 1` (the `setup`
   system event), a `game_event_state` row at `event_number` 1, `n8n.workflow_run` success.
2. **PvP event**: submitted a move → triggered `op: 'event'` → event `applied` at
   `event_number` 2, expectation flipped to seat 2.
3. **Algorithm reply**: human event + machine event both applied in the same execution
   (`event_number` 2 and 3, one snapshot each; `appliedEvents: 2, machineEvents: 1`).
4. **Agent reply**: vs-agent move → the real Anthropic HTTP call succeeded and returned a
   legal move in one execution (`appliedEvents: 2, machineEvents: 1, agentFallback: false`);
   the fallback path itself is covered by `game-engines` vitest (`completeAgentMove` with a
   garbage completion), not repeated live.
5. **Rejection**: submitted a repeated-cell move → `rejected` with `rejection_reason:
   already_fired`, **no `event_number`, no snapshot**, expectation unchanged.
6. **Concurrent duplicates**: fired 3 simultaneous `op: 'event'` triggers against one pending
   move → exactly **one** execution applied (human move + one machine reply); the other two
   recorded `{ recorded: false, noop: true, reason: 'stale_context' }` — confirming the
   `expectedEventCount` guard (added after the *first* attempt at this test caught a real bug:
   without it, two racing executions each independently computed and inserted their OWN
   machine reply from a stale read, corrupting the log with two machine moves for one human
   move — the advisory lock alone did not prevent this since it only serializes the write,
   not the JS computation each execution did beforehand).
7. **Error path**: triggered with a nonsense `gameId` → terminal `error` `n8n.workflow_run`
   row (`Cannot read properties of undefined…`) via the shared `error-handler`.
8. **Resign**: resigned a vs-agent game → `resign` event applied,
   `game_player.outcome = 'lost'`/`'won'`, `game.status = 'complete'`, `finished_at` set.
9. **Pending visibility (RLS)**: with a pending move from seat 1, a `SET ROLE authenticated`
   session simulating seat 2's claims could **not** see that pending row — but this surfaced
   a real bug: the *applied* `setup` event's `event_data` was found to contain the **full
   unredacted state (both fleets' ship positions)**, readable by any tenant member (the
   pending-visibility policy only gates `pending` rows; applied rows are tenant-readable by
   design, exactly as documented — the bug was that `setup`'s `event_data` held the secret
   in the first place). **Fixed**: `setup`'s `event_data` is now a non-secret marker only
   (`{ gameType, boardSize }`); the fleet layout lives solely in `stateAfter` → the deny-all
   `game_event_state` table (`_shared.data.md` — the fix is now the documented rule, not an
   afterthought). Re-verified after the fix: no ship data reachable outside `game_fn.player_view`.
10. **Win + replay**: walked `game_fn.player_view(game, resident, n)` for `n = 1..event_count`
    on a finished game, **forward and backward** (a resign-ended game, live) — every step
    returned a coherent view, `NULL` (live) matched the latest snapshot exactly. A full
    algorithm-vs-algorithm win-by-sinking-every-ship walk (rather than resign) is covered by
    `game-engines` vitest (`referee.spec.ts` — "detects the win and emits per-seat outcomes"),
    not repeated live.
