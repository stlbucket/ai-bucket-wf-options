# games/battleship/index — Battleship List UI

## Status
Draft — decisions locked 2026-07-19. No `[FILL IN]` markers.

## Route
`/tenant/games/battleship` (tenant-app page `app/pages/games/battleship/index.vue`) — nav tool
`games-battleship` (`i-lucide-ship`), Games module.

## Layout

UCard as the page container (UC4):
- **Header row** (flex, wraps on mobile — UC5): title "Battleship" + `i-lucide-ship`; right side:
  refresh UButton (`i-lucide-refresh-cw`, `variant="ghost"`) + primary UButton "New Game"
  (`i-lucide-plus`).
- **Body**: UTable of my games (wrapped `overflow-x-auto`, UC5). Empty state: centered prose +
  "New Game" call-to-action.

### Table columns

| Column | Content |
|---|---|
| Opponent | Resident display name (via residents lookup) or "Machine — algorithm" / "Machine — agent" (`i-lucide-bot` inline) |
| Status | UBadge — see colors |
| Turn | "Your turn" (`color="primary"` UBadge) / "Their turn" (neutral) — only when `IN_PROGRESS` |
| Result | on `COMPLETE`: "Won" (`success`) / "Lost" (`error`) from `winnerSeat` vs my seat; `ABANDONED`: neutral "Abandoned" |
| Moves | `moveCount` |
| Started | `createdAt` (relative) |

Row click → `/tenant/games/battleship/{id}`.

### Status badge colors (UC6 tokens)

| Status | Color |
|---|---|
| LOBBY | `neutral` ("Setting up…") |
| IN_PROGRESS | `info` |
| COMPLETE | `success` |
| ABANDONED | `warning` |

### New Game modal (UModal)

- **Opponent** — URadioGroup, three options: "Another player" / "Machine — algorithm" /
  "Machine — agent" (maps to `OpponentKind`).
- **Player picker** — USelectMenu over active tenant residents (shared residents list, excluding
  self); visible + required only for "Another player".
- Actions: cancel (ghost) / "Start Game" (primary, loading state while create+setup trigger
  runs). On success: toast (UC7) + navigate to the new game's detail page.

## Reactive state

`{ games: GameSummary[], fetching, error }` from `useGames('BATTLESHIP')`; modal state local to
the page. Not real-time (README lock) — refresh button re-queries `network-only`.

## Interactions

| Interaction | Behavior |
|---|---|
| New Game → Start | `createGame(...)` → triggers `game-move` setup → toast + navigate to detail |
| Refresh | re-execute list query `network-only` |
| Row click | navigate to detail |
| Create failure | error toast (UC7); modal stays open |
