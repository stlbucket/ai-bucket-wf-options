# games/tic-tac-toe + games/checkers — Coming Soon Data

## Status
Draft — decisions locked 2026-07-19. No `[FILL IN]` markers.

## Data access

**None.** Both pages are static (R18 pair for `coming-soon.ui.md`): no GraphQL operations, no
composables, no WS. Access is gated only by the nav tool permissions (`p:app-user`/`p:app-admin`,
R14) — the pages themselves render for anyone who reaches them (no secret content).

When a game ships, its pages get real `.ui.md`/`.data.md` pairs and the enum/engine/registry
additions listed in `README.md` §Open Questions — no DB DDL required.
