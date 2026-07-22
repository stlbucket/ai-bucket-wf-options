# first-run-setup — Infrastructure (empty-env build)

## Status
**Ready** — all open questions resolved (2026-07-21).

## Goal

A second dev entry point — **`pnpm env-build-empty`** — that stands up the full stack with the
schema deployed but **no seed data beyond the app installation path**: no anchor tenant, no
profiles, no ZITADEL user roster. The existing `env-build` / `env-rebuild` stay **byte-for-byte
intact** (the fat dev seed remains the default). The empty env is what the `/auth/setup` flow
drives.

Because the base application is installed **inside** the setup flow (`create_anchor_tenant` →
`install_anchor_application`), "no seed data other than the installation of the apps" resolves to:
**skip `db/seed.sql` and skip the ZITADEL user roster** — the app rows appear the moment the first
admin submits setup. (The sqitch deploy of all schema packages always runs — that is not "seed".)

## The single control flag: `SEED_DATA`

One env var threads through both seeders. Default keeps today's behavior.

| `SEED_DATA` | `db-migrate` | `zitadel-seed` |
|---|---|---|
| `full` (default / unset) | runs `db/seed.sql` (anchor + dev users) | seeds project + web app + **dev user roster** + branding |
| `empty` | **skips** `db/seed.sql` | seeds project + web app + branding, **no users** |

`empty` is distinct from the existing `ZITADEL_SEED_MODE=prod` (deployment spec): prod also flips
`devMode` off and targets the https origin. `empty` is a **dev** env — it keeps `devMode` on and
the `http://localhost:${APP_PORT}` redirect URIs, just without the user roster.

### Wiring

- **`docker-compose.yml`** — pass the flag into both jobs (compose interpolates from the
  child-process env that `env-build-empty` sets; default `full`):
  ```yaml
  db-migrate:
    environment:
      SEED_DATA: "${SEED_DATA:-full}"
  zitadel-seed:
    environment:
      SEED_DATA: "${SEED_DATA:-full}"
  ```
- **`docker/migrate-entrypoint.sh`** — guard the seed step (roles + sqitch deploy unchanged):
  ```sh
  if [ "${SEED_DATA:-full}" = "empty" ]; then
    echo "==> SEED_DATA=empty — skipping db/seed.sql"
  else
    echo "==> Running seed..."
    psql "$PG_URL" -f /db/seed.sql
    echo "==> Seed complete."
  fi
  ```
- **`docker/zitadel/seed.mjs`** — gate only the user-roster loop; keep `ensureProject`,
  `ensureWebApp`, `ensureBranding`, and the `{ issuer, clientId }` handoff (auth-app depends on
  the clientId file to boot):
  ```js
  const SEED_USERS_ENABLED = (process.env.SEED_DATA ?? 'full') !== 'empty' && !IS_PROD
  // ... later, guard the `for (const user of SEED_USERS)` loop with SEED_USERS_ENABLED
  ```
  (prod already seeds no users; `empty` folds into the same "skip roster" branch while staying on
  the dev origin/devMode.)

### auth-app service env additions (for the runtime ZITADEL admin client + setup token)

`auth-app` already mounts `zitadel-seed:/zitadel-seed:ro` and already has
`NUXT_ZITADEL_INTERNAL_URL` / `NUXT_ZITADEL_ISSUER` — the admin util reads **those existing names
directly** (resolved 2026-07-21; consistent with `server/utils/oidc.ts`, see `setup.data.md`
§Env naming). So no `ZITADEL_INTERNAL_URL` / `ZITADEL_EXTERNAL_HOST` aliases are introduced. Only
**two genuinely new vars** get added to the service:

```yaml
  auth-app:
    environment:
      # NUXT_ZITADEL_INTERNAL_URL and NUXT_ZITADEL_ISSUER already present — reused as-is.
      ZITADEL_PAT_FILE: "/zitadel-seed/admin.pat"   # seeder PAT (volume already mounted :ro)
      SETUP_TOKEN: "${SETUP_TOKEN:?SETUP_TOKEN required — first-run setup gate}"
```

`SETUP_TOKEN` is a **required** operator secret (the `initialize` gate fails closed without it —
`setup.data.md` §Auth). Add it to `.env` / `.env.example` with a generated value, e.g.
`SETUP_TOKEN=$(openssl rand -hex 24)`. It is required in **every** environment including dev, so
the empty-env build below assumes `.env` supplies it (the `:?` interpolation aborts the stack with
a clear message if it is missing). The host portion of `NUXT_ZITADEL_ISSUER` is derived **in the
util**, so no separate host var is needed.

## The new script — `scripts/env-build-empty.ts`

Mirrors `scripts/env-build.ts` (port preflight + `docker compose up --build`) but sets
`SEED_DATA=empty` in the compose child env. **`env-build.ts` is not touched.**

```ts
import { execSync } from 'child_process'
import net from 'node:net'
import { requiredEnv } from './_env'

const PORT = Number(requiredEnv('PORT'))

function isPortFree(port: number): Promise<boolean> { /* identical to env-build.ts */ }

;(async () => {
  if (!(await isPortFree(PORT))) {
    console.error(`Port ${PORT} is already in use — edit PORT in .env ...`)
    process.exit(1)
  }
  console.log(`Starting EMPTY env (no seed data) on http://localhost:${PORT}`)
  console.log('First open → /auth/setup to create the anchor tenant + site admin.')
  execSync('docker compose up --build', {
    stdio: 'inherit',
    env: { ...process.env, SEED_DATA: 'empty' },   // ← the only difference
  })
})()
```

**`isPortFree` (resolved 2026-07-21): duplicate the helper.** Copy the tiny `isPortFree` function
verbatim into `env-build-empty.ts` rather than refactoring it into `scripts/_env`. This keeps
`env-build.ts` **byte-for-byte untouched** (the whole point of the empty path) at the cost of a few
duplicated lines — an acceptable trade for zero blast radius on the default build.

## `package.json` scripts (root)

Add alongside the existing ones (leave `env-build` / `env-rebuild` unchanged):

```jsonc
"env-build-empty": "tsx scripts/env-build-empty.ts",
"env-rebuild-empty": "tsx scripts/env-destroy.ts && tsx scripts/env-build-empty.ts"
```

**Include `env-rebuild-empty` (resolved 2026-07-21: yes).** `env-destroy` is seed-agnostic, so it
composes cleanly in front of `env-build-empty`, giving the empty path the same rebuild ergonomics
as the default (`env-rebuild`).

## Verification (empty-env smoke)

1. `pnpm env-destroy && pnpm env-build-empty` → stack up; `db-migrate` logs "skipping db/seed.sql";
   `zitadel-seed` logs project/app/branding but no user creations.
2. `select count(*) from app.tenant;` → **0**; `select count(*) from app.profile;` → **0**.
3. ZITADEL console: project `fnb` + app `fnb-web` exist; org has only the FirstInstance
   admin/machine users (no dev roster).
4. Open the site → routed to `/auth/setup`. Submit the form, supplying the `.env` `SETUP_TOKEN` in
   the **Setup token** field. Confirm a **wrong** token is rejected with a 403 before anything is
   created, and that an unset server `SETUP_TOKEN` aborts the stack at compose (the `:?` guard).
5. Anchor tenant + one `app-admin-super` profile exist; a matching ZITADEL human user exists
   (created with `changeRequired: false`); `/auth/setup` now returns `needsSetup:false` and the
   success path **auto-redirects into the ZITADEL OIDC login**; signing in lands in the site-admin
   session.
6. `pnpm env-build` (default) still seeds the full dev roster — unchanged.
