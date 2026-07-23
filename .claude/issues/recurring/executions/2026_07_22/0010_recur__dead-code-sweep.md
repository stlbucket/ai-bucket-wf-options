# Execution log — 0010_recur__dead-code-sweep — 2026-07-22

Second housekeeping run (prior: 2026_07_19). Re-verified the plan's 10-item list plus a fresh
sweep of the code that landed since the last run (the `db/fnb-notify` module, the notification
n8n workflows, and the auth-layer SMS/change-password/invite UI).

## Verified still-resolved (fixed in the 2026-07-19 run, re-checked clean)

1. `scripts/db-generate.ts` + root `"db-generate"` entry — gone (`grep db-generate package.json scripts/` empty).
2. `db/my-app/` — gone.
3. Empty `apps/auth-app/server/api/tenants/` — gone.
4. `node_modules_wf_app` / `wf-app` in `docker-compose.yml` — gone.
5. Stale per-app `pnpm-lock.yaml` — none (`apps/*/pnpm-lock.yaml` no matches).
6. Deprecated `TopicSummary` alias — gone from graphql-client-api + msg-layer.
7. `console.log` in production paths — none across `apps/*/server` + `packages/*/src`
   (incl. the new notify composables/mappers and auth-layer components).
8. `packages/tenant-layer/server/middleware/auth.ts` comment — correct (describes sealed-session
   claim population, no cookie-refresh claim).
10. `packages/auth-server/src/ping.ts` scaffolding — gone.

## Fixed inline this run

- **`apps/graphql-api-app/postgraphile.tags.json5`** (plan item #9 residue) — the file now carries
  real smart tags (n8n/notify run-log renames, tenant self-FK, asset column hiding, game + res
  behaviors), but the trailing `permission` class block still held the original PostGraphile
  boilerplate: commented-out example `foreignKey`/`attribute` scaffolding referencing nonexistent
  `post`/`user`/`organization` tables (`name: 'permission2'`, `references user (id)`, a `body`
  column). That is misleading dead-code-that-looks-alive. Trimmed to just the real
  `description` override on the `permission` table; removed the fake-table example comments.
  Comment-only change in a json5 tags file → no schema/codegen/build impact.

## New-code sweep (landed since 2026-07-19) — clean

- No empty dirs under `apps/`/`packages/`/`db/` (excluding build artifacts).
- No `TODO`/`FIXME`/`XXX`/`HACK`/`debugger` in the new notify/auth code (grep hits were all
  false positives: todo-module status colors in `auth-layer/app/utils/status.ts`, HTML
  `placeholder` attrs and the `+1XXXXXXXXXX` phone-format string in `PhoneSegments.vue`).
- `auth-layer/app/utils/status.ts` confirmed live (consumed by UserProfile, TopicList,
  AssetList, WorkspaceSwitcher, many tenant-app pages) — not dead despite the "todo" mentions.

## Observation (not fixed — needs user decision, did not delete a committed deliverable)

- **`notification-send-flow.png`** — a 73 KB PNG committed at the repo root on 2026-07-22,
  referenced nowhere in the repo (grep across md/json/vue/all-text empty). Looks like a workflow
  screenshot dropped in during the notify work; it is the only tracked root-level image. Left in
  place rather than deleted — it is a user-committed binary and may be intended for a spec/doc
  reference. Recommend the user either wire it into the notifications spec/README or remove it.

## Spawned identified/ items

None — the only actionable finding was fixable inline.

## Gate

`pnpm build` — **green** (13/13 tasks; task count rose from 12 → 13 with the notify surface).
The tags.json5 edit is comment-only json5 and does not affect the build. Docker restart +
read-only smoke remains the user's step (never restarted by the agent).
