# Execution log — 0010_recur__dead-code-sweep — 2026-07-30

Fourth housekeeping run (priors: 2026_07_19, 2026_07_22, 2026_07_23), part of a full `000_1`
suite pass. Re-verified the plan's 10-item list plus a fresh sweep of code landed since
2026-07-23 (todo multi-assign — `db/fnb-todo` assignee changes + `TodoDetailAssign`;
participants work — subtree residents, invite/share modals; poll tweaks; auth-app `go/[id]`
page + OTP verify; n8n invite-user workflow).

## Verified still-resolved (re-checked clean)

All 10 original items remain resolved:

1. `scripts/db-generate.ts` + root `"db-generate"` entry — gone.
2. `db/my-app/` — gone (14 packages present, all registered).
3. Empty `apps/auth-app/server/api/tenants/` — gone.
4. `node_modules_wf_app` / `wf-app` in `docker-compose.yml` — gone.
5. Stale per-app `pnpm-lock.yaml` — none.
6. Deprecated `TopicSummary` alias — gone (only `SubscribedTopicSummary` remains).
7. `console.log` in production paths — none across `apps/*/server` + `packages/*/src`.
8. `packages/tenant-layer/server/middleware/auth.ts` comment — correct (sealed-session).
9. `postgraphile.tags.json5` — real smart tags only, no boilerplate residue.
10. `packages/auth-server/src/ping.ts` — gone.

## New-code sweep (landed since 2026-07-23) — clean

- No `console.log`/`debugger` in any changed app/package source (tenant-app todo/poll
  components + composables, auth-app `go/[id]`/OTP/oidc, tenant-layer nav/residency
  components, graphql-client-api composables/mappers, graphql-api-app server).
- No `FIXME`/`XXX`/`HACK` markers. The only `TODO` comments are `-- TODO: add paging options`
  in deployed sqitch SQL (`db/fnb-todo` fn files) — intentional future-work notes, left in
  place (removing them would require a sqitch rework for zero benefit).
- No empty directories under `apps/`, `packages/`, `db/`.

## Observation carried forward (unchanged, still needs user decision)

- **`notification-send-flow.png`** (repo root, 73 KB) — still referenced nowhere in the repo.
  Recommend the user wire it into the notifications spec/README or remove it. Not deleted
  (user-committed binary).

## Fixed inline / Spawned identified/ items

None — the sweep was fully clean; nothing to fix, nothing to spawn.

## Gate

`pnpm build` — **green** (13/13 tasks, 2m27s). Docker restart + read-only smoke remains the
user's step.
