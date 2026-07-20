# games/checkers/index — Checkers List Data

## Status
Draft — decisions locked 2026-07-20. No `[FILL IN]` markers. Types/permissions/transport:
parent `../_shared.data.md` + this dir's `_shared.data.md` (do not duplicate).

## Route
`/tenant/games/checkers` — see `checkers-index.ui.md`.

## GraphQL

**No new documents.** The page uses the platform's game-agnostic operations, parameterized by
`gameTypeId = 'checkers'` — identical to `../battleship-index.data.md`:

| Operation | `.graphql` file | Generated hook | Notes |
|---|---|---|---|
| `MyGames($gameTypeId: String)` | `game/query/myGames.graphql` (existing) | `useMyGamesQuery()` | `myGamesList(gameTypeId: "checkers")` → `GameSummary[]` incl. nested `gamePlayers`; newest first |
| `CreateGame($gameTypeId: String!, $players: JSON!)` | existing | `useCreateGameMutation()` | `$players` = seats 2..N (checkers sends exactly one entry, like battleship); returns the new `Game` |
| `GameTypes` | existing | `useGameTypesQuery()` | `gameTypeList` — gates the modal's machine options via `supportedPlayerKinds` |
| `TriggerWorkflow` | existing | existing | `{ op: 'setup', gameId }` after create |
| `ActiveTenantResidents` | existing shared | existing | opponent picker + display-name resolution |

## Composable

**Reused unchanged**: `useGames('checkers')`
(source `packages/graphql-client-api/src/composables/useGames.ts`, tenant-app re-export
already present). The composable is game-agnostic — it takes the `gameTypeId` argument and does
the create+setup-trigger flow identically. Per-row opponent/my-seat derivation from the
`players` roster is the same client-side logic as battleship (R1/R2 preserved).

`useGameTypes()` (also reused unchanged) supplies the modal's machine-kind gating.
