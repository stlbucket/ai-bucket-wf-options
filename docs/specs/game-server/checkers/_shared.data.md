---
name: checkers-shared
description: Checkers-specific shared data on the game-server platform — the game_type registry seed flip, the checkers state-shape + per-seat view contracts, fnb-types additions, and the client-layer deltas (view union + move-toast narrator). Everything not listed here is the platform's parent _shared.data.md, reused unchanged.
---

# Checkers — Shared Data

## Status
Draft — decisions locked 2026-07-20 (see `README.md`). No `[FILL IN]` markers.

**Read the parent `../_shared.data.md` first.** This file documents only what is
checkers-specific. The `db/fnb-game` schema (tables, RLS, `game_fn`/`game_api`,
`n8n_worker` grants, `pg_notify` trigger, PostGraphile exposure, the `triggerWorkflow`
registry entry, the WebSocket layer) is **unchanged** — checkers adds **no DDL**.

---

## 1. The only DB change — flip the `game.game_type` seed row

The `checkers` row already exists in the `fnb-game` deploy change (seeded `coming_soon`).
Edit it **in place** (dev rebuilds from scratch — the same edit-in-place pattern the nav and
the other seed rows use; no new sqitch change, no migration in this repo's dev model):

| id | name | icon | ordinal | status | min/max seats | supported_player_kinds | default_config |
|---|---|---|---|---|---|---|---|
| `checkers` | Checkers | `i-lucide-circle-dot` | 2 | **`live`** | 2 / 2 | **`{human, machine_algorithm, machine_agent}`** | **`{"boardSize": 8}`** |

That single row flip is the entire DB surface. Consequences fall out of the platform:
- `game_fn.create_game` now accepts `_game_type_id = 'checkers'` (status `live`), 2 seats
  within `min/max`, and machine kinds because they are in `supported_player_kinds` — the same
  registry-driven validation battleship gets (errors `30003`–`30005` unchanged).
- The New Game modal's machine options light up for checkers (they read `supportedPlayerKinds`
  via `useGameTypes()`).
- `default_config.boardSize = 8` is passed to the referee's setup exactly as battleship's `10`.
- The `games-checkers` nav tool already routes to `/tenant/games/checkers` (R14) — **no nav
  change**; the page behind that route becomes the real list instead of Coming Soon.

---

## 2. State-shape contract (`game_state_after` — checkers)

jsonb, engine-owned, DB-agnostic (parent §State-shape contracts). Written **only** to the
deny-all `game.game_event_state` snapshot, exactly like battleship.

```jsonc
{
  "gameType": "checkers",
  "boardSize": 8,
  // 8×8 grid, row 0 at the top. Non-playable (light) squares are always null.
  // A piece: { "seat": 1 | 2, "king": bool }. Seat 1 = red (starts rows 5–7, moves toward row 0);
  // seat 2 = black (starts rows 0–2, moves toward row 7). Playable square ⟺ (row + col) is odd.
  "board": [
    [null, {"seat":2,"king":false}, null, {"seat":2,"king":false}, ...],
    ...
  ],
  "moveCount": 12          // applied moves so far (parity ⇒ whose turn, but expecting_seats is authoritative)
}
```

There is **no hidden information** — this authoritative state is identical to what each seat
may see (unlike battleship, where per-seat views redact the opponent fleet). It still lives in
the deny-all table so the platform's snapshot/replay path is used with no special case.
`moveCount` is convenience; expectation/outcome/status live on `game.game`/`game_player`
columns and are returned separately by `record_referee_result` (`expectingSeats`, `outcomes`),
same as battleship.

Serialization: checkers state is **JSON-native** (no `Set` — contrast battleship's
`PlacedShip.hits`), so `checkers/serialize.ts` is an identity `hydrate`/`dehydrate` pair kept
only for a uniform referee interface (`engine-workflow.data.md`).

## 3. Per-seat view contract (`player_views_after` — checkers)

```jsonc
{
  "1": {
    "seat": 1,
    "boardSize": 8,
    "board": [ /* the SAME full board as game_state_after — checkers hides nothing */ ],
    "yourSeat": 1,
    "toMove": 1,              // whose turn it is (mirrors expecting_seats' single seat)
    "lastMove": { "seat": 2, "from": {"row":2,"col":3}, "path": [{"row":3,"col":4}], "captured": [] },
    // Populated ONLY in the view of the seat to move (empty otherwise) — the enumerated legal
    // moves that seat may submit; the UI highlights these and the machine/agent pick from them.
    "legalMoves": [
      { "from": {"row":5,"col":2}, "path": [{"row":4,"col":3}], "captures": [] },
      { "from": {"row":5,"col":4}, "path": [{"row":3,"col":2},{"row":1,"col":4}],
        "captures": [{"row":4,"col":3},{"row":2,"col":3}] }   // a chained double jump
    ]
  },
  "2": { /* same board; yourSeat 2; legalMoves empty when it is seat 1's turn */ }
}
```

- **Both seats' `board` are identical** (full, public). The only per-seat differences are
  `yourSeat` and whose `legalMoves` are populated. This is the platform's per-seat redaction
  contract satisfied by an **identity** redaction — machine fairness (parent security table)
  holds trivially: a machine seat still selects only from *its own view's* `legalMoves`.
- `legalMoves` is the **complete enumeration** for the acting seat under English rules: if any
  capture exists, only captures appear (forced capture); each capturing entry's `path` is a
  full maximal jump chain for that piece; `captures` lists the jumped squares. The referee, the
  algorithm, the agent, and the UI all consume this one list — no rule logic is duplicated.
- `lastMove` drives the board's "just moved" highlight and the move-toast narrator.

## 4. Event-data shapes (public — `game_event` is tenant-readable once applied)

- **`move`** `event_data`: `{ "from": {"row","col"}, "path": [{"row","col"}, ...] }` — the
  full move the seat submits (one entry for a slide; the ordered landing squares for a jump
  chain). Public knowledge; safe in the tenant-readable event log.
- **`setup`** `event_data`: the platform's **non-secret marker only** —
  `{ "gameType": "checkers", "boardSize": 8 }`. (Checkers has no secret, but the marker rule
  is kept uniform with battleship; the full initial board goes to `game_state_after` in the
  deny-all snapshot as always.)
- **`resign`**: no payload — platform-generic.

The referee validates a submitted `{from, path}` by checking it is **exactly one of** the
enumerated `legalMoves` for that seat (structural equality on `from` + `path`); anything else
is a `reject` action with a reason (`not_expected`, `illegal_move`, `not_a_legal_capture` when
a capture was forced). Same `apply`/`reject`/`machine` action contract as battleship
(parent `record_referee_result` input contract) — **no contract change**.

---

## 5. fnb-types additions (`packages/fnb-types/src/games/checkers-view.ts` + barrel)

`GameTypeId` in `src/game.ts` **already includes** `'checkers'` — no edit there. Add the view
vocabulary (plain type declarations — fnb-types stays type-only):

```ts
// games/checkers-view.ts
export interface CheckersSquare { row: number; col: number }
export interface CheckersPiece { seat: number; king: boolean }
export type CheckersCell = CheckersPiece | null            // null = empty or non-playable square

export interface CheckersLegalMove {
  from: CheckersSquare
  path: CheckersSquare[]          // ordered landing squares (1 = slide; ≥1 = jump chain)
  captures: CheckersSquare[]      // squares jumped (empty for a slide)
}

export interface CheckersMove {   // submitted event_data + lastMove shape
  seat?: number
  from: CheckersSquare
  path: CheckersSquare[]
  captured?: CheckersSquare[]
}

export interface CheckersPlayerView {
  seat: number
  boardSize: number
  board: CheckersCell[][]         // full board — checkers hides nothing
  yourSeat: number
  toMove: number
  lastMove: CheckersMove | null
  legalMoves: CheckersLegalMove[] // populated only in the seat-to-move's own view
}
```

Barrel: add `export * from './games/checkers-view'` alongside the existing
`games/battleship-view` line.

---

## 6. Client-layer deltas (Mode-3 tweaks — no new documents, no new composables)

The GraphQL documents (`myGames`, `gameById`, `gameViewAt`, `gameTypes`, `createGame`,
`submitEvent`, `resignGame`, `triggerWorkflow`) and the composables (`useGames`, `useGame`,
`useGameTypes`) are **game-agnostic and reused verbatim**. Two small changes make the
generic `view` blob typable by checkers pages:

1. **Widen the view union** — in `packages/graphql-client-api`, the `useGame` composable's
   live/replay `view` type becomes:

   ```ts
   import type { BattleshipPlayerView, CheckersPlayerView } from '@function-bucket/fnb-types'
   export type GamePlayerView = BattleshipPlayerView | CheckersPlayerView
   ```

   `useGame` still returns the raw `gameView` jsonb typed as `GamePlayerView | null`; each
   page narrows by `game.value?.gameTypeId` (battleship page casts to `BattleshipPlayerView`,
   checkers page to `CheckersPlayerView`). No behavior change for battleship.

2. **Dispatch the move-toast narrator by `gameTypeId`** — `useGame`'s `lastEvents`/`view`-diff
   narration (parent battleship `[id].data.md`) becomes a small per-game-type dispatch. The
   checkers narrator is **light** (moves are public and shown on the board): from `lastMove`
   it emits at most `"They moved"`, `"Captured {n}"`, and `"Kinged!"` — suppressed while
   `isReplaying`, same as battleship. Keeping the dispatch in the composable preserves R1/R2
   (no transport/derivation in the page/component).

Tenant-app re-exports (`useGames`/`useGame`/`useGameTypes`) already exist and are unchanged —
they serve both game types.

---

## 7. What is explicitly unchanged (reused from the platform)

`game.game`/`game_player`/`game_event`/`game_event_state` schema + RLS + the deny-all table;
`game_fn.engine_context`/`record_referee_result`/`player_view`/`create_game`/`submit_event`/
`resign_game`; the `n8n_worker` grants (still exactly two EXECUTEs); the `pg_notify` trigger +
channel; PostGraphile exposure + smart tags; the `game-event` registry entry; the
`game-layer`/`game-app` WebSocket topology; the replay scrubber mechanism; the
`p:app-user`/`p:app-admin` gating; `routeRules: { '/games/**': { ssr: false } }`. None of
these are touched — see the parent `_shared.data.md` and `infrastructure.md`.
