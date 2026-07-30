# Plan: Consolidate ALL configuration into `.env` — no silent defaults anywhere

> **Execution Directive:** Implement via the `fnb-stack-implementor` skill.
> Invoke: `/fnb-stack-implementor .claude/issues/identified/env-consolidation.plan.md`
> Gate is `pnpm build` (repo-wide `pnpm lint` is known-broken). Never run `git`; never
> rebuild/restart Docker yourself — ask the user to run `docker compose down && docker compose up`,
> then verify read-only. `docker compose config` is the cheap pre-restart check: it renders the
> compose file with `.env` interpolation and fails loudly on any `${VAR:?}` that is unset.

**Severity: MEDIUM (config hygiene / fail-fast)** · Workstream: infra · Identified: 2026-07-06

## Goal

1. Every configurable value lives in `.env` at the repo root — the single source of truth.
2. **Nothing has a silent default.** Every `?? 'fallback'`, `|| default`, `${VAR:-default}`, and
   hardcoded credential/URL in code, compose, and scripts is removed. Missing config fails fast
   with a clear error instead of silently running with a baked-in value.
3. `.env.example` contains **every** variable, fully commented, pre-filled with working dev values
   so `cp .env.example .env` produces a bootable development environment.

## Decisions (confirmed with user 2026-07-06)

- **D1 — Literal URLs, no port hunting.** Every full URL lives in `.env` verbatim (port baked in).
  `scripts/env-build.ts` stops hunting for a free port; it reads `PORT` from `.env` and fails fast
  with a clear message if that port is busy ("edit PORT in .env — and the URLs that embed it").
- **D2 — Structural constants stay in compose.** `NUXT_APP_BASE_URL` per app (`/auth`, `/tenant`,
  `/msg`, `/graphql-api`, `/storage`), `NUXT_HOST=0.0.0.0`, `NUXT_PORT=3000`, and the in-container
  ports in the `command:` lines remain literals in `docker-compose.yml` because they must exactly
  match `docker/nginx.conf` location blocks, which cannot read `.env`. `.env.example` gets a
  comment block explaining this exclusion.
- **D3 — Fail-fast is layered.** Compose-level: every interpolation becomes `${VAR:?}` (compose
  refuses to start when `.env` misses a value). Code-level: every `process.env.X` read in server
  code goes through a local 3-line `requiredEnv(name)` helper that throws on missing/empty —
  this covers non-compose contexts (host scripts, future prod).
- **D4 — Nuxt runtimeConfig uses `''` sentinels + `NUXT_*` runtime env.** Nuxt requires the key to
  exist in `runtimeConfig` for env override to apply; `''` is the Nuxt-idiomatic "no default".
  We must NOT throw inside `nuxt.config.ts` — it is evaluated by host-side `pnpm build` (the
  gate), which runs without the dev env. Runtime enforcement comes from compose `${VAR:?}`.
- **D5 — `.env.example` ships real dev values** (postgres/1234, fnbminio/fnbminio123, the already-
  committed public Mapbox `pk.` token). These are dev-only credentials already public in the repo;
  the point of the file is a working environment via `cp`.

## Complete variable inventory

### A — Already interpolated from `.env` (strip the `:-` defaults → `:?`)

| Var | Current default | Consumers |
|---|---|---|
| `PORT` | `4000` (compose `${PORT:-4000}`) | nginx port map; `VITE_HMR_CLIENT_PORT`; `NUXT_PUBLIC_MSG_APP_URL` |
| `DEPLOY_PACKAGES` | full 7-package list in compose | `db-migrate` |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | `fnbminio` / `fnbminio123` | minio, minio-init; aliased to `S3_ACCESS_KEY`/`S3_SECRET_KEY` |
| `S3_BUCKET` | `fnb-assets` | minio-init, graphql-api-app, storage-app, worker-app |
| `ASSET_SCAN_MAX_WF_ATTEMPTS` | `3` (code, `_asset-scan-config.ts:13`) | worker-app |
| `ASSET_SCAN_STUCK_MINUTES` | `15` (code, `_asset-scan-config.ts:16`) | worker-app |
| `ASSET_SCAN_REAPER_CRON` | `*/15 * * * *` (code, `graphile-worker.ts:40`) | worker-app |
| `PING_INTERVAL` | `30` (compose) / `10` (code, `pinger.mjs:1`) | pinger |

### B — Hardcoded in compose `environment:` blocks → move to `.env` + `${VAR:?}`

| Var | Current hardcoded value | Consumers |
|---|---|---|
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | `fnb` / `postgres` / `1234` | db service (+ healthcheck `-U`/`-d` flags — interpolate those too) |
| `DATABASE_URL` | `postgresql://postgres:1234@function_bucket:5432/fnb` | all app services (superuser today — value preserved here; changing the *role* is `superuser-database-url.plan.md`, not this plan) |
| `DB_URL` / `PG_URL` | `db:pg://…` / `postgresql://…` @function_bucket | db-migrate (sqitch/psql), scripts/db-*.ts |
| `NODE_ENV` | `development` | all app services; drives cookie `secure`, graphile watch/explain |
| `NUXT_PUBLIC_AUTH_APP_URL` | `http://localhost:4000/auth` (hardcoded port — breaks under non-4000 PORT today) | all UI apps |
| `NUXT_AUTH_APP_INTERNAL_URL` | `http://auth-app:3000/auth` | tenant/home/msg/graphql-api/storage (pass to auth-app too, for uniformity) |
| `NUXT_PUBLIC_MSG_APP_URL` | `http://localhost:${PORT:-4000}/msg` | tenant-app |
| `NUXT_MSG_APP_INTERNAL_URL` | `http://msg-app:3000/msg` | tenant-app |
| `S3_ENDPOINT` | `http://minio:9000` | graphql-api-app, storage-app, worker-app |
| `S3_PUBLIC_BASE_URL` | `http://localhost:9000/fnb-assets` | same 3 (presign/public URL base) |
| `S3_REGION` | `us-east-1` | same 3 |
| `S3_FORCE_PATH_STYLE` | `true` | same 3 |
| `CLAMAV_HOST` / `CLAMAV_PORT` | `clamav` / `3310` | worker-app |
| `DOZZLE_FILTER` | `name=fnb` | dozzle |
| Host port maps → new vars `DB_HOST_PORT`, `MINIO_API_PORT`, `MINIO_CONSOLE_PORT`, `CLAMAV_HOST_PORT`, `DOZZLE_PORT` | `5444`, `9000`, `9001`, `3310`, `8888` | ports: sections |

`S3_ACCESS_KEY`/`S3_SECRET_KEY` stay compose-side aliases of `${MINIO_ROOT_USER:?}`/
`${MINIO_ROOT_PASSWORD:?}` — one credential source, documented in `.env.example`.

### C — Consumed by code but never provided by compose today (latent bugs)

| Var | Problem | Fix |
|---|---|---|
| `NUXT_PUBLIC_GRAPHQL_API_URL` | never set; every app relies on the nuxt.config literal `http://localhost:4000/graphql-api/api/graphql` | add to `.env` + every app service |
| `NUXT_PUBLIC_UPLOAD_URL` | never set; storage-layer/app rely on config literal | add to `.env` + storage-app (and tenant-app if it extends storage-layer later) |
| `MAPBOX_ACCESS_TOKEN` | never set; tenant-app falls back to a token committed in `nuxt.config.ts` | move token value to `.env`; pass to tenant-app; delete the committed fallback |
| `GRAPHQL_SCHEMA_URL` (new) | `codegen.ts` hardcodes `http://localhost:4000/graphql-api/api/graphql` | codegen reads it from root `.env` |
| `AUTH_APP_URL` / `GRAPHQL_API_URL` / `UPLOAD_URL` | build-time names read in msg/storage nuxt.configs, never set anywhere — dead mechanism | delete; standardize on `NUXT_PUBLIC_*` runtime overrides |
| `DB_OWNER_CONNECTION` / `DB_CONNECTION` | dead fallback chain in `_scheduleUows.ts` — never set anywhere | delete chain; require `DATABASE_URL` |
| `ALPHA_VANTAGE_KEY` | read by stubbed wf-exerciser handler, unused | commented-out optional entry in `.env.example` |
| `NUXT_COOKIE_DOMAIN` | `cookieDomain: ''` exists in auth-layer/msg/storage configs | commented-out optional entry in `.env.example` |
| `MSG_DATABASE_URL` | present in current `.env`, **zero consumers** | delete (stale) |

### D — Code fallbacks to delete (replace with `requiredEnv` throw, or noted alternative)

1. `packages/db-access/src/pool.ts:11-15` — `DEFAULT_URL` (`authenticator@localhost:5444`)
2. `packages/auth-server/src/use-pg-client.ts:4` — `postgres:1234@localhost:5444`
3. `apps/worker-app/server/plugins/graphile-worker.ts:10` — superuser URL; `:40` — cron default
4. `apps/worker-app/server/lib/worker-task-handlers/_workflow-handler.ts:10` — superuser URL
5. `apps/graphql-api-app/server/graphile.config.ts:11` — `NUXT_APP_BASE_URL ?? ''` (require; also
   drop the stray `console.log('baseURl', …)`); `:29` — `authenticator@localhost:5444`
6. `apps/graphql-api-app/server/api/mutation-hooks/_scheduleUows.ts:2-3` — dead chain → require `DATABASE_URL`
7. `apps/worker-app/server/lib/clam.ts:13-14` — `CLAMAV_PORT ?? 3310`; require both host and port
8. `apps/worker-app/server/lib/worker-task-handlers/_asset-scan-config.ts:7-16` — `envInt` silently
   maps empty/NaN/≤0 to a default (existed because compose used to pass empty strings; with
   `${VAR:?}` that can't happen). New behavior: throw on missing or non-positive-int.
9. `apps/graphql-api-app/server/lib/s3.ts`, `apps/worker-app/server/lib/s3.ts`,
   `packages/storage-layer/server/lib/s3.ts` — bare `process.env.S3_*` (undefined passes silently
   into the SDK) → `requiredEnv` for endpoint/region/keys; `S3_FORCE_PATH_STYLE` required too
10. `packages/storage-layer/server/api/upload.post.ts:98` — `S3_BUCKET!` non-null assertion → `requiredEnv`
11. `apps/graphql-api-app/server/graphile/asset-download-url.plugin.ts:8` — `PUBLIC_BASE` → `requiredEnv('S3_PUBLIC_BASE_URL')`
12. All six app `nuxt.config.ts` — `VITE_HMR_CLIENT_PORT ?? '3000'`: cannot throw (host `pnpm build`
    evaluates the config, D4). Replace with conditional spread — only configure `vite.server.hmr`
    when the var is present:
    ```ts
    vite: {
      server: {
        ...(process.env.VITE_HMR_CLIENT_PORT
          ? { hmr: { clientPort: parseInt(process.env.VITE_HMR_CLIENT_PORT) } }
          : {})
      }
    }
    ```
13. `apps/{auth,tenant,home,graphql-api}-app/nuxt.config.ts` — literal `authAppUrl`/`graphqlApiUrl`
    (and tenant's `msgAppUrl`/`msgAppInternalUrl`) → `''` sentinels
14. `apps/{msg,storage}-app/nuxt.config.ts` — `process.env.AUTH_APP_URL ?? …` etc. → `''` sentinels
15. `packages/auth-layer/nuxt.config.ts:12` — `authAppInternalUrl: 'http://localhost:4000/auth'` → `''`
16. `packages/storage-layer/nuxt.config.ts:13` — `uploadUrl` literal → `''`
17. `apps/tenant-app/nuxt.config.ts:49` — `MAPBOX_ACCESS_TOKEN ?? '<committed pk token>'` →
    `process.env.MAPBOX_ACCESS_TOKEN ?? ''` (empty at host build is fine; real value flows from
    compose at dev start; nuxt-mapbox reads it at config-eval time so it cannot be a `NUXT_*`
    runtime override)
18. `docker/pinger/pinger.mjs:1` — `PING_INTERVAL ?? '10'` → require (throw + exit 1)
19. `docker/migrate-entrypoint.sh:4-5` — `${DB_URL:-…}`/`${PG_URL:-…}` → `${DB_URL:?}`/`${PG_URL:?}`;
    `DEPLOY_PACKAGES` is unguarded there — add `${DEPLOY_PACKAGES:?}`
20. `packages/graphql-client-api/codegen.ts:4` — hardcoded schema URL → `GRAPHQL_SCHEMA_URL` loaded
    from the **repo-root** `.env` (add `dotenv` devDep; `config({ path: resolve(__dirname, '../../.env') })`),
    throw if unset
21. `scripts/db-{status,psql,deploy,rebuild,exec}.ts` — hardcoded `postgres:1234@function_bucket`
    URLs → new shared `scripts/_env.ts` loader (dotenv on root `.env` + `requiredEnv`) providing
    `PG_URL`/`DB_URL`. `db-rebuild.ts` needs the `/postgres` maintenance-DB variant — derive it by
    replacing the database path segment of `PG_URL`, don't add another var
22. `scripts/db-start.ts` — hardcoded `POSTGRES_*` and `5444` → read from `.env` via `_env.ts`
23. `scripts/env-build.ts` — per D1: delete `findFreePort`, read `PORT` via `_env.ts`, preflight
    "port free?" check with a clear failure message. Also **stop injecting `DEPLOY_PACKAGES`**
    (it currently shadows `.env` via shell-env precedence) — `.env` is the single source;
    `db/db-config.ts` stays untouched but is no longer consulted for the deploy list

## `.env.example` — full draft (the deliverable's centerpiece)

```bash
# ══════════════════════════════════════════════════════════════════════════════
# fnb development environment — copy to .env and boot: cp .env.example .env
#
# EVERY value is REQUIRED unless explicitly marked optional. There are no
# defaults in code or docker-compose.yml — a missing value fails fast at
# `docker compose up` (via ${VAR:?}) or at process start (requiredEnv throw).
#
# NOT here by design (structural constants coupled to docker/nginx.conf, which
# cannot read .env): per-app NUXT_APP_BASE_URL (/auth /tenant /msg /graphql-api
# /storage), NUXT_HOST=0.0.0.0, NUXT_PORT=3000, and the in-container port 3000.
# Change those in docker-compose.yml + docker/nginx.conf in lockstep.
# ══════════════════════════════════════════════════════════════════════════════

# ─── Stack entry point ────────────────────────────────────────────────────────
# Host port nginx listens on. Every http://localhost:4000/... URL below embeds
# it — if you change PORT, update all of them (deliberate: no derived values).
PORT=4000
# Passed to every app container. Drives cookie `secure` flag (auth-cookies.ts),
# PostGraphile watch/explain/GraphiQL (graphile.config.ts).
NODE_ENV=development
# Vite HMR websocket port as seen from the browser — keep equal to PORT.
VITE_HMR_CLIENT_PORT=4000

# ─── Postgres (db service + migrations) ───────────────────────────────────────
# Dev-only credentials; the db container initializes with these on first boot.
POSTGRES_DB=fnb
POSTGRES_USER=postgres
POSTGRES_PASSWORD=1234
# Host-side port mapping for the db container (container port is always 5432).
DB_HOST_PORT=5444
# Connection string used by all app services (container network, hence
# function_bucket:5432 not localhost:5444). NOTE: superuser today — the role
# downgrade is tracked separately in superuser-database-url.plan.md.
DATABASE_URL=postgresql://postgres:1234@function_bucket:5432/fnb
# Same target, consumed by db-migrate + scripts/db-*.ts:
# PG_URL for psql, DB_URL in sqitch's db:pg: scheme.
PG_URL=postgresql://postgres:1234@function_bucket:5432/fnb
DB_URL=db:pg://postgres:1234@function_bucket:5432/fnb
# Ordered sqitch deploy list. Order matters: fnb-wf must precede fnb-storage
# (cross-package dependency); all seven must deploy or PostGraphile fails at
# boot (graphile.config.ts exposes their schemas).
DEPLOY_PACKAGES=fnb-auth fnb-app fnb-msg fnb-todo fnb-loc fnb-wf fnb-storage

# ─── Public URLs (browser-reachable, through nginx on PORT) ───────────────────
NUXT_PUBLIC_AUTH_APP_URL=http://localhost:4000/auth
NUXT_PUBLIC_GRAPHQL_API_URL=http://localhost:4000/graphql-api/api/graphql
NUXT_PUBLIC_MSG_APP_URL=http://localhost:4000/msg
NUXT_PUBLIC_UPLOAD_URL=http://localhost:4000/storage/api/upload
# Host-side GraphQL codegen (pnpm graphql-api-generate) — stack must be running.
GRAPHQL_SCHEMA_URL=http://localhost:4000/graphql-api/api/graphql

# ─── Internal URLs (container network, server-to-server) ──────────────────────
NUXT_AUTH_APP_INTERNAL_URL=http://auth-app:3000/auth
NUXT_MSG_APP_INTERNAL_URL=http://msg-app:3000/msg

# ─── MinIO / S3 (asset storage) ───────────────────────────────────────────────
# Root credentials; compose aliases these into S3_ACCESS_KEY / S3_SECRET_KEY so
# there is exactly one credential source.
MINIO_ROOT_USER=fnbminio
MINIO_ROOT_PASSWORD=fnbminio123
# Host port mappings (S3 API / web console at http://localhost:9001).
MINIO_API_PORT=9000
MINIO_CONSOLE_PORT=9001
# S3 client config. Endpoint is container-net; S3_PUBLIC_BASE_URL is the
# BROWSER-reachable base for public/ objects and presigning — it embeds
# MINIO_API_PORT and S3_BUCKET, keep the three aligned. (CDN URL in prod.)
S3_ENDPOINT=http://minio:9000
S3_PUBLIC_BASE_URL=http://localhost:9000/fnb-assets
S3_REGION=us-east-1              # arbitrary for MinIO; the SDK requires a value
S3_BUCKET=fnb-assets
S3_FORCE_PATH_STYLE=true         # required for MinIO
# ─── ClamAV (malware scanning — worker-app scan-asset handler only) ───────────
CLAMAV_HOST=clamav
CLAMAV_PORT=3310                 # clamd port inside the network
CLAMAV_HOST_PORT=3310            # host mapping (dev debugging only)

# ─── Asset-scan pipeline tunables (worker-app) ────────────────────────────────
# Max scan workflows per asset before the verdict goes terminal 'error'.
ASSET_SCAN_MAX_WF_ATTEMPTS=3
# Pending asset older than this (minutes) with no live workflow gets reaped.
ASSET_SCAN_STUCK_MINUTES=15
# Reaper schedule (5-field cron). Fast-test the error path with
# ASSET_SCAN_STUCK_MINUTES=1 and ASSET_SCAN_REAPER_CRON=* * * * *
ASSET_SCAN_REAPER_CRON=*/15 * * * *

# ─── Ops / dev conveniences ───────────────────────────────────────────────────
# Keep-warm pinger interval (seconds).
PING_INTERVAL=30
# Dozzle log viewer: host port + container-name filter.
DOZZLE_PORT=8888
DOZZLE_FILTER=name=fnb

# ─── Third-party ──────────────────────────────────────────────────────────────
# Public (pk.) Mapbox token used by tenant-app's map views. Read at nuxt config
# time — dev-server restart required after changing it.
MAPBOX_ACCESS_TOKEN=[FILL IN]

# ─── Optional (unset = feature-specific, not needed to boot) ──────────────────
# Alpha Vantage API key for the wf-exerciser stock-quote step (currently stubbed).
# ALPHA_VANTAGE_KEY=
# Cookie domain override for the session cookie (empty/unset = host-only).
# NUXT_COOKIE_DOMAIN=
```

## Implementation order

1. **`.env.example`** — write the full file above.
2. **`.env`** — regenerate from the example. Preserve the user's current local intent: today's
   `.env` has fast-test overrides `ASSET_SCAN_STUCK_MINUTES=1` + `ASSET_SCAN_REAPER_CRON='* * * * *'`
   — ask the user whether to keep them or take the 15-minute values; drop stale `MSG_DATABASE_URL`.
3. **`docker-compose.yml`** — replace every hardcoded env value with `${VAR:?}`; convert existing
   `${VAR:-default}` to `${VAR:?}`; interpolate `POSTGRES_*` into the db healthcheck; parametrize
   the five host-port mappings; `${S3_BUCKET:?}` in the minio-init entrypoint; add the missing
   `NUXT_PUBLIC_GRAPHQL_API_URL` / `NUXT_PUBLIC_UPLOAD_URL` / `MAPBOX_ACCESS_TOKEN` /
   `NUXT_AUTH_APP_INTERNAL_URL` (auth-app) pass-throughs. Keep D2 structural literals.
4. **`docker/migrate-entrypoint.sh`**, **`docker/pinger/pinger.mjs`** — items D19/D18.
5. **Code fallback removal** — items D1–D17 (add local `requiredEnv` helpers; `''` sentinels in
   nuxt configs; conditional HMR spread).
6. **Host-side scripts** — `scripts/_env.ts` loader + items D20–D23 (dotenv devDep at root and in
   `graphql-client-api`).
7. **Docs** — update `.claude/specs/monorepo-bootstrap-pattern.md` (it documents `${PORT:-4000}`
   and the compose-default `DEPLOY_PACKAGES` mechanism, both of which this plan removes).

## Verification (read-only where it touches Docker)

1. `pnpm build` passes on the host **with no `.env` loaded into the shell** — proves nuxt configs
   don't hard-require dev env at build time (D4/D12).
2. `docker compose config >/dev/null` succeeds with the new `.env`; then
   `mv .env /tmp && docker compose config` **fails** naming a missing variable; restore `.env`.
3. `grep -rn "?? '" apps packages docker scripts --include='*.ts' --include='*.mjs' | grep process.env`
   (and `grep -rn ':-' docker-compose.yml docker/migrate-entrypoint.sh`) → no env fallbacks remain
   (excluding `.output`/`dist`/`.nuxt` artifacts).
4. Ask the user to restart (`docker compose down && docker compose up` — volumes persist; a full
   `env:destroy`/rebuild wipes the DB per project memory). Then read-only: all apps render, login
   works, an upload scans clean, `pnpm graphql-api-generate` succeeds against the running stack.

## Risks / notes

- **Compose `.env` quoting:** docker compose strips surrounding single/double quotes from `.env`
  values; `ASSET_SCAN_REAPER_CRON=*/15 * * * *` works unquoted (spaces are fine after `=`).
  However `scripts/_env.ts`'s dotenv and compose must agree — dotenv also handles both forms.
  Keep values unquoted in `.env.example` to avoid parser drift.
- **This plan preserves current *values*** (including the superuser `DATABASE_URL`). Changing the
  connection role is `superuser-database-url.plan.md`; after it lands, only `.env` needs editing —
  which is the point of this plan.
- **`packages-watch` / layer caveat:** compiled-package edits (`db-access`, `auth-server`) rebuild
  via packages-watch, but layer `server/` edits (`storage-layer`, `msg-layer`, `auth-layer`) need
  `docker compose restart <app>` (project memory: layer changes need restart).
- `db/db-config.ts` keeps `deployOnBuild` flags but nothing consumes them for deploys after D23 —
  acceptable dead weight for now; removing it is out of scope.
