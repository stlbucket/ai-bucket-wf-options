# Execution log — 0010_recur__dead-code-sweep — 2026-07-19

## Fixed inline

1. **`scripts/db-generate.ts`** removed (still targeted the retired `packages/db-types`
   Kysely/Kanel package) + the `"db-generate"` entry removed from root `package.json`.
2. **`db/my-app/`** deleted — undeployed template cruft (not in `DEPLOY_PACKAGES`); the
   correct-template concern is covered by the `new-db-package` skill.
3. **`db/db-config.ts`** deleted (new find this run) — dead: `scripts/db-deploy.ts` reads
   `DEPLOY_PACKAGES` from `.env` and its own comment said the file was no longer consulted;
   its package list was also badly stale (listed retired `fnb-wf`, missing `fnb-agent`,
   `fnb-n8n`, `fnb-res`, `fnb-location-datasets`, `fnb-airports`). Comment in `db-deploy.ts`
   updated. Doc mentions of `db-config.ts` in `monorepo-bootstrap-pattern.md` and
   `new-db-package/SKILL.md` queued for the 0040/0050 legs of this same run.
4. **`node_modules_wf_app` volume** removed from `docker-compose.yml` (no `wf-app` service).
5. **Stale per-app `pnpm-lock.yaml`** removed from `apps/auth-app`, `apps/home-app`,
   `apps/tenant-app` (all still referenced long-gone `uploadthing`; root lockfile is
   authoritative in the pnpm workspace).
6. **Deprecated `TopicSummary` alias** removed from
   `packages/graphql-client-api/src/composables/useMsgTopics.ts`; msg-layer re-export and
   `TopicList.vue` switched to `SubscribedTopicSummary`.
7. **`console.log` → `console.error`** in `packages/auth-server/src/use-pg-client.ts`
   (intentional error logging kept, correct stream). All other console.logs listed in the
   plan were already gone (the graphql-api-app worker/mutation-hook files no longer exist —
   retired with graphile-worker).
8. **Stale comment fixed** in `packages/tenant-layer/server/middleware/auth.ts` (no cookie is
   refreshed; claims come from the sealed session cookie).
9. **Ping scaffolding removed**: `packages/auth-server/src/ping.ts` (+ barrel line),
   `apps/auth-app/app/components/Ping.vue`, `apps/auth-app/app/pages/ping.vue`. Its only
   consumer was the scaffold page itself. Spec mention (`auth-app/current-profile-claims.data.md`
   page list) queued for the 0040 leg.

## Already resolved before this run (no action)

- Empty `apps/auth-app/server/api/tenants/` dir — gone.
- `apps/graphql-api-app/postgraphile.tags.json5` — no longer boilerplate; now carries real,
  documented smart tags (n8n_api rename, tenant FK inflection, storage column hiding).

## Spawned identified/ items

None — everything fixable inline.

## Gate

`pnpm build` — **green** (12/12 tasks). No ESM barrel crash risk left un-checked: the two
barrels touched (`auth-server`, `graphql-client-api` type-only alias) rebuilt clean.
Docker restart + read-only smoke still pending on the user (never restarted by the agent).
