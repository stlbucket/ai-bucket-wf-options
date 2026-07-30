# Implementation Status

Module/app status board — moved out of the `fnb-stack-spec` skill 2026-07-30 (status data, not
procedure). Update this file when a module ships or a spec tree is added.

Data layer is **urql GraphQL → PostGraphile** across the board (composables in
`packages/graphql-client-api/src/composables/`, re-exported per app).

## `tenant-app/` modules

| Module | Pages | Status |
|---|---|---|
| `admin` | index (hub), user/index, user/[id], license/index, subscription/index, subscription/[id] | Implemented — GraphQL |
| `msg` | index (inbox), [id] (conversation) | Implemented — GraphQL (+ WS incremental read carve-out) |
| `site-admin` | index (placeholder), tenant/index, tenant/[id], user/index, user/[id], application/index, application/[key] | Implemented — GraphQL |
| `support` | tickets/index, tickets/new, tickets/[id] | Implemented — GraphQL |
| `loc` | index, [id] | Implemented — GraphQL (`useLocations`) |
| `games` | battleship/index, battleship/[id], checkers/index, checkers/[id], tic-tac-toe/index (Coming Soon) | Implemented — GraphQL (`useGames`/`useGame`/`useGameTypes`) + n8n referee (`game-event` workflow); battleship + checkers playable |
| `tools/poll` | index (list), [id] (draft editor · published two-column answer/results/discussion) | Implemented 2026-07-23 — GraphQL (`usePollList`/`usePollDetail`/`usePollMsg`); URN entity `db/fnb-poll`; yes/no + multiple-choice + date-list (yes/no per date), per-question `allow_note` answer notes (attributed-only), authored + respondent date/times, per-poll results visibility, per-question inline expandable results, discussion (published only); OTP quick-login share via the generic `ShareModal` (2026-07-28, spec `otp-login/`) |
| `tools/todo` | index (list), [id] (detail: subtasks, msg, assets, assign) | Implemented — GraphQL (`useTodoList`/`useTodoDetail`/`useTodoMsg`); URN entity `db/fnb-todo`; templates + deep copy; **multi-assignee 2026-07-30** (`todo.todo_assignee`, `addTodoAssignee`/`removeTodoAssignee` — single-slot `assign_todo` dropped); OTP quick-login share via `ShareModal` |

## Other app spec trees

`auth-app/` (login, current-profile-claims, profile), `msg-app/`, `graphql-api-app/`
(`_overview.md`, `server-pattern.md`, tombstoned `worker-pattern.md`), `home-app/`,
`n8n-parallel-engine/` + `agentic-decommission/` (the workflow engine — n8n, the sole engine,
R22), `asset-storage/` (implemented 2026-07-06: storage-layer/storage-app + quarantine-first
`asset-scan`, now running on n8n), and `game-server/` (implemented 2026-07-20: `db/fnb-game` +
`packages/game-engines` + `game-layer`/`game-app` + the `game-event` n8n referee — event-sourced
N-seat game platform; checkers = the English-draughts sub-spec `game-server/checkers/`, added
via the platform's registry-flip + engine-module + UI-page path, zero DDL).

Some per-page `.data.md` files are still being reconciled from the REST era — apply
`fnb-stack-spec` Mode 4 (legacy cleanup) when you touch one.
