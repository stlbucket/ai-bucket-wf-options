# games/checkers/[id] — Checkers Detail UI

## Status
Draft — decisions locked 2026-07-20. No `[FILL IN]` markers.

## Route
`/tenant/games/checkers/[id]` (tenant-app page `app/pages/games/checkers/[id].vue`).

## Layout

UCard container (UC4) — the same skeleton as `../battleship-[id].ui.md`, with a single checkers
board instead of two battleship grids:

- **Header**: back link to the list (`i-lucide-arrow-left`, ghost) · title "Checkers vs
  {opponent name | Machine}" · status UBadge (same colors as the list) · right: "Resign"
  UButton (`color="error"`, `variant="outline"`, only while `IN_PROGRESS`).
- **Turn banner**: while `IN_PROGRESS`, driven by `isExpectingMe`: "Your turn — move a red
  piece" (primary) or "Waiting for {opponent}…" (neutral, subtle pulse). While `LOBBY`:
  "Setting up the board…" (setup lands within a second or two; the WS notify flips it, and the
  composable re-fires setup for a stale lobby — platform behavior).
- **Result banner** (persistent → UAlert, UC7): on `COMPLETE`, from `myOutcome` — `WON` →
  `success` "Victory — your opponent has no moves left" (resign wording when the final event is
  a `resign`) / `LOST` → `error` "Defeat"; on `ABANDONED` → `warning`.
- **Replay scrubber** — identical control row to battleship (locked: included): step-back
  (`i-lucide-chevron-left`), event position label ("event 12 / 34" — `replayEvent ?? eventCount`
  over `eventCount`), step-forward (`i-lucide-chevron-right`), "Live" UButton
  (`i-lucide-radio`, primary when scrubbing). While `isReplaying` the board is read-only and
  the turn banner shows "Replaying — event {n}". Works live and after completion.
- **Board** (centered, responsive — `overflow-x-auto` wrapper, UC5): one `CheckersBoard`
  rendering the caller's `view.board`, oriented so **the caller's own pieces are at the
  bottom** (seat 2 sees the board flipped). Interactive iff `IN_PROGRESS` && my turn &&
  !`isReplaying`.
- **Move feedback**: transient toasts (UC7), light — from the composable's checkers narrator
  ("They moved", "Captured 2", "Kinged!"); rejection reasons as `error` toasts ("Not your
  turn", "That move isn't legal", "You must capture").

## Component: `CheckersBoard.vue` (tenant-app `app/components/games/CheckersBoard.vue`)

> **Auto-import naming gotcha** (same as `GamesBattleshipBoard`, verified on the platform):
> `components/games/CheckersBoard.vue` auto-registers as `<GamesCheckersBoard>`. The `[id].vue`
> page **imports it explicitly** —
> `import CheckersBoard from '~/components/games/CheckersBoard.vue'` — mirroring the
> `BattleshipBoard` precedent. Referencing `<CheckersBoard>` without the import silently
> renders nothing.

Pure presentational (R2 — no API calls):
- Props: `board: CheckersCell[][]`, `boardSize: number`, `mySeat: number`,
  `legalMoves: CheckersLegalMove[]`, `interactive: boolean`, `lastMove: CheckersMove | null`.
- Emits: `move(m: CheckersLegalMove)` — the fully-specified move the player selected.
- **Interaction (select piece → destination, with path preview):**
  1. Click one of your pieces that appears as a `from` in `legalMoves` → it highlights, and its
     candidate destinations (the final square of each of its `legalMoves`) are marked; if the
     piece has capture moves, only those show (forced capture is already baked into
     `legalMoves`).
  2. Click a highlighted destination → if it uniquely identifies one legal move, emit `move`;
     if a jump chain's intermediate landings are ambiguous, preview the chain and require
     confirming the final square (v1 keeps it simple by keying moves on the final destination;
     multiple distinct chains to the same final square — rare in English draughts — disambiguate
     by clicking the first differing landing).
  3. Clicking elsewhere / the selected piece again deselects.
- **Render**: 8×8 CSS grid, square cells (`aspect-square`), dark playable squares vs light
  squares; A–H / 1–8 axis labels; the board flips for seat 2 so own pieces sit at the bottom.
- **Cell/piece colors (UC6 tokens)**: seat-1 men → `error` (red) disc; seat-2 men → `neutral`
  (dark) disc; kings → same disc with an `i-lucide-crown` overlay; selectable own pieces → hover
  ring; highlighted destinations → `primary` soft; the `lastMove` from/to squares → subtle
  `info` outline; captured-piece squares flash then clear on refetch.

## Reactive state
From `useGame(gameId)` (`checkers-[id].data.md`): `{ game, view: CheckersPlayerView, mySeat,
isExpectingMe, myOutcome, fetching, error, submitting, replayEvent, isReplaying, stepBack,
stepForward, goLive, submitEvent, resign }`. WS-driven refetch on every `game:{id}:state`
notify; scrubbing never blocks live updates. The page narrows the generic `view` to
`CheckersPlayerView` by `game.gameTypeId === 'checkers'`.

## Interactions

| Interaction | Behavior |
|---|---|
| Select piece / destination | `CheckersBoard` resolves the full `CheckersLegalMove` locally from `view.legalMoves`, emits `move` |
| Emit `move` | optimistic `submitting` lock → `submitEvent({ from, path })` + trigger; board updates on the notify-driven refetch. Disabled while `isReplaying` |
| Scrub back / forward | `stepBack()` / `stepForward()` — board shows the caller's view at that event (`GameViewAt`); forward past the last event returns to live |
| Live | `goLive()` — board snaps to the live view |
| Resign | UModal confirm ("Resign this game? Your opponent wins.") → `resign()` + trigger → result banner |
| Rejected move | error toast; no state change |
| Connection lost | WS auto-reconnects (2 s); banner only if refetch also errors |
