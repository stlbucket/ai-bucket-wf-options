# games/battleship/index — Battleship List Data

## Status
Draft — decisions locked 2026-07-19. No `[FILL IN]` markers. Types/permissions:
`_shared.data.md` (do not duplicate).

## Route
`/tenant/games/battleship` — see `battleship-index.ui.md`.

## GraphQL

| Operation | `.graphql` file | Generated hook | Notes |
|---|---|---|---|
| `MyGames($gameTypeId: String)` | `game/query/myGames.graphql` | `useMyGamesQuery()` | `myGamesList(gameTypeId: "battleship")` → `GameSummary[]` incl. the nested `gamePlayers` roster; newest first (fn orders) |
| `CreateGame($gameTypeId: String!, $players: JSON!)` | `game/mutation/createGame.graphql` | `useCreateGameMutation()` | `$players` = seats 2..N array (`NewGamePlayer[]` — battleship sends exactly one entry); returns the new `Game` (summary fields) |
| `GameTypes` | `game/query/gameTypes.graphql` | `useGameTypesQuery()` | `gameTypeList` (ordered by `ordinal`) → `GameTypeInfo[]`; gates the New Game modal's machine options via `supportedPlayerKinds` |
| `TriggerWorkflow` | existing document | existing hook | `triggerWorkflow(workflowKey: "game-event", inputData: { op: "setup", gameId })` after create |
| `ActiveTenantResidents` | existing shared document | existing hook | opponent picker + display-name resolution (msg precedent) |

Verify generated names in GraphiQL before writing documents (house convention).

## Composable

**Source**: `packages/graphql-client-api/src/composables/useGames.ts`
**Re-export**: `apps/tenant-app/app/composables/useGames.ts`

```ts
export function useGames(gameTypeId?: MaybeRef<GameTypeId>) {
  // useMyGamesQuery({ variables }); map via toGameSummary (R3)
  // games: computed<GameSummary[]>, fetching, error
  // refresh(): executeQuery({ requestPolicy: 'network-only' })  — no `refresh` helper in urql
  async function createGame(input: {
    gameTypeId: GameTypeId
    players: NewGamePlayer[]   // seats 2..N; battleship: exactly one entry —
                               //   { kind: 'HUMAN', residentUrn } or { kind: 'MACHINE_ALGORITHM' | 'MACHINE_AGENT' }
  }): Promise<string> {
    // 1. useCreateGameMutation → new game id (throw on res.error)
    // 2. triggerWorkflow('game-event', { op: 'setup', gameId })   — fire-and-forget accept
    // 3. refresh(); return gameId
  }
  return { games, fetching, error, refresh, createGame }
}
```

The modal's machine-option gating reads `useGameTypes()`
(source `packages/graphql-client-api/src/composables/useGameTypes.ts`, re-export
`apps/tenant-app/app/composables/useGameTypes.ts` — `_shared.data.md`).

The page derives per-row "my seat" / opponent from the `players` roster on each `GameSummary`:
my seat is the entry whose `residentUrn` matches the caller's urn (from claims); the opponent
row shows the other seat — resident display name via the residents list client-side, or the
machine label from `playerKind`. No transport access in the page (R1); no API calls in
components (R2).
