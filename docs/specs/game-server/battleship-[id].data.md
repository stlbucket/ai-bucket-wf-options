# games/battleship/[id] — Battleship Detail Data

## Status
Draft — decisions locked 2026-07-19. No `[FILL IN]` markers. Types/permissions/WS contract:
`_shared.data.md` (do not duplicate).

## Route
`/tenant/games/battleship/[id]` — see `battleship-[id].ui.md`.

## GraphQL

| Operation | `.graphql` file | Generated hook | Notes |
|---|---|---|---|
| `GameById($id: UUID!)` | `game/query/gameById.graphql` | `useGameByIdQuery()` | ONE document, three roots: the `Game` single lookup (summary fields incl. `expectingSeats`/`eventCount` + the `gamePlayers` and `gameEvents` relations) + `gameView(gameId: $id)` (the caller's redacted **live** view blob, jsonb) |
| `GameViewAt($gameId: UUID!, $eventNumber: Int!)` | `game/query/gameViewAt.graphql` | `useGameViewAtQuery()` | the caller's view at one event — the **replay scrubber's** step query (paused hook, executed per step; results cached by urql) |
| `SubmitEvent($gameId: UUID!, $eventData: JSON!)` | `game/mutation/submitEvent.graphql` | `useSubmitEventMutation()` | returns the `GameEvent` row (pending) |
| `ResignGame($gameId: UUID!)` | `game/mutation/resignGame.graphql` | `useResignGameMutation()` | returns the pending `resign` `GameEvent` |
| `TriggerWorkflow` | existing document | existing hook | `{ op: 'event', gameId }` after each submit/resign; also re-fired as `{ op: 'setup', gameId }` when the page loads a stale `lobby` game (stuck-setup recovery — referee no-ops unless still `lobby`) |

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
  // game: computed<GameSummary | null> (toGameSummary — players roster + expectingSeats included)
  // events: computed<GameEvent[]> — applied events ordered by eventNumber (from gameEvents)
  // liveView: computed<BattleshipPlayerView | null> — live gameView jsonb, typed by gameTypeId
  // mySeat: computed<number | null> — the players entry whose residentUrn matches my urn
  // isExpectingMe: computed — expectingSeats.includes(mySeat) && status IN_PROGRESS
  // myOutcome: computed<SeatOutcome | null> — my players entry's outcome (COMPLETE only)

  // --- replay scrubber (locked: ships in v1) ---
  // replayEvent: ref<number | null> — null = live; 1..eventCount = scrubbing
  // view: computed — replayEvent === null ? liveView : GameViewAt(replayEvent) result
  // stepBack() / stepForward() / goLive() — clamp to [1, eventCount]; goLive() nulls replayEvent
  // isReplaying: computed — replayEvent !== null (page disables firing while true)
  // a WS notify while replaying refetches GameById (eventCount grows) but leaves replayEvent alone

  async function submitEvent(eventData: unknown) {
    // guard isExpectingMe && !isReplaying; submitting.value = true
    // useSubmitEventMutation → throw on res.error (surfaces 30001/30002 as toasts upstream)
    // triggerWorkflow('game-event', { op: 'event', gameId })
    // state lands via the WS notify → refetch (submitting cleared on next view change/refetch)
  }
  async function resign() { /* useResignGameMutation → triggerWorkflow op 'event' → refetch */ }

  return { game, events, view, liveView, mySeat, isExpectingMe, myOutcome, fetching, error,
           submitting, submitEvent, resign,
           replayEvent, isReplaying, stepBack, stepForward, goLive }
}
```

On mount with a `lobby` game older than ~5 s, the composable re-fires
`triggerWorkflow('game-event', { op: 'setup', gameId })` once (stuck-setup recovery — the
referee no-ops unless the game is still `lobby`).

Move-result toasts ("Hit!", machine reply narration) are derived in the composable by diffing
consecutive **live** `view` values (previous vs refetched boards) and exposed as a
`lastEvents: GameBoardEvent[]` computed the page feeds to `useToast` — suppressed while
`isReplaying`. Keeps diff logic out of the page and the transport out of components (R1/R2).

## Auth / errors

- `gameView` raises `30000: NOT AUTHORIZED` for non-seated callers → composable surfaces
  `error` → page renders a not-found/unauthorized UAlert.
- `submitEvent` DB pre-checks raise `30001: EVENT NOT EXPECTED` / `30002: GAME NOT IN
  PROGRESS` (GraphQL error → toast). The referee's authoritative rejection lands as a
  `rejected` event + reason on refetch.
