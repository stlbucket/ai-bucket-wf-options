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
- **Turn banner**: while `IN_PROGRESS`, a slim row driven by `isExpectingMe`: "Your turn —
  fire at the enemy grid" (primary) or "Waiting for {opponent}…" (neutral, subtle pulse).
  While `LOBBY`: "Placing fleets…" (the setup workflow normally lands within a second or two;
  the WS notify flips it — and the composable re-fires setup for a stale lobby).
- **Result banner** (persistent → UAlert, UC7): on `COMPLETE`, from `myOutcome` — `WON` →
  `success` "Victory — you sank their fleet" / `LOST` → `error` "Defeat — your fleet was
  sunk" (resign wording when the final event is a `resign`); on `ABANDONED` — `warning`.
- **Replay scrubber** (locked: ships in v1) — a slim control row above the boards:
  step-back UButton (`i-lucide-chevron-left`), an event position label ("event 12 / 34" —
  `replayEvent ?? eventCount` over `eventCount`), step-forward UButton
  (`i-lucide-chevron-right`), and a "Live" UButton (`i-lucide-radio`, primary when
  scrubbing, disabled when already live). Stepping back from live enters replay at
  `eventCount - 1`; boards render the historical view; firing is disabled and the turn
  banner shows a neutral "Replaying — event {n}" note while `isReplaying`. Works during a
  live game and after completion.
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

> **Auto-import naming gotcha (verified in-flight 2026-07-20):** Nuxt prefixes subdirectory
> component names with the directory, so `components/games/BattleshipBoard.vue` auto-registers as
> `<GamesBattleshipBoard>`, NOT `<BattleshipBoard>` (the de-dupe that lets `GamesComingSoon.vue`
> resolve as `<GamesComingSoon>` only applies because that filename already starts with `Games`).
> The `[id].vue` page therefore **imports it explicitly** —
> `import BattleshipBoard from '~/components/games/BattleshipBoard.vue'` — mirroring the
> `datasets/BreweryListView.vue` precedent. Referencing `<BattleshipBoard>` without that import
> silently renders nothing (Vue warn: "Failed to resolve component").

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
BattleshipPlayerView, mySeat, isExpectingMe, myOutcome, fetching, error, submitting,
replayEvent, isReplaying, stepBack, stepForward, goLive }`. WS-driven: every
`game:{id}:state` notify refetches the live state; no polling; scrubbing never blocks live
updates (the event counter keeps growing).

## Interactions

| Interaction | Behavior |
|---|---|
| Click enemy cell | optimistic `submitting` lock → `submitEvent({row,col})` + trigger; board updates on the notify-driven refetch. Disabled while `isReplaying` |
| Scrub back / forward | `stepBack()` / `stepForward()` — boards show the caller's view at that event (`GameViewAt`); forward past the last event returns to live |
| Live | `goLive()` — exits replay, boards snap to the live view |
| Resign | UModal confirm ("Resign this game? Your opponent wins.") → `resign()` + trigger → result banner |
| Rejected event | error toast; no state change |
| Connection lost | WS auto-reconnects (2 s); banner only if refetch also errors |
