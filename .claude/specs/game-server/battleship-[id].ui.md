# games/battleship/[id] — Battleship Detail UI

## Status
Draft — decisions locked 2026-07-19. No `[FILL IN]` markers.

## Route
`/tenant/games/battleship/[id]` (tenant-app page `app/pages/games/battleship/[id].vue`).

## Layout

UCard container (UC4):

- **Header**: back link to the list (`i-lucide-arrow-left`, ghost) · title "Battleship vs
  {opponent name | Machine}" · status UBadge (colors as in `battleship-index.ui.md`) · right:
  "Resign" UButton (`color="error"`, `variant="outline"`, only while `IN_PROGRESS`).
- **Turn banner**: while `IN_PROGRESS`, a slim row: "Your turn — fire at the enemy grid"
  (primary) or "Waiting for {opponent}…" (neutral, subtle pulse). While `LOBBY`: "Placing
  fleets…" (the setup workflow normally lands within a second or two; the WS notify flips it).
- **Result banner** (persistent → UAlert, UC7): on `COMPLETE` — `success` "Victory — you sank
  their fleet" / `error` "Defeat — your fleet was sunk" (or resign wording via `moveCount`
  unchanged + status jump); on `ABANDONED` — `warning`.
- **Boards** (responsive: `flex flex-wrap gap-6`, stacks on mobile — UC5):
  - **"Enemy waters"** — `BattleshipBoard` in **target** mode: `opponent.board` cells
    (`unknown | hit | miss | sunk`); interactive iff `IN_PROGRESS` && my turn; emits
    `fire(row,col)`.
  - **"Your fleet"** — `BattleshipBoard` in **own** mode: `you.board` cells
    (`empty | ship | hit | miss | sunk`); never interactive. Below it: fleet status list from
    `you.fleet` (name, size, hit pips, strikethrough when sunk).
  - Enemy `sunkShips` listed under the target board.
- **Move feedback**: transient toasts (UC7): "Hit!" / "Miss" / "You sank their {ship}!" and the
  machine's reply ("They fired at B4 — miss"), derived by diffing the view on refetch;
  rejection reasons surface as `error` toasts ("Not your turn", "Already fired there").

## Component: `BattleshipBoard.vue` (tenant-app `app/components/games/BattleshipBoard.vue`)

Pure presentational (R2 — no API calls):
- Props: `board: string[][]`, `mode: 'own' | 'target'`, `interactive: boolean`,
  `boardSize: number`.
- Emits: `fire(cell: { row: number; col: number })` (target mode, `interactive` only; cells
  already shot are not clickable).
- Render: CSS grid, square cells, A–J / 1–10 axis labels; `aspect-square`; `overflow-x-auto`
  wrapper for very narrow screens (UC5).
- Cell colors (UC6 tokens): `ship` → `primary` (soft); `hit` → `error` (dot/`i-lucide-flame`);
  `sunk` → `error` solid (`i-lucide-x`); `miss` → `neutral` (dot); `unknown`/`empty` →
  default surface; hover ring on clickable cells.

## Reactive state

From `useGame(gameId)` (`battleship-[id].data.md`): `{ game: GameSummary, view:
BattleshipPlayerView, mySeat, isMyTurn, fetching, error, submitting }`. WS-driven: every
`game:{id}:state` notify refetches; no polling.

## Interactions

| Interaction | Behavior |
|---|---|
| Click enemy cell | optimistic `submitting` lock → `submitMove({row,col})` + trigger; board updates on the notify-driven refetch |
| Resign | UModal confirm ("Resign this game? Your opponent wins.") → `resignGame()` → result banner |
| Rejected move | error toast; no state change |
| Connection lost | WS auto-reconnects (2 s); banner only if refetch also errors |
