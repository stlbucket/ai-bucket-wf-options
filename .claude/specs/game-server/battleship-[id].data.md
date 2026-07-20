# games/battleship/[id] — Battleship Detail Data

## Status
Draft — decisions locked 2026-07-19. No `[FILL IN]` markers. Types/permissions/WS contract:
`_shared.data.md` (do not duplicate).

## Route
`/tenant/games/battleship/[id]` — see `battleship-[id].ui.md`.

## GraphQL

| Operation | `.graphql` file | Generated hook | Notes |
|---|---|---|---|
| `GameById($id: UUID!)` | `game/query/gameById.graphql` | `useGameByIdQuery()` | ONE document, two roots: the `Game` single lookup (summary fields) + `gameView(gameId: $id)` (the caller's redacted `player_views` seat blob, jsonb) |
| `SubmitMove($gameId: UUID!, $moveData: JSON!)` | `game/mutation/submitMove.graphql` | `useSubmitMoveMutation()` | returns the `GameMove` row (pending) |
| `ResignGame($gameId: UUID!)` | `game/mutation/resignGame.graphql` | `useResignGameMutation()` | returns the updated `Game` |
| `TriggerWorkflow` | existing document | existing hook | `{ op: 'move', gameId }` after each submit |

Verify generated names in GraphiQL before writing documents (house convention).

## WebSocket (game-layer; contract in `_shared.data.md` §WebSocket)

`wss://{host}/game/_ws/games/{gameId}` — on `{ event: 'update' }` → re-execute `GameById`
with `requestPolicy: 'network-only'`. **No REST carve-out** (README locked decision — whole-state
GraphQL refetch replaces msg's incremental `withClaims` GET). Reconnect 2 s on abnormal close;
close `1000` in `onUnmounted`.

## Composable

**Source**: `packages/graphql-client-api/src/composables/useGame.ts`
**Re-export**: `apps/tenant-app/app/composables/useGame.ts`

```ts
export function useGame(gameId: MaybeRef<string>) {
  // Hybrid (useMsgTopic precedent): GraphQL load + WS-driven network-only refetch
  // game: computed<GameSummary | null> (toGameSummary)
  // view: computed<BattleshipPlayerView | null> — gameView jsonb parsed/typed by gameType
  // mySeat: computed<1 | 2 | null> — my resident urn vs playerOne/TwoResidentUrn
  // isMyTurn: computed — game.currentTurnSeat === mySeat && status IN_PROGRESS

  async function submitMove(moveData: unknown) {
    // guard isMyTurn; submitting.value = true
    // useSubmitMoveMutation → throw on res.error (surfaces 30001/30002 as toasts upstream)
    // triggerWorkflow('game-move', { op: 'move', gameId })
    // state lands via the WS notify → refetch (submitting cleared on next view change/refetch)
  }
  async function resign() { /* useResignGameMutation → refetch */ }

  return { game, view, mySeat, isMyTurn, fetching, error, submitting, submitMove, resign }
}
```

Move-result toasts ("Hit!", machine reply narration) are derived in the composable by diffing
consecutive `view` values (previous vs refetched boards) and exposed as a
`lastEvents: GameBoardEvent[]` computed the page feeds to `useToast` — keeps diff logic out of
the page and the transport out of components (R1/R2).

## Auth / errors

- `gameView` raises `30000: NOT AUTHORIZED` for non-seated callers → composable surfaces
  `error` → page renders a not-found/unauthorized UAlert.
- `submitMove` DB pre-checks raise `30001: NOT YOUR TURN` / `30002: GAME NOT IN PROGRESS`
  (GraphQL error → toast). The referee's authoritative rejection lands as a `rejected` move +
  reason on refetch.
