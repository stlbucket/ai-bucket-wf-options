# Monorepo Bootstrap Pattern

This document describes the root-level infrastructure that ties the monorepo together:
workspace config, task runner, Docker topology, and Caddy routing. Read this when recreating
the monorepo from scratch or when adding infrastructure for a new app.

---

## Workspace & Package Manager

**`pnpm-workspace.yaml`** (monorepo root):
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

All directories under `apps/` and `packages/` are workspace packages. No individual `db/`
packages are in the workspace — those are sqitch only.

**Root `package.json`:**
```json
{
  "name": "function-bucket",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "format": "prettier --write \"**/*.{ts,vue,js,json,md}\"",
    "db-start": "tsx scripts/db-start.ts",
    "db-stop": "tsx scripts/db-stop.ts",
    "db-deploy": "tsx scripts/db-deploy.ts",
    "db-rebuild": "tsx scripts/db-rebuild.ts",
    "db-psql": "tsx scripts/db-psql.ts",
    "db-exec": "tsx scripts/db-exec.ts",
    "db-status": "tsx scripts/db-status.ts",
    "env-build": "tsx scripts/env-build.ts",
    "env-destroy": "tsx scripts/env-destroy.ts",
    "env-rebuild": "tsx scripts/env-destroy.ts && tsx scripts/env-build.ts"
  },
  "devDependencies": {
    "turbo": "^2.9.6",
    "typescript": "^6.0.2",
    "prettier": "^3.8.2",
    "eslint": "^10.2.0",
    "@nuxt/eslint": "^1.15.2",
    "vitest": "^4.1.4",
    "tsx": "^4.19.4"
  },
  "engines": { "node": ">=20.0.0", "pnpm": ">=9.0.0" },
  "packageManager": "pnpm@10.17.0",
  "pnpm": {
    "overrides": { "h3": "1.15.11" }
  }
}
```

The `h3` override is required — different packages pull in different minor versions of h3
and the WebSocket resolution bug fix requires a specific version.

**`turbo.json`:**
```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".output/**", "dist/**", ".nuxt/**"]
    },
    "dev": { "cache": false, "persistent": true },
    "test": { "dependsOn": ["^build"], "outputs": ["coverage/**"] },
    "lint": { "dependsOn": ["^build"] }
  }
}
```

The `^build` dependency means a package builds its upstream dependencies first. Compiled
packages (`db-access`, `graphql-client-api`, `auth-server`, `auth-ui`) build before Nuxt apps
that consume them.

---

## Dockerfile (shared across all apps)

All apps use the same Dockerfile at `apps/auth-app/Dockerfile`:
```dockerfile
FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@10.17.0 --activate

WORKDIR /app

EXPOSE 3000
```

The Dockerfile doesn't copy source — source is bind-mounted as a volume in `docker-compose.yml`.
This keeps the image minimal; the container runs `nuxt dev` against the live source tree.

---

## Docker Compose Architecture

### Networks and volumes

```yaml
networks:
  fnb-network:
    name: fnb-network

volumes:
  db-data:               # PostgreSQL data persistence
  node_modules_root:     # shared root node_modules
  node_modules_<app>_app:  # per-app node_modules (one per app)
```

Each app needs its own named `node_modules_<slug>_app` volume. Using separate volumes
prevents pnpm workspaces from flattening incorrectly across container restarts.

### Service startup order

```
db → db-migrate ┐
pnpm-install    ├→ packages-watch → [all apps]
                └→ [all apps depend on db-migrate + packages-watch]
```

### Core services

> **Config is `.env`-driven with no silent defaults.** Every configurable value lives in the
> repo-root `.env` (single source of truth). `docker-compose.yml` interpolates each as `${VAR:?}`,
> so a missing value makes `docker compose up` (and `docker compose config`) fail loudly naming the
> variable — there are no `${VAR:-default}` fallbacks. Server code reads each `process.env.X`
> through a local `requiredEnv(name)` helper that throws on missing/empty (covers host scripts /
> future prod). Nuxt configs use `''` sentinels + `NUXT_*` runtime env (they must not throw — host
> `pnpm build` evaluates them without the dev env). The only literals that stay in compose are the
> **structural constants** coupled to `docker/Caddyfile` (which can't read `.env`): per-app
> `NUXT_APP_BASE_URL`, `NUXT_HOST=0.0.0.0`, `NUXT_PORT=3000`, in-container port `3000`.
> `cp .env.example .env` yields a bootable dev environment. See `env-consolidation.plan.md`.

**`db`** — PostGIS (postgres with geospatial extensions):
- Image: `postgis/postgis` (required for `loc` module; harmless for others)
- Port: `${DB_HOST_PORT:?}:5432` on host
- Healthcheck: `pg_isready -h 127.0.0.1 -U ${POSTGRES_USER:?} -d ${POSTGRES_DB:?}`

**`db-migrate`** — Sqitch migrations runner:
- Runs all sqitch deploy commands and exits (`restart: "no"`)
- `DEPLOY_PACKAGES` (required, `${DEPLOY_PACKAGES:?}`) controls which packages to deploy — it lives
  in `.env` as the single source of truth and carries the full ordered list (`fnb-auth fnb-app
  fnb-agent fnb-n8n fnb-res fnb-msg fnb-todo fnb-loc fnb-storage fnb-location-datasets
  fnb-airports`; `fnb-agent` must precede `fnb-storage`/`fnb-location-datasets`/`fnb-airports` —
  `agent_worker` grants + `agent_fn` refs). PostGraphile exposes the module schemas
  (`graphile.config.ts` `pgServices.schemas`), so all eleven must deploy or it fails at boot.
  `.env.example` ships the full list pre-filled (not a comment).
- `depends_on: db: condition: service_healthy`

**`pnpm-install`** — One-shot pnpm install:
- Mounts the entire source tree + named node_modules volumes for root and each app
- Runs `pnpm install` and exits (`restart: "no"`)
- Every app and packages-watch depend on this completing successfully

**`packages-watch`** — Builds + watches the four compiled packages (`db-access`,
`graphql-client-api`, `auth-server`, `auth-ui`) — build all, then `dev`-watch all:
```yaml
command: ["sh", "-c", "
  pnpm --filter @function-bucket/fnb-db-access build &&
  pnpm --filter @function-bucket/fnb-graphql-client-api build &&
  pnpm --filter @function-bucket/fnb-auth-server build &&
  pnpm --filter @function-bucket/fnb-auth-ui build &&
  pnpm --filter @function-bucket/fnb-db-access dev &
  pnpm --filter @function-bucket/fnb-graphql-client-api dev &
  pnpm --filter @function-bucket/fnb-auth-server dev &
  pnpm --filter @function-bucket/fnb-auth-ui dev &
  wait"]
healthcheck:
  test: ["CMD-SHELL", "test -f /app/packages/db-access/dist/index.js &&
         test -f /app/packages/auth-server/dist/index.js &&
         test -f /app/packages/auth-ui/dist/index.js &&
         test -f /app/packages/graphql-client-api/dist/index.js"]
  interval: 3s
  retries: 20
  start_period: 60s
```
Apps wait for this healthcheck before starting. The initial `build` ensures dist files exist
before `dev` watch mode begins. Do NOT add new compiled packages to this service without also
adding them to the healthcheck test.

**`zitadel` / `zitadel-init` / `zitadel-seed`** — the identity provider (OIDC login ceremony
only; full contract in `.claude/specs/future-auth/zitadel-login-pattern.md` — do not restate it
here):
- `zitadel` — `ghcr.io/zitadel/zitadel` (pinned), `start-from-init --masterkeyFromEnv --tlsMode
  disabled`, dedicated `zitadel` database inside the shared postgis container
  (`docker/db-init/10-create-zitadel-db.sh` on a fresh volume). **Own host port**
  (`${ZITADEL_HOST_PORT:?}`, like minio) — the issuer must own its origin, so no Caddy path
  prefix and no Caddy change. Healthcheck is `/app/zitadel ready` (distroless image, no curl);
  `ZITADEL_TLS_ENABLED=false` must stay in env because `ready` reads env only, not start flags.
- `zitadel-init` — one-shot chown of the `zitadel-seed` volume to uid 1000 (the distroless
  image's user) so FirstInstance can write the machine PAT.
- `zitadel-seed` — one-shot idempotent seeding (`docker/zitadel/seed.mjs`, PAT auth): project,
  Web app (PKCE + Dev Mode), dev users mirroring `db/seed.sql`, and the `{ issuer, clientId }`
  handoff JSON that auth-app reads at runtime (volume `zitadel-seed`, mounted `ro` into auth-app).
- Env: `ZITADEL_HOST_PORT`, `ZITADEL_MASTERKEY` (32 chars, immutable per volume-lifetime),
  `ZITADEL_DB_PASSWORD`, `ZITADEL_ADMIN_PASSWORD`, `NUXT_ZITADEL_ISSUER`,
  `NUXT_ZITADEL_INTERNAL_URL`, `NUXT_ZITADEL_SEED_FILE`; plus `NUXT_SESSION_SECRET` (sealed
  session cookie, issue 0010) on every session-parsing app.
- auth-app additionally `depends_on: zitadel-seed: service_completed_successfully`.

**`caddy`** — Path-based proxy (`caddy:2`), port `${PORT:?}` (required; `.env` bakes the port into
every `http://localhost:PORT/...` URL — no port hunting, `env-build.ts` only preflights that it's
free). Dev is plain HTTP (`auto_https off`); it is the same-syntax sibling of the prod TLS front
door `infra/docker/Caddyfile` (spec `.claude/specs/deployment/dev-caddy-migration/README.md`):
```yaml
depends_on: [auth-app, tenant-app, home-app, msg-app, game-app]  # add new apps here
volumes:
  - ./docker/Caddyfile:/etc/caddy/Caddyfile:ro
```

**App service template:**
```yaml
  <slug>-app:
    build:
      context: .
      dockerfile: apps/auth-app/Dockerfile    # all apps share this Dockerfile
    networks: [fnb-network]
    depends_on:
      pnpm-install: { condition: service_completed_successfully }
      db-migrate:   { condition: service_completed_successfully }
      packages-watch: { condition: service_healthy }
    environment:
      NODE_ENV: "${NODE_ENV:?}"
      NUXT_HOST: "0.0.0.0"                                   # D2 structural constant (Caddy-coupled)
      NUXT_PORT: "3000"                                      # D2 structural constant (Caddy-coupled)
      NUXT_APP_BASE_URL: "/<slug>"                           # D2 structural constant; omit for home-app (serves /)
      NUXT_PUBLIC_AUTH_APP_URL: "${NUXT_PUBLIC_AUTH_APP_URL:?}"
      NUXT_PUBLIC_GRAPHQL_API_URL: "${NUXT_PUBLIC_GRAPHQL_API_URL:?}"
      NUXT_AUTH_APP_INTERNAL_URL: "${NUXT_AUTH_APP_INTERNAL_URL:?}"
      DATABASE_URL: "${DATABASE_URL:?}"
      VITE_HMR_CLIENT_PORT: "${VITE_HMR_CLIENT_PORT:?}"
    volumes:
      - .:/app
      - node_modules_root:/app/node_modules
      - node_modules_<slug>_app:/app/apps/<slug>-app/node_modules
    working_dir: /app
    command: ["sh", "-c",
      "pnpm --filter @function-bucket/fnb-<slug>-app exec nuxt dev --host 0.0.0.0 --port 3000"]
```

**`dozzle`** — Log viewer at port 8888, filters to containers named `fnb`.

---

## Caddy Routing (`docker/Caddyfile`)

Dev and prod share Caddy (this dev `docker/Caddyfile` is the plain-HTTP sibling of the prod TLS
front door `infra/docker/Caddyfile`; migration spec `.claude/specs/deployment/dev-caddy-migration/`).
Caddy handles the WebSocket `Upgrade`/`Connection` dance automatically — Vite HMR **and** app
WebSockets — so there is no nginx-style `map $http_upgrade` block; forwarded headers
(`Host`/`X-Real-IP`/`X-Forwarded-*`) are set by `reverse_proxy` automatically:
```caddyfile
{ auto_https off }          # dev: no domain, no Let's Encrypt

:80 {
    # SSE stream — before the general /graphql-api block, no buffering.
    handle /graphql-api/api/graphql/stream* { reverse_proxy graphql-api-app:3000 { flush_interval -1 } }
    handle /auth*    { reverse_proxy auth-app:3000 }
    handle /tenant*  { reverse_proxy tenant-app:3000 }
    handle /msg*     { reverse_proxy msg-app:3000 }
    handle /game*    { reverse_proxy game-app:3000 }        # WS only — no user pages (game-server spec)
    handle /storage* { request_body { max_size 6MB } reverse_proxy storage-app:3000 }  # keep 6MB aligned w/ upload.post.ts
    handle /graphql-api* { reverse_proxy graphql-api-app:3000 }
    handle /ruru-static* { reverse_proxy graphql-api-app:3000 }
    handle           { reverse_proxy home-app:3000 }        # catch-all must be last
}
```

**Rule:** new app `handle` blocks go BEFORE the catch-all `handle { … }`. The catch-all must always
be last. The `reverse_proxy` upstream must match the Docker service name exactly.

### How `NUXT_APP_BASE_URL` and Caddy interact

`NUXT_APP_BASE_URL` sets Nuxt's router base and asset URL prefix. It must exactly match the
Caddy `handle` prefix. Example: `/tenant` maps to both `NUXT_APP_BASE_URL=/tenant` and
`handle /tenant*`. Mismatch causes 404s on assets and broken `<NuxtLink>` navigation.

`home-app` is the exception — it serves `/` with no base URL override.

---

## Dev startup performance (Vite prebundle + route warmup)

All apps run `nuxt dev`, which compiles lazily per-route, per-app — so first visits feel slow
and an un-prebundled dep triggers a mid-request full-page reload. Two **dev-server-only** Vite
keys mitigate this (both ignored by `nuxt build`); see spec `.claude/specs/dev-startup-performance/`.

- **`vite.optimizeDeps.include`** — heavy **browser** deps prebundled at boot. Lives in
  `packages/auth-layer/nuxt.config.ts` (the extends-chain root; defu concatenates the array into
  every app). **Only bare specifiers resolvable from an app root** belong here — transitive-only
  deps warn `Unresolvable` and are already covered by their parent's prebundle (e.g. `@urql/vue`
  covers `@urql/core`/`graphql`; `@nuxt/ui` covers `tailwind-variants`/`@internationalized/date`).
  App-specific heavy deps go in **that app's own** block (e.g. tenant-app pins `mapbox-gl`).
- **`vite.server.warmup.clientFiles: ['./app/pages/**/*.vue']`** — also in auth-layer; transforms
  each app's page graph at startup (glob resolves against the consuming app's `rootDir`).

The authoritative `include` list comes from the dev logs (`new dependencies optimized … reloading`
= add it; `Unresolvable optimizeDeps.include` = remove it), never from guessing.

---

## Adding a New App: Infrastructure Checklist

When adding `<slug>-app`:

1. Add `node_modules_<slug>_app:` to the top-level `volumes:` section
2. Add `- node_modules_<slug>_app:/app/apps/<slug>-app/node_modules` to `pnpm-install` volumes
3. Add the full app service block (see template above)
4. Add `<slug>-app` to `caddy` service `depends_on`
5. Add `handle /<slug>* { reverse_proxy <slug>-app:3000 }` before the catch-all `handle` in `docker/Caddyfile`

See `fnb-create-app` skill for the complete file-by-file scaffold.

### Headless apps (agent-app)

`apps/agent-app` is the one **headless** app: the primary workflow engine (Claude Agent SDK
harness — R22; spec `.claude/specs/agentic-workflow-engine/`; the parallel **n8n engine** is
not an app but a service trio — see below). It follows the app service
template but **skips checklist steps 4–5** (no Caddy entry, no `NUXT_APP_BASE_URL`, not in
`pinger`) and differs from the routed apps in:
- **dedicated Dockerfile** (`apps/agent-app/Dockerfile`): `ffmpeg` + `clamav-clamdscan` system
  binaries (Alpine's clamdscan package — Debian calls it `clamav-clients`) + the baked-in
  `clamd-remote.conf`; binaries run only inside tool handlers.
- `depends_on` adds `minio-init` (completed) + `clamav` (started — SOFT gate: the scan tool's
  retry + the reaper own the warm-up horizon).
- env: `ANTHROPIC_API_KEY`, `AGENT_*`, `PG*` (the `agent_worker` pool), `S3_*`, `CLAMAV_*`,
  `ASSET_SCAN_*` — plus the `agent-transcripts` volume at `/data/transcripts`.
- It listens on `:3000` compose-internal only; graphql-api-app and storage-app reach it at
  `AGENT_INTERNAL_URL=http://agent-app:3000` (trigger routes are secret-gated).
It deploys **after db-migrate** (the `fnb-agent` schema + `agent_worker` role must exist).
There is no graphile-worker/job-queue service anywhere in the stack.

### The n8n engine services (`n8n-db-init` / `n8n-import` / `n8n`)

The **parallel n8n workflow engine** (R22; spec `.claude/specs/n8n-parallel-engine/` — do not
restate it here) is three compose services, not an app:
- `n8n-db-init` — one-shot (`docker/n8n/db-init.sh`, postgis image): idempotently creates the
  separate **`n8n_engine` database** + owner login role in the shared postgis container.
  Gotcha baked into the script: psql only substitutes `:'var'` in stdin/`-f` input, never `-c`.
- `n8n-import` — one-shot, same pinned n8n image as the server: renders
  `n8n/credentials/*.json.tpl` with the image's node (`n8n/scripts/render-credentials.mjs` —
  no gettext in the stock image, values JSON-escaped) then `n8n import:credentials` +
  `import:workflow --separate` from `n8n/workflows/`. Stable ids → idempotent overwrite (the
  sqitch/seed analog).
- `n8n` — the engine (official image, **pinned**), **own host port** `N8N_HOST_PORT`
  (ZITADEL own-port precedent, no Caddy route), volume `n8n-data`, healthcheck probes
  `http://127.0.0.1:5678/healthz` (**not** `localhost` — the alpine image resolves it to `::1`
  and n8n listens IPv4-only). Boots after `n8n-import` + `db-migrate` (the `fnb-n8n` schema +
  `n8n_worker` role).
Env additions elsewhere: graphql-api-app gets `N8N_INTERNAL_URL` + `N8N_WEBHOOK_SECRET`
(trigger-plugin registry), tenant-app gets `NUXT_PUBLIC_N8N_EDITOR_URL` (site-admin editor
link-out), db-migrate gets `N8N_WORKER_PG_PASSWORD` (threaded as `--set n8n_worker_password`).
