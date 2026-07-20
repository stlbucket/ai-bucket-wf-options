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
| Opponent | The other seat from the `players` roster: resident display name (via residents lookup) or "Machine — algorithm" / "Machine — agent" from `playerKind` (`i-lucide-bot` inline) |
| Status | UBadge — see colors |
| Turn | "Your turn" (`color="primary"` UBadge, when `expectingSeats` includes my seat) / "Their turn" (neutral) — only when `IN_PROGRESS` |
| Result | on `COMPLETE`: "Won" (`success`) / "Lost" (`error`) from my `players` entry's `outcome`; `ABANDONED`: neutral "Abandoned" |
| Events | `eventCount` |
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
  "Machine — agent" (maps to the single seat-2 `NewGamePlayer` entry — battleship is always
  2-seat; the N-seat roster model needs no UI here). Machine options render only if present in
  the battleship registry row's `supportedPlayerKinds` (`useGameTypes()` — both are, today).
- **Player picker** — USelectMenu over active tenant residents (shared residents list, excluding
  self); visible + required only for "Another player".
- Actions: cancel (ghost) / "Start Game" (primary, loading state while create+setup trigger
  runs). On success: toast (UC7) + navigate to the new game's detail page.

## Reactive state

`{ games: GameSummary[], fetching, error }` from `useGames('battleship')`; modal state local to
the page. Not real-time (README lock) — refresh button re-queries `network-only`.

## Interactions

| Interaction | Behavior |
|---|---|
| New Game → Start | `createGame(...)` → triggers `game-event` setup → toast + navigate to detail |
| Refresh | re-execute list query `network-only` |
| Row click | navigate to detail |
| Create failure | error toast (UC7); modal stays open |
