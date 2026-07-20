# games/tic-tac-toe + games/checkers — Coming Soon UI

## Status
Draft — decisions locked 2026-07-19. No `[FILL IN]` markers.

## Routes
- `/tenant/games/tic-tac-toe` — tenant-app `app/pages/games/tic-tac-toe/index.vue`
- `/tenant/games/checkers` — tenant-app `app/pages/games/checkers/index.vue`

Both pages are one-liners rendering the shared component with their own props.

## Component: `GamesComingSoon.vue` (tenant-app `app/components/games/GamesComingSoon.vue`)

Pure presentational (R2):
- Props: `title: string` ("Tic-Tac-Toe" / "Checkers"), `icon: string` (`i-lucide-hash` /
  `i-lucide-circle-dot` — matching the nav tool icons).
- Render: UCard (UC4), vertically centered content: large icon (muted), `title` heading, a
  **"Coming Soon"** UBadge (`color="info"`, `size="lg"`), one line of muted prose ("This game
  isn't ready yet — check back soon."), and a ghost UButton "Back to Battleship" →
  `/tenant/games/battleship`.
- Responsive by construction (UC5); color tokens only (UC6). A banner-style UAlert is not used —
  this is the page's whole content, not a warning on other content (UC7).
