# games/battleship/index — Battleship List Data

## Status
Draft — decisions locked 2026-07-19. No `[FILL IN]` markers. Types/permissions:
`_shared.data.md` (do not duplicate).

## Route
`/tenant/games/battleship` — see `battleship-index.ui.md`.

## GraphQL

| Operation | `.graphql` file | Generated hook | Notes |
|---|---|---|---|
| `MyGames($gameType: GameType)` | `game/query/myGames.graphql` | `useMyGamesQuery()` | `myGamesList(gameType: BATTLESHIP)` → `GameSummary[]`; newest first (fn orders) |
| `CreateGame($gameType…, $opponentKind…, $opponentResidentUrn: String)` | `game/mutation/createGame.graphql` | `useCreateGameMutation()` | returns the new `Game` (summary fields) |
| `TriggerWorkflow` | existing document | existing hook | `triggerWorkflow(workflowKey: "game-move", inputData: { op: "setup", gameId })` after create |
| `ActiveTenantResidents` | existing shared document | existing hook | opponent picker + display-name resolution (msg precedent) |

Verify generated names in GraphiQL before writing documents (house convention).

## Composable

**Source**: `packages/graphql-client-api/src/composables/useGames.ts`
**Re-export**: `apps/tenant-app/app/composables/useGames.ts`

```ts
export function useGames(gameType?: MaybeRef<GameType>) {
  // useMyGamesQuery({ variables }); map via toGameSummary (R3)
  // games: computed<GameSummary[]>, fetching, error
  // refresh(): executeQuery({ requestPolicy: 'network-only' })  — no `refresh` helper in urql
  async function createGame(input: {
    gameType: GameType
    opponentKind: OpponentKind
    opponentResidentUrn?: string
  }): Promise<string> {
    // 1. useCreateGameMutation → new game id (throw on res.error)
    // 2. triggerWorkflow('game-move', { op: 'setup', gameId })   — fire-and-forget accept
    // 3. refresh(); return gameId
  }
  return { games, fetching, error, refresh, createGame }
}
```

The page derives per-row "my seat" / opponent name by comparing the caller's resident urn
(from claims) against `playerOneResidentUrn`/`playerTwoResidentUrn` and joining the residents
list client-side. No transport access in the page (R1); no API calls in components (R2).
