# games/checkers/index — Checkers List UI

## Status
Draft — decisions locked 2026-07-20. No `[FILL IN]` markers.

## Route
`/tenant/games/checkers` (tenant-app page `app/pages/games/checkers/index.vue`) — nav tool
`games-checkers` (`i-lucide-circle-dot`), Games module. **Replaces** the Coming Soon page at
this route.

## Layout

A near-clone of `../battleship-index.ui.md` — the platform list behavior is identical; only the
title/icon and the `useGames('checkers')` argument differ. UCard container (UC4):

- **Header row** (flex, wraps — UC5): title "Checkers" + `i-lucide-circle-dot`; right: refresh
  UButton (`i-lucide-refresh-cw`, ghost) + primary "New Game" UButton (`i-lucide-plus`).
- **Body**: UTable of my checkers games (`overflow-x-auto`, UC5). Empty state: centered prose +
  "New Game" CTA.

### Table columns

Identical to battleship (parent `battleship-index.ui.md` §Table columns): Opponent (resident
name or "Machine — algorithm/agent" from `playerKind`), Status (UBadge), Turn ("Your turn" /
"Their turn" when `IN_PROGRESS`), Result (Won/Lost/Abandoned on terminal), Events
(`eventCount`), Started (`createdAt` relative). Row click → `/tenant/games/checkers/{id}`.

### Status badge colors (UC6)
Same mapping as battleship: LOBBY `neutral` ("Setting up…") · IN_PROGRESS `info` · COMPLETE
`success` · ABANDONED `warning`.

### New Game modal (UModal)
Identical structure to battleship's — checkers is also strictly 2-seat, so the modal maps the
single choice to the seat-2 `NewGamePlayer`:
- **Opponent** URadioGroup: "Another player" / "Machine — algorithm" / "Machine — agent" — the
  two machine options render because they are in the checkers registry row's
  `supportedPlayerKinds` (`useGameTypes()`; all three kinds are supported now).
- **Player picker** USelectMenu over active tenant residents (excluding self); shown +
  required only for "Another player".
- Actions: cancel (ghost) / "Start Game" (primary, loading while create+setup runs). On
  success: toast (UC7) + navigate to the new game's detail page.

## Reactive state
`{ games, fetching, error }` from `useGames('checkers')`; modal state local. Not real-time
(platform lock) — refresh re-queries `network-only`.

## Interactions
Identical to battleship: New Game → `createGame` → `game-event` setup trigger → toast +
navigate; Refresh → `network-only`; Row click → detail; Create failure → error toast, modal
stays open.
