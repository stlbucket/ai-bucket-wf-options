# games/tic-tac-toe — Coming Soon Data

<!-- Checkers shipped 2026-07-20 (checkers/ sub-spec); this now covers only Tic-Tac-Toe. -->


## Status
Draft — decisions locked 2026-07-19. No `[FILL IN]` markers.

## Data access

**None.** Both pages are static (R18 pair for `coming-soon.ui.md`): no GraphQL operations, no
composables, no WS. Access is gated only by the nav tool permissions (`p:app-user`/`p:app-admin`,
R14) — the pages themselves render for anyone who reaches them (no secret content).

The `game.game_type` registry rows for these types carry `status: 'coming_soon'` — the
server-side truth (`create_game` refuses non-live types). The pages themselves stay hardcoded
in v1; rendering them from `gameTypeList` is a recorded open question. When a game ships, its
pages get real `.ui.md`/`.data.md` pairs, the registry row flips to `live` (a seed update, no
DDL), and the engine module + referee dispatch land per `README.md` §Open Questions.
