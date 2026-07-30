# games/tic-tac-toe — Coming Soon UI

## Status
Draft — decisions locked 2026-07-19. **Checkers shipped 2026-07-20** (`checkers/` sub-spec), so
this now covers **only Tic-Tac-Toe**. No `[FILL IN]` markers.

## Routes
- `/tenant/games/tic-tac-toe` — tenant-app `app/pages/games/tic-tac-toe/index.vue`

The page is a one-liner rendering the shared component with its props. (The `/tenant/games/checkers`
route is now the real Checkers list — `checkers/checkers-index.*`.)

## Component: `GamesComingSoon.vue` (tenant-app `app/components/games/GamesComingSoon.vue`)

Pure presentational (R2):
- Props: `title: string` ("Tic-Tac-Toe"), `icon: string` (`i-lucide-hash` — matching the nav
  tool icon). (Still generic; Checkers used it until it shipped.)
- Render: UCard (UC4), vertically centered content: large icon (muted), `title` heading, a
  **"Coming Soon"** UBadge (`color="info"`, `size="lg"`), one line of muted prose ("This game
  isn't ready yet — check back soon."), and a ghost UButton "Back to Battleship" →
  `/tenant/games/battleship`.
- Responsive by construction (UC5); color tokens only (UC6). A banner-style UAlert is not used —
  this is the page's whole content, not a warning on other content (UC7).
