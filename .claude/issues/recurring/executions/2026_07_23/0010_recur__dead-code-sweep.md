# Execution log — 0010_recur__dead-code-sweep — 2026-07-23

Third housekeeping run (priors: 2026_07_19, 2026_07_22), part of a full `000_1` suite pass.
Re-verified the plan's 10-item list plus a fresh sweep of the code landed since 2026-07-22
(the `db/fnb-poll` module + `tools/poll` pages, and the nav-collapsible-sections work in
`tenant-layer`).

## Verified still-resolved (re-checked clean)

1. `scripts/db-generate.ts` + root `"db-generate"` entry — gone.
2. `db/my-app/` — gone.
3. Empty `apps/auth-app/server/api/tenants/` — gone.
4. `node_modules_wf_app` / `wf-app` in `docker-compose.yml` — gone.
5. Stale per-app `pnpm-lock.yaml` — none.
6. Deprecated `TopicSummary` alias — gone.
7. `console.log` in production paths — none across `apps/*/server` + `packages/*/src`, and none
   in the app-side Vue/composable code of the changed areas (tenant-layer nav components,
   tenant-app tools pages, auth-layer, home-app).
8. `packages/tenant-layer/server/middleware/auth.ts` comment — correct (sealed-session claim
   population, no cookie-refresh claim).
9. `postgraphile.tags.json5` — no boilerplate residue (no `post`/`organization`/`permission2`
   fake-table examples; file carries only real smart tags incl. the new poll behaviors).
10. `packages/auth-server/src/ping.ts` — gone.

## New-code sweep (landed since 2026-07-22) — clean

- `db/fnb-poll` is properly registered: present in `DEPLOY_PACKAGES` in both `.env` and
  `.env.example` (13 packages, `fnb-poll` after `fnb-todo`) — not an orphaned package like the
  old `db/my-app`.
- No `TODO`/`FIXME`/`XXX`/`HACK`/`debugger` in the poll or nav code — all grep hits were the
  word "todo" naming the todo module (pages, composables, components), i.e. false positives.
- No `console.log`/`debugger` in the changed composables (`useWorkspaces.ts`, `useAppNav.ts`)
  or nav components (`AppNav.vue`, `AppNavMobile.vue`, `ModuleNavSection.vue`).
- No empty dirs under `apps/`/`packages/`/`db/` (excluding build artifacts).

## Observation carried forward (unchanged, still needs user decision)

- **`notification-send-flow.png`** (repo root, 73 KB) — still referenced nowhere in the repo
  except yesterday's execution log noting the same. Recommend the user wire it into the
  notifications spec/README or remove it. Not deleted (user-committed binary).

## Fixed inline / Spawned identified/ items

None — the sweep was fully clean; nothing to fix, nothing to spawn.

## Gate

`pnpm build` — **green** (13/13 tasks, full turbo cache). Docker restart + read-only smoke
remains the user's step.
