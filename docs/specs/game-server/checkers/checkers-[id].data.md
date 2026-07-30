# games/checkers/[id] — Checkers Detail Data

## Status
Draft — decisions locked 2026-07-20. No `[FILL IN]` markers. Types/permissions/WS contract:
parent `../_shared.data.md` + this dir's `_shared.data.md` (do not duplicate).

## Route
`/tenant/games/checkers/[id]` — see `checkers-[id].ui.md`.

## GraphQL

**No new documents.** Identical to `../battleship-[id].data.md`, parameterized by game id — the
`gameView` blob is interpreted as a `CheckersPlayerView`:

| Operation | `.graphql` file | Generated hook | Notes |
|---|---|---|---|
| `GameById($id: UUID!)` | `game/query/gameById.graphql` (existing) | `useGameByIdQuery()` | `Game` single lookup (summary + `gamePlayers` + `gameEvents`) + `gameView(gameId: $id)` — the caller's **live** view blob (a `CheckersPlayerView` for a checkers game) |
| `GameViewAt($gameId: UUID!, $eventNumber: Int!)` | existing | `useGameViewAtQuery()` | the replay scrubber's per-step view |
| `SubmitEvent($gameId: UUID!, $eventData: JSON!)` | existing | `useSubmitEventMutation()` | `eventData` = `{ from, path }` (the full checkers move); returns the pending `GameEvent` |
| `ResignGame($gameId: UUID!)` | existing | `useResignGameMutation()` | returns the pending `resign` `GameEvent` |
| `TriggerWorkflow` | existing | existing | `{ op: 'event', gameId }` after submit/resign; `{ op: 'setup', gameId }` on a stale `lobby` load (stuck-setup recovery) |

## WebSocket
`wss://{host}/game/_ws/games/{gameId}` — on `{ event: 'update' }` → re-execute `GameById`
`network-only`. Platform-generic, reused unchanged (parent `_shared.data.md` §WebSocket).

## Composable

**Reused**: `useGame(gameId)`
(`packages/graphql-client-api/src/composables/useGame.ts`, tenant-app re-export already
present). Two platform-level Mode-3 tweaks make it serve checkers (detailed in this dir's
`_shared.data.md` §6, applied once, no battleship behavior change):

1. `view`/`liveView` typed `GamePlayerView | null` (`BattleshipPlayerView | CheckersPlayerView`
   union) — the checkers page narrows by `gameTypeId`.
2. the move-toast narrator (`lastEvents`) dispatches by `gameTypeId`; the checkers narrator is
   light (moves are public and shown on the board): `"They moved"`, `"Captured {n}"`,
   `"Kinged!"`, suppressed while `isReplaying`.

Everything else — the hybrid WS + `network-only` refetch, `mySeat`/`isExpectingMe`/`myOutcome`,
the replay scrubber (`replayEvent`/`stepBack`/`stepForward`/`goLive`/`isReplaying`),
`submitEvent`/`resign` (mutation → `triggerWorkflow('game-event', { op: 'event', gameId })` →
notify-driven refetch), and the stale-`lobby` setup re-fire — is the platform composable
unchanged.

```ts
// The checkers page consumes the same shape as battleship:
const { game, view, mySeat, isExpectingMe, myOutcome, fetching, error, submitting,
        submitEvent, resign,
        replayEvent, isReplaying, stepBack, stepForward, goLive } = useGame(gameId)

const checkersView = computed(() =>
  game.value?.gameTypeId === 'checkers' ? (view.value as CheckersPlayerView | null) : null)

// on board emit:
async function onMove(m: CheckersLegalMove) {
  await submitEvent({ from: m.from, path: m.path })   // { from, path } — the full move
}
```

## Auth / errors
- `gameView` raises `30000: NOT AUTHORIZED` for non-seated callers → composable surfaces
  `error` → page renders an unauthorized UAlert (platform-generic).
- `submitEvent` DB pre-checks raise `30001: EVENT NOT EXPECTED` / `30002: GAME NOT IN
  PROGRESS` (→ toast). The referee's authoritative rejection (`illegal_move`,
  `not_a_legal_capture`) lands as a `rejected` event + reason on refetch.
