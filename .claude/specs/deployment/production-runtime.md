# Production Runtime — cloud-agnostic

## Status
Draft — this file defines the production **runtime shape** shared by every environment
(DigitalOcean, AWS, and any future target). The cloud-specific provisioning lives in
`environment-digitalocean.md` and `environment-aws.md`; the Terraform/CI mechanics in
`terraform-and-cicd.md`. Read this one first — it is the contract both clouds implement.

---

## 1. Why dev ≠ prod (the gap this spec closes)

The dev stack (`docker-compose.yml`, `.claude/specs/monorepo-bootstrap-pattern.md`) is built for
inner-loop iteration, not production:

| Dev reality | Why it can't ship to prod |
|---|---|
| Every app runs `nuxt dev` against **bind-mounted source** (`.:/app`) | No source on a prod box; HMR/Vite dev server is not a production server |
| `pnpm-install` + `packages-watch` build the workspace **inside the running stack** | Prod must run **pre-built immutable images**, not build at boot |
| `db` is a self-hosted **PostGIS container** holding three databases | Prod uses **managed Postgres** (backups, patching, HA) |
| `minio` + `minio-init` provide object storage | Prod uses **managed object storage** (Spaces / S3) |
| `caddy` broker terminates **plain HTTP** (`auto_https off`) | Prod Caddy adds **TLS** (ZITADEL hard-requires it — see §6) + `id.`/`n8n.` subdomains |
| Secrets sit in a repo-root `.env` with dev defaults | Prod secrets come from a secret store, never the repo |
| `pinger` / `dozzle` dev utilities | Not part of a production footprint |

The decisions locked in the README turn this into: **immutable images → pushed to a registry →
run by a prod Compose file on one box (droplet / EC2) → backed by managed data services → fronted
by Caddy with automatic TLS → provisioned and deployed by Terraform + GitHub Actions.**

---

## 2. Production service inventory

Full functional parity with dev, minus the dev-only helpers. Every service below runs in prod.

### Application containers (pre-built images, from the registry)

| Service | Image | Route | Notes |
|---|---|---|---|
| `caddy` | official `caddy:2` + repo `Caddyfile` | TLS front door | same proxy as dev (`docker/Caddyfile`) + TLS/subdomains — same path routing + automatic Let's Encrypt (§5) |
| `auth-app` | `fnb-auth-app` | `/auth` | Nuxt `.output` runtime |
| `home-app` | `fnb-home-app` | `/` (catch-all) | Nuxt `.output` runtime |
| `tenant-app` | `fnb-tenant-app` | `/tenant` | Nuxt `.output` runtime; serves the game/asset UI |
| `msg-app` | `fnb-msg-app` | `/msg` | WS carve-out |
| `game-app` | `fnb-game-app` | `/game` | WS only |
| `graphql-api-app` | `fnb-graphql-api-app` | `/graphql-api` | PostGraphile 5 |
| `storage-app` | `fnb-storage-app` | `/storage` | upload endpoint |
| `agent-app` | `fnb-agent-app` (dedicated Dockerfile: ffmpeg + clamdscan) | headless (no route) | **kept for now — removal is a later effort**; the Claude Agent SDK engine |
| `zitadel` | official `ghcr.io/zitadel/zitadel` (pinned) | `id.<domain>` subdomain (§6) | own origin, prod-hardened (ExternalSecure) |
| `n8n` | official `docker.n8n.io/n8nio/n8n` (pinned) | `n8n.<domain>` subdomain (§6) | parallel workflow engine |
| `clamav` | official `clamav/clamav` (pinned) | internal | consumed by `agent-app`'s scan tool |

### One-shot / bootstrap containers (run at deploy, then exit)

| Service | Runs when | Purpose |
|---|---|---|
| `db-migrate` | **every deploy** | `docker/migrate.Dockerfile` (unchanged) — sqitch deploy against **managed** Postgres. Idempotent. |
| `zitadel-init` | first boot | chown the `zitadel-seed` volume to uid 1000 (unchanged) |
| `zitadel-seed` | first boot | seed project/app/users + write `{ issuer, clientId }` handoff — **prod seed differs from dev** (§6) |
| `n8n-import` | **every deploy** | import workflows + credentials into the `n8n_engine` DB (unchanged, idempotent) |

### Dropped in prod (present only in dev)

`db` (→ managed PG), `minio` + `minio-init` (→ managed object store + Terraform bootstrap, §4),
`n8n-db-init` (→ managed-PG bootstrap, §7), `pnpm-install`, `packages-watch`, `pinger`, `dozzle`.

### Managed (external, not containers)

- **Postgres** — one managed cluster hosting **three logical databases**: the app DB (`fnb`),
  `zitadel`, and `n8n_engine`. See §7 for the multi-DB + role bootstrap that replaces the dev
  container's init scripts.
- **Object storage** — one bucket (Spaces / S3) with a public `public/` prefix and a `quarantine/`
  lifecycle-expiry rule, provisioned by Terraform (replaces `minio-init`, §4).

---

## 3. Production image pipeline

**Goal:** one reproducible build produces small, self-contained runtime images — one per app —
that a prod box pulls and runs. No workspace, no pnpm, no source on the running box.

### 3.1 Multi-stage build (the seven routed apps + home)

Nuxt builds to a self-contained `.output/` (Nitro bundles the exact runtime deps it needs), so the
runtime image needs **only Node + `.output`** — no `node_modules`, no pnpm, no workspace.

```dockerfile
# infra/docker/app.Dockerfile  (ARG APP selects which app's .output to ship)
# ---- builder: install the whole workspace once, build compiled pkgs + all apps ----
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json ./
COPY packages ./packages
COPY apps ./apps
RUN pnpm install --frozen-lockfile
# turbo builds compiled packages first (^build), then every app's .output
RUN pnpm build

# ---- runtime: ship ONLY the selected app's .output ----
FROM node:22-alpine AS runtime
ARG APP                        # e.g. tenant-app
WORKDIR /app
ENV NODE_ENV=production NUXT_HOST=0.0.0.0 NUXT_PORT=3000
COPY --from=builder /app/apps/${APP}/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

- **NUXT_APP_BASE_URL is a build-time input for Nuxt** (it bakes into asset URLs). It must be set
  **during `nuxt build`** per app (`/auth`, `/tenant`, …), not just at runtime — the dev
  bind-mount hides this because dev re-derives it live. The build stage sets it per app (an
  `ARG BASE_URL` threaded into the per-app build), matching the Caddy route.
- `runtimeConfig.public.*` values stay `''` sentinels resolved at **runtime** via `NUXT_PUBLIC_*`
  env (the existing pattern) — those are fine to inject on the box.
- One `builder` stage is shared; the per-app `runtime` stage is selected with
  `--build-arg APP=<slug>` (and `BASE_URL`). CI loops the eight apps.

### 3.2 agent-app (dedicated image)

`agent-app` keeps its own Dockerfile base (`apps/agent-app/Dockerfile`: `ffmpeg` + `clamdscan` +
the baked `clamd-remote.conf`) — the runtime stage adds those system binaries on top of the
`.output` copy. It is headless (`node .output/server/index.mjs`, no Caddy route). **This image is
retained now and removed when agent-app is decommissioned in the later effort.**

### 3.3 Registry + tags

- Registry: **DO Container Registry (DOCR)** for DO, **ECR** for AWS (per-cloud, §envs).
- Tag every image with the **git SHA** (immutable) and optionally a moving `env-latest` tag.
- The prod Compose file references `${REGISTRY}/fnb-<slug>-app:${IMAGE_TAG}`.
- `db-migrate` (sqitch), `caddy`, `zitadel`, `n8n`, `clamav` use their existing/official images —
  only the eight app images are built here.

### 3.4 What does NOT get built into images

The prod Compose file, the `Caddyfile`, workflow JSON (`n8n/workflows/`), credential templates,
and the sqitch `db/` tree are **mounted/shipped to the box**, not baked — they change independently
of app code and `db-migrate`/`n8n-import` read them at deploy. (The `db/` tree is bind-mounted into
`db-migrate` exactly as in dev.)

---

## 4. Object storage (replaces MinIO)

The app code already speaks S3 (`S3_ENDPOINT`, `S3_BUCKET`, `S3_FORCE_PATH_STYLE`, presign via
local HMAC). Moving to managed storage is a **config swap plus a Terraform-provisioned bucket**:

| Dev (`minio-init`) | Prod (Terraform) |
|---|---|
| `mc mb fnb-assets` | create bucket (Spaces / S3) |
| `mc anonymous set download …/public` | bucket policy: anonymous read on `public/*` |
| `mc ilm rule add --prefix quarantine/ --expire-days 7` | lifecycle rule: expire `quarantine/*` after 7 days |

Env changes on the box:
- `S3_ENDPOINT` → the managed endpoint (Spaces regional endpoint; **empty/AWS-default** for S3).
- `S3_PUBLIC_BASE_URL` → the **browser-reachable** public base (Spaces CDN URL / S3 or CloudFront
  URL). The `.env.example` already flags "CDN URL in prod".
- `S3_FORCE_PATH_STYLE` → `false` for both Spaces and S3 (virtual-hosted style).
- `S3_ACCESS_KEY` / `S3_SECRET_KEY` → managed storage credentials (Spaces key / IAM key), from the
  secret store — **not** the MinIO root creds.
- `S3_REGION` → the real region.

`storage-app` and `agent-app` (scan promote/purge) and `graphql-api-app` (presign only) all read
the same S3 config — one credential source, as in dev.

---

## 5. The Caddy broker

Dev and prod both front the stack with **Caddy** (dev: `docker/Caddyfile`, plain HTTP; prod:
`infra/docker/Caddyfile`, this file — same syntax, migration spec
`.claude/specs/deployment/dev-caddy-migration/`). The prod broker does three jobs the dev one
does not need: **TLS termination with automatic Let's Encrypt**, and `id.`/`n8n.` **subdomains**
(§6); plus the shared **path routing** and **WebSocket passthrough** (msg + game — Vite HMR is
dev-only).

- Path routing is identical to the dev `docker/Caddyfile`: `/auth /tenant /msg /game /graphql-api
  /storage` → each app `:3000`, `/` → `home-app` (catch-all last). `agent-app` has **no route**.
- **Rule:** new app blocks go before the catch-all; the `reverse_proxy` upstream is the Compose
  service name.
- WebSocket headers: Caddy handles `Upgrade`/`Connection` automatically (no manual `map` block).
- Body-size limit: `request_body max_size` matches the storage upload limit (the dev `Caddyfile`
  `/storage` block + `MAX_BODY_BYTES` in `upload.post.ts` + the 413 message in `useAssetUpload.ts`
  — keep them aligned).
- TLS: Caddy obtains + renews certs automatically for the site domains (§6). A persisted volume
  holds the ACME account + certs so restarts don't re-issue.

The `Caddyfile` lives at `infra/docker/Caddyfile` and is mounted into the container (not baked).

---

## 6. ZITADEL production hardening

Dev runs ZITADEL with TLS **hard-disabled** (`ZITADEL_TLS_ENABLED=false`,
`ZITADEL_EXTERNALSECURE=false`, `--tlsMode disabled`) on `localhost:<port>`. Prod must reverse all
of that, because the issuer origin is baked into tokens and the sealed session cookie needs a
secure origin:

- **Own origin on a subdomain.** The issuer must own its origin (it cannot live under a path
  prefix — the dev "own host port" precedent). In prod that becomes a **subdomain**, e.g.
  `id.<domain>`, which Caddy terminates TLS for and reverse-proxies to `zitadel:8080`.
- `ZITADEL_EXTERNALDOMAIN=id.<domain>`, `ZITADEL_EXTERNALPORT=443`, `ZITADEL_EXTERNALSECURE=true`,
  `ZITADEL_TLS_ENABLED=false` **kept** (Caddy does TLS; ZITADEL speaks plain HTTP behind it — the
  standard reverse-proxy posture; ExternalSecure=true tells ZITADEL its public origin is https).
- `NUXT_ZITADEL_ISSUER=https://id.<domain>` (browser-facing); `NUXT_ZITADEL_INTERNAL_URL=
  http://zitadel:8080` (server-to-server, unchanged).
- **Prod seed ≠ dev seed.** `docker/zitadel/seed.mjs` currently seeds dev users mirroring
  `db/seed.sql` and relaxes password complexity. The prod seed must: (a) NOT create dev users,
  (b) restore password complexity, (c) register redirect URIs against the **https** app origins
  (`https://<domain>/auth/...`). This needs a prod-mode branch or a separate seed input —
  captured as an Open Question in the README.
- `ZITADEL_MASTERKEY` is 32 chars and **immutable for the DB's lifetime** — it comes from the
  secret store and must never rotate without a re-init.

The same "own subdomain + Caddy TLS" pattern applies to the **n8n** editor/webhooks
(`n8n.<domain>` → `n8n:5678`), which likewise cannot sit under a path prefix. `WEBHOOK_URL` becomes
`https://n8n.<domain>/`. Internal callers keep `N8N_INTERNAL_URL=http://n8n:5678`.

---

## 7. Managed-Postgres bootstrap (replaces the container init scripts)

Dev relies on two things prod's managed cluster does **not** provide:

1. `docker/db-init/10-create-zitadel-db.sh` (runs via the postgres image's
   `/docker-entrypoint-initdb.d` on a fresh volume) creates the `zitadel` database.
2. `docker/n8n/db-init.sh` (the `n8n-db-init` one-shot) creates the `n8n_engine` database + owner
   login role.

Managed Postgres has **no init-dir hook** and the admin user is **not a superuser** (RDS
`rds_superuser`, DO `doadmin`). So this bootstrap must move to an explicit, idempotent step run
against the managed cluster **before** `db-migrate` / `zitadel` / `n8n` start:

- Create databases: `zitadel`, `n8n_engine` (the app DB is the cluster's default DB).
- Create login roles: `zitadel`, `n8n_engine` (owners of their DBs). The **`agent_worker` and
  `n8n_worker`** roles are still created by the sqitch packages (`fnb-agent`, `fnb-n8n`) via
  `--set` passwords — unchanged, they run inside `db-migrate`.
- Enable extensions the app DB needs (**PostGIS** for `loc`; both RDS and DO Managed PG support
  it). PostGIS enablement moves here if a superuser isn't required, else confirm the sqitch
  package handles it under the managed admin role.

Recommended mechanism: the Terraform **`postgresql` provider** (or a one-shot bootstrap container
running `psql` with the managed admin creds). It runs once per environment at provision time and
is idempotent (`CREATE DATABASE … `/`CREATE ROLE …` guarded). Details + provider choice per cloud
in the environment files.

**Note (out of scope, tracked):** dev's `DATABASE_URL` connects as the Postgres **superuser**; a
role downgrade is tracked in `superuser-database-url.plan.md`. On managed PG the app should connect
as a scoped role — align with that plan when it lands; this spec assumes the app role exists.

---

## 8. Configuration & secrets on the box

- The prod Compose file keeps the dev discipline: **every value is `${VAR:?}`, no silent
  defaults** — a missing secret fails `docker compose up` loudly.
- Values are supplied by a **rendered `.env` written to the box by the deploy pipeline** from the
  secret store (SSM Parameter Store / DO — see `terraform-and-cicd.md`). The `.env` is never in the
  repo and is root-only on the box.
- **Structural constants** stay in the Compose file exactly as in dev (`NUXT_HOST=0.0.0.0`,
  `NUXT_PORT=3000`, per-app `NUXT_APP_BASE_URL`, in-container `3000`) — but note `NUXT_APP_BASE_URL`
  is *also* a build-time input (§3.1); the runtime value must equal the built value.
- Public URLs flip from `http://localhost:<PORT>/...` to `https://<domain>/...`; internal URLs
  (`http://<service>:3000`) are unchanged.

---

## 9. Deploy flow (both clouds, same shape)

```
GitHub Actions (on tag)
  1. build 8 app images  → push to registry (DOCR / ECR), tagged by git SHA
  2. terraform apply     → provision/refresh infra (box, managed PG, bucket, DNS, firewall)
  3. render .env from secrets → copy to box; copy prod compose + Caddyfile + db/ + n8n/
  4. on the box: docker compose pull && docker compose up -d
        → db-migrate runs (sqitch), n8n-import runs, zitadel seeds (first boot), apps start
  5. health verify (Caddy 200s on /, /auth; graphql-api ready; zitadel ready)
```

Terraform owns **infrastructure**; the Compose `up` owns **service lifecycle** on the box. The two
seams are the rendered `.env` (secrets → box) and the image tag (registry → Compose). This keeps
the DO and AWS targets near-identical above the infrastructure layer — the whole point of the
EC2-lift-and-shift choice.

---

## 10. Known consequences & risks (record, don't silently absorb)

- **`NUXT_APP_BASE_URL` at build time** is the highest-risk change — get it wrong and assets 404 in
  prod while dev looks fine. Verify per app after the first build.
- **Vertical scaling only.** One box per environment (droplet / EC2). The pg-notify bridge and
  n8n are single-instance; horizontal scale is out of scope (matches the game-stack evaluation's
  scaling notes). Documented, not solved.
- **Single-box blast radius.** All app containers share one host; the managed data services are the
  durable tier. Backups live in the managed PG + object store, not the box.
- **agent-app is retained but slated for removal.** When that later effort lands, drop `agent-app`,
  `clamav` (orphaned once agent-app is gone), the `AGENT_*` env, and the `agent-transcripts`
  volume; the upload endpoint's `asset-scan` trigger and the datasets agent-engine workflows will
  need a plan then (out of scope here).
- **First-boot ordering.** `zitadel-seed` and the managed-PG bootstrap must complete before the
  apps are healthy; the pipeline's health-verify step (step 5) is the gate.
