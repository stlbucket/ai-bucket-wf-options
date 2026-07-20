# Plan: Production deployment — `infra/` artifacts + per-environment deploy runbooks (DigitalOcean + AWS, Terraform + Caddy + immutable images)

> **Execution Directive:** Implement this plan via `/fnb-stack-implementor <this-file>`.
> The authoritative spec is `.claude/specs/deployment/` (README + `production-runtime.md` +
> `environment-digitalocean.md` + `environment-aws.md` + `terraform-and-cicd.md`) — this plan
> sequences its Implementation Task List and records recommended resolutions for the deferred
> Open Questions; it does not restate the spec (R21). Specialist skills:
> `terraform-export` (all Terraform/HCL phases — modules, tfvars, backends, `init/plan/apply`),
> `spaces` (DO Spaces bucket/policy/CORS/lifecycle/CDN), `postgres` + `managed-db-services`
> (DO Managed PG / AWS RDS + the multi-DB bootstrap), `zitadel-expert` (Phase 2 prod hardening +
> the prod seed branch), `n8n-cli` (Phase 2 `n8n-import` on managed PG), `deployment`
> (Phase 6 GitHub Actions CI/CD + secrets/OIDC).
> **Global rules bind here:** I never run any `git` command and never commit/push — I author the
> `.github/workflows/*.yml` and the deploy scripts; **the user wires secrets/OIDC and owns every
> commit and every `terraform apply`/deploy** (spec `terraform-and-cicd.md` §4). I never
> provision cloud resources, spend money, or restart the env myself — Phases 3–7 that touch a
> live cloud/box are **user-run**; the assistant does read-only verification only.

**Severity: MED** (infrastructure feature work — the active effort; no runtime regression risk to
the dev stack, which is untouched) · Workstream: deployment/infra · Planned: 2026-07-20
· Spec status: Draft, **no `[FILL IN]` markers**; all 8 Open Questions are implementation-time
(README §"Remaining Open Questions") — resolved with recommended defaults below, none a blocker.

---

## Context

The dev stack is a ~20-service `docker-compose.yml` where every app runs `nuxt dev` against
bind-mounted source, backed by a self-hosted `postgis` container + `minio`, fronted by plain-HTTP
`nginx`. This effort produces a **new top-level `infra/`** tree that makes the stack deployable to
**two near-identical production environments** — DigitalOcean (Compose on one droplet + Managed PG +
Spaces) and AWS (the identical Compose on one EC2 + RDS + S3) — with **immutable pre-built images**,
**Caddy auto-TLS**, and **Terraform + GitHub Actions**. The dev `docker-compose.yml` and `docker/`
tree are **left in place unchanged** — this is purely additive (spec D10: `infra/` stands apart like
`db/`).

The user's ask has two deliverables: **(1)** all the `infra/` artifacts, and **(2)** the
**instructions on how to use them to deploy to each environment** — authored as `infra/README.md`
per-env runbooks (Phase 6) and summarized in this plan's "Deploy runbook shape" section.

## Verified anchors (checked against source 2026-07-20)

Everything below is a *port* of a working dev artifact — the plan cites the exact dev source so the
prod variant stays faithful:

| Prod artifact | Dev source it ports |
|---|---|
| `docker-compose.prod.yml` service inventory | `docker-compose.yml` (24 services; the 8 app services all build `apps/auth-app/Dockerfile`, `apps/agent-app/Dockerfile` for agent — lines 24–777) |
| `app.Dockerfile` per-app `NUXT_APP_BASE_URL` | the per-app runtime constants in compose (`/auth` L329, `/tenant` L365, `/msg` L434, `/game` L468, `/graphql-api` L499, `/storage` L548; `home-app` has **none** — catch-all) |
| `agent.Dockerfile` runtime extras | `apps/agent-app/Dockerfile` (`apk add ffmpeg clamav-clamdscan` + `COPY clamd-remote.conf`) |
| `Caddyfile` path routing | `docker/nginx.conf` (`/auth /tenant /msg /game /storage /graphql-api[/stream] /ruru-static` → `:3000`; `/` → home-app; `client_max_body_size 6m` on `/storage`, L44) |
| body-size limit alignment | `MAX_BODY_BYTES` = 6 MB (`packages/storage-layer/server/api/upload.post.ts:26-28`) — Caddy `request_body max_size`, nginx `6m`, and this constant stay aligned (3 places) |
| `db-migrate` on managed PG | `docker/migrate.Dockerfile` + `docker/migrate-entrypoint.sh` (unchanged — creates `anon/authenticated/service_role`, loops `DEPLOY_PACKAGES`, `--set agent_worker_password`/`n8n_worker_password`, then `seed.sql`) |
| `DEPLOY_PACKAGES` value | `.env.example:43` = `fnb-auth fnb-app fnb-agent fnb-n8n fnb-res fnb-msg fnb-todo fnb-loc fnb-storage fnb-location-datasets fnb-airports fnb-game` |
| managed-PG bootstrap (replaces init scripts) | `docker/db-init/10-create-zitadel-db.sh` (creates `zitadel` DB + role) + `docker/n8n/db-init.sh` (creates `n8n_engine` DB + role, idempotent) |
| ZITADEL prod-harden targets | compose `zitadel` env L195–264 (dev sets `EXTERNALSECURE=false`, `TLS_ENABLED=false`, `EXTERNALDOMAIN=localhost`, relaxes password complexity L250–252; prod reverses all) |
| prod seed branch | `docker/zitadel/seed.mjs` (currently seeds dev users mirroring `db/seed.sql`) |
| n8n import (unchanged) | compose `n8n-import` L663–708 (`render-credentials.mjs` → `import:credentials` → `import:workflow` → `publish:workflow` per id; error-handler must be ACTIVE) |
| S3 config swap | `S3_ENDPOINT`/`S3_BUCKET`/`S3_FORCE_PATH_STYLE` read via `requiredEnv(...)` in `packages/storage-layer/server/lib/s3.ts:15`, `apps/graphql-api-app/server/lib/s3.ts`, `apps/agent-app/server/lib/agent-tools/s3.ts` (`.env.example:72` `S3_FORCE_PATH_STYLE=true` for MinIO → `false` in prod) |

**Precedent for the `.env` render + secret discipline:** the addressed `0220__infra_____env-consolidation`
plan established the single-`.env`, `${VAR:?}`-no-defaults contract — `render-env.mjs` moves that
`${VAR:?}` fail-loud gate to render time (spec `terraform-and-cicd.md` §3).

## Deferred Open Questions — recommended resolutions (README §"Remaining Open Questions")

All 8 are **implementation-time, not blockers** (README §Status). The "parameterized, prod first"
design (spec D6) means most become **Terraform `variable`s + a placeholder `*.tfvars`** the user
fills at deploy — the artifacts are authored generically and never hardcode a domain/region/size.
Recommended defaults, adopted unless the user overrides at the go/no-go:

| OQ | Topic | Recommended resolution | Shapes which phase |
|---|---|---|---|
| 1 | Domain(s) | Author everything against `var.domain` + `id.${domain}` / `n8n.${domain}`; real value is a tfvars input at deploy. `<domain>` placeholder in runbook. | 2,4,5 (tfvars) |
| 2 | Regions | `var.region` per module; placeholder `nyc3` (DO) / `us-east-1` (AWS) in the example tfvars. | 4,5 (tfvars) |
| 3 | ZITADEL prod seed | Add a **`ZITADEL_SEED_MODE=prod`** branch to `seed.mjs`: no dev users, **no** complexity relaxation, https redirect URIs from `APP_ORIGIN`; the concrete prod admin identity is a deploy-time secret, seeding stays scripted+idempotent. | 2 |
| 4 | `S3_ENDPOINT` on AWS | **Set the regional endpoint** (`https://s3.<region>.amazonaws.com`) so `requiredEnv('S3_ENDPOINT')` keeps working with **zero app-code change** (verified 3 readers). No code allowance. | 5 |
| 5 | AWS PostGIS/bootstrap | **On-box one-shot** `psql` container (spec's recommendation) — avoids Terraform needing a VPC network path. Reuses the ported `db-init` logic. | 3,5 |
| 6 | CDN | Author the CDN resource **behind a `var.enable_cdn` flag** (default `true` DO Spaces CDN / AWS CloudFront); `S3_PUBLIC_BASE_URL` points at it when on, at the origin when off. | 4,5 |
| 7 | State backend | **Per-cloud backends** (DO Spaces S3-compat backend for `do-prod`; S3 + native lockfile for `aws-prod`) — never shared state (spec §2). | 6 |
| 8 | Box sizing | tfvars default `s-4vcpu-8gb` (DO) / `t3.xlarge` (AWS) with a memory-pressure note (8 Node apps + ZITADEL + n8n + ClamAV). | 4,5 (tfvars) |

## Gates & verification posture

- **No `pnpm build` gate here** — `infra/` is not a workspace package; there is no TS to compile
  (the chosen OQ4 resolution avoids app-code edits). Per-artifact gates instead:
  - Dockerfiles → `docker build` succeeds locally (Phase 1 is the highest-risk item — verify
    `NUXT_APP_BASE_URL` bakes correctly per app).
  - Compose → `docker compose -f infra/compose/docker-compose.prod.yml config` parses.
  - Terraform → `terraform fmt -check` + `terraform validate` + `terraform plan` (plan/apply are
    **user-run**, need cloud creds).
  - Shell scripts → `sh -n` / shellcheck.
- **Every live-cloud step is user-run** (provisioning, `apply`, box deploy, first-boot). The
  assistant authors artifacts + runbooks and does read-only verification of outputs the user pastes
  back. Never provision, never `apply`, never `git`.

---

## Implementation phases

Follows the spec README Implementation Task List (Phase 0–7), enriched with the anchors above.

### Phase 0 — Scaffold `infra/`
- Create the tree (spec `terraform-and-cicd.md` §1): `infra/{compose,docker,env,scripts}` +
  `infra/terraform/{modules,environments}`.
- `infra/README.md` **stub** now (fleshed into the deploy runbooks in Phase 6), pointing back at
  `.claude/specs/deployment/`.

### Phase 1 — Production image pipeline (cloud-agnostic; the biggest shared chunk, highest risk)
- `infra/docker/app.Dockerfile` — multi-stage: `builder` (`node:22-alpine` + `corepack pnpm@10.33.0`,
  `pnpm install --frozen-lockfile`, `pnpm build`) → per-app `runtime` (`ARG APP`, `ARG BASE_URL`,
  copy only `apps/${APP}/.output`, `CMD ["node",".output/server/index.mjs"]`). Verbatim skeleton in
  `production-runtime.md` §3.1.
- **`ARG BASE_URL` threaded into the per-app `nuxt build`** so `NUXT_APP_BASE_URL` bakes into asset
  URLs at build time (spec §3.1 + §10 — **highest-risk item**; dev hides it via bind-mount). Map:
  `auth→/auth tenant→/tenant msg→/msg game→/game graphql-api→/graphql-api storage→/storage`;
  **home-app gets no BASE_URL** (catch-all). Verify per app after first build that
  `.output/public/_nuxt/*` and the router base resolve under the prefix.
- `infra/docker/agent.Dockerfile` — runtime variant that adds `apk add ffmpeg clamav-clamdscan` +
  `COPY apps/agent-app/clamd-remote.conf` on top of the `.output` copy (ports
  `apps/agent-app/Dockerfile`); headless, no route.
- `infra/scripts/build-images.sh` — loop the 8 apps, `docker build --build-arg APP=<slug>
  --build-arg BASE_URL=/<slug> -t $REGISTRY/fnb-<slug>-app:$GIT_SHA`, push; agent-app uses
  `agent.Dockerfile` and no BASE_URL. Registry-agnostic (`$REGISTRY` = DOCR or ECR).

### Phase 2 — Prod Compose + Caddy + ZITADEL/n8n hardening (cloud-agnostic)
- `infra/compose/docker-compose.prod.yml` — port `docker-compose.yml` with:
  - **App services** reference `${REGISTRY}/fnb-<slug>-app:${IMAGE_TAG}` (no `build:`, no bind
    mounts, no `node_modules_*` volumes, no `packages-watch`/`pnpm-install` deps).
  - **Dropped** (spec §2): `db`, `minio`, `minio-init`, `n8n-db-init`, `pnpm-install`,
    `packages-watch`, `pinger`, `dozzle`, `nginx`.
  - **Kept one-shots**: `db-migrate` (unchanged image; `DB_URL`/`PG_URL` now point at **managed
    PG**), `zitadel-init`, `zitadel-seed` (prod branch), `n8n-import` (unchanged).
  - **Added**: `caddy` (official `caddy:2`, mounts the Caddyfile, persisted ACME volume, publishes
    80/443).
  - Keep every `${VAR:?}` — no silent defaults (spec §8).
- `infra/docker/Caddyfile` — mirror `docker/nginx.conf` exactly: path blocks (new blocks before the
  `/` catch-all), `request_body { max_size 6MB }` on `/storage` (align with the 3 places above),
  automatic Let's Encrypt for `<domain>` + `id.<domain>` (→ `zitadel:8080`) + `n8n.<domain>`
  (→ `n8n:5678`); WS `Upgrade`/`Connection` handled automatically. Mounted, not baked.
- **ZITADEL prod env** (spec §6): `ZITADEL_EXTERNALDOMAIN=id.<domain>`, `EXTERNALPORT=443`,
  `EXTERNALSECURE=true`, `TLS_ENABLED=false` (Caddy terminates TLS); `NUXT_ZITADEL_ISSUER=
  https://id.<domain>`, `NUXT_ZITADEL_INTERNAL_URL=http://zitadel:8080` unchanged; **drop** the
  three `PASSWORDCOMPLEXITYPOLICY_*=false` lines. `WEBHOOK_URL=https://n8n.<domain>/`,
  `N8N_INTERNAL_URL=http://n8n:5678` unchanged. → skill `zitadel-expert`.
- **Prod seed branch** in `docker/zitadel/seed.mjs` (OQ3): `ZITADEL_SEED_MODE=prod` skips dev users,
  keeps complexity, registers `https://<domain>/auth/...` redirect URIs. (Edit the existing file —
  additive branch, dev path unchanged.)
- `infra/env/.env.prod.tpl` + `infra/env/render-env.mjs` — template of every `${VAR}` the prod
  compose needs; `render-env.mjs` fills it from tf outputs + secret store and **fails loud on any
  missing key** (the `${VAR:?}` contract at render time). Writes root-only `.env` to the box.

### Phase 3 — Managed-Postgres bootstrap module (cloud-agnostic interface)
- `infra/terraform/modules/postgres-bootstrap` — create `zitadel` + `n8n_engine` DBs + owner login
  roles + `CREATE EXTENSION postgis` on the app DB; **idempotent** (`CREATE ... IF NOT EXISTS`
  guards, ports the two `db-init` scripts' SQL). Same module interface both clouds call:
  - **DO**: databases/roles are **native `digitalocean_database_db`/`_user` resources** (declarative,
    in the `digitalocean` module) — this module only does the `CREATE EXTENSION postgis` psql step
    under `doadmin` (spec DO §2 "Postgres bootstrap on DO").
  - **AWS**: the whole thing is the **on-box one-shot `psql` container** (OQ5) reusing the ported
    `db-init` logic (spec AWS §2 "Postgres bootstrap on AWS").
- (`agent_worker`/`n8n_worker` roles stay sqitch-created inside `db-migrate` via `--set` — unchanged.)

### Phase 4 — DigitalOcean environment (Terraform) — **user runs `apply`**
- `infra/terraform/modules/digitalocean` — droplet (+cloud-init installing Docker/Compose plugin),
  `digitalocean_vpc`, `digitalocean_database_cluster` (pg + PostGIS) + 3 `_db` + `_user` + `_firewall`
  (droplet-only), `digitalocean_spaces_bucket` (+ `_policy` anon-read `public/*`, `_cors`, lifecycle
  `quarantine/* expire 7d`), optional `digitalocean_cdn` (`var.enable_cdn`), `digitalocean_container_registry`,
  `digitalocean_firewall` (80/443 + 22-from-admin-CIDR only — n8n/zitadel via Caddy, not raw ports),
  `digitalocean_record` ×3, `digitalocean_reserved_ip`. Resource names suffixed by `var.environment`.
  Full resource table: spec `environment-digitalocean.md` §2. → skills `terraform-export`, `spaces`,
  `postgres`, `managed-db-services`.
- `infra/terraform/environments/do-prod` — Spaces (S3-compat) backend + `do-prod.tfvars` (placeholder
  domain/region/size/admin-CIDR); calls `module "digitalocean"` + `module "postgres-bootstrap"`.
- **Outputs** for `render-env.mjs`: droplet/reserved IP, managed-PG connection parts, bucket name +
  public base URL, DOCR URL (all `sensitive` where secret). Spaces env map (`S3_*`) per DO §3.

### Phase 5 — AWS environment (Terraform) — **user runs `apply`**
- `infra/terraform/modules/aws` — `aws_vpc`+subnets (public EC2 / private RDS) + IGW/route tables,
  `aws_instance` (+cloud-init Docker), `aws_eip`, EC2 `aws_security_group` (80/443 + 22-admin-CIDR),
  `aws_db_instance` (postgres) + `_db_subnet_group` + RDS SG (5432 from EC2 SG only), `aws_s3_bucket`
  (+ `_policy`, `_public_access_block`, `_lifecycle_configuration` quarantine-7d, `_cors`), optional
  `aws_cloudfront_distribution` (`var.enable_cdn`), `aws_ecr_repository` ×8, `aws_iam_role` + instance
  profile (ECR pull + SSM read), `aws_route53_record` ×3, `aws_ssm_parameter` (SecureString) for the
  secret set. Full table: spec `environment-aws.md` §2. → skills `terraform-export`, `managed-db-services`.
- **PostGIS/bootstrap = on-box one-shot** (OQ5) invoked from the AWS deploy path, not a TF provider.
- **`S3_ENDPOINT` = `https://s3.<region>.amazonaws.com`** (OQ4 — keeps `requiredEnv` happy, zero
  code change); `S3_FORCE_PATH_STYLE=false`. S3 env map per AWS §3.
- `infra/terraform/environments/aws-prod` — S3+native-lock backend + `aws-prod.tfvars`; calls
  `module "aws"` + `module "postgres-bootstrap"`.

### Phase 6 — CI/CD + deploy scripts + the per-env deploy runbooks (the user's deliverable #2)
- `infra/scripts/deploy.sh` — ssh the box → registry login (`doctl registry login` / `aws ecr
  get-login`) → copy `docker-compose.prod.yml` + `Caddyfile` + `db/` + `n8n/` + rendered `.env` →
  `docker compose pull && docker compose up -d`. The primitive; a human can run it laptop-side (spec §4).
- `infra/scripts/health-verify.sh` — post-deploy probes: Caddy `200` on `https://<domain>/` + `/auth`,
  `graphql-api` ready, `zitadel ready`, `n8n /healthz`. Gates deploy success.
- `.github/workflows/build-images.yml` + `deploy.yml` — **design + author only** (spec §4): build =
  loop 8 apps → push git-SHA-tagged to DOCR (doctl) / ECR (OIDC role); deploy (input
  `environment: do-prod|aws-prod`) = `terraform apply` → `render-env.mjs` → `deploy.sh` →
  `health-verify.sh`. **I do not commit, push, or wire secrets/OIDC — the user does.** → skill
  `deployment`.
- **`infra/README.md` — the per-environment deploy runbooks** (deliverable #2). Two runbooks
  (`do-prod`, `aws-prod`) each spelling out: prerequisites (accounts, `doctl`/`aws` CLI, a domain
  you control), the tfvars/secrets to fill (the OQ table above = the input checklist), the ordered
  commands, and the first-boot expectations. Shape captured below.

### ⏸ USER PROVISION + DEPLOY GATE (Phase 7 — first-boot verification, per environment)
Everything in Phases 3–6 that touches a live cloud is **user-run** (accounts, creds, spend). Per
spec README Phase 7, for each environment the user provisions → deploys → and we confirm read-only:
`db-migrate` deployed all 12 packages, `zitadel-seed` (prod branch) ran, `n8n-import` imported +
published (error-handler ACTIVE), Caddy serves TLS on `<domain>` / `id.<domain>` / `n8n.<domain>`,
the login ceremony works end-to-end, an upload scans+promotes (agent-app + ClamAV path), and a game
plays (n8n referee path). The assistant reviews pasted logs/outputs; it does not run these.

---

## Deploy runbook shape (previewed here; authored in full at `infra/README.md`, Phase 6)

Both environments share this flow (spec `production-runtime.md` §9) — the only per-cloud deltas are
registry (DOCR/ECR), secret store (GH secrets+DO / SSM), and the PostGIS bootstrap mechanism:

```
0. One-time: create the cloud account + a domain you control; put static secrets in the store
   (NUXT_SESSION_SECRET, ZITADEL_MASTERKEY[32ch, immutable], N8N_ENCRYPTION_KEY[immutable],
   ANTHROPIC_API_KEY, AGENT_TRIGGER_SECRET, N8N_WEBHOOK_SECRET, the *_PG_PASSWORDs).
1. Fill environments/<env>/<env>.tfvars  (domain, region, box size, admin SSH CIDR, enable_cdn).
2. build-images.sh            → 8 git-SHA-tagged images in the registry.
3. terraform -chdir=environments/<env> init && apply   → box + managed PG + bucket + DNS + firewall
   (+ postgres-bootstrap: zitadel/n8n_engine DBs + PostGIS).
4. render-env.mjs             → writes the root-only .env on the box from tf outputs + secrets.
5. deploy.sh <env>            → copy compose+Caddyfile+db/+n8n/+.env to the box; compose pull && up -d
      → db-migrate (sqitch, 12 pkgs) → n8n-import → zitadel-seed (first boot) → apps start.
6. health-verify.sh <env>     → TLS 200s on /, /auth, id., n8n.; graphql + zitadel ready.
```

`ZITADEL_MASTERKEY` and `N8N_ENCRYPTION_KEY` are generated **once per environment** and never
rotated without a data re-init (spec §3) — the runbook flags this in bold.

## Sequencing summary

1. Phases 0–2 are **cloud-agnostic and fully author-able + locally verifiable now** (docker build,
   compose config, Caddyfile, seed branch, render-env) — no cloud account needed.
2. Phase 3's module + Phases 4–5 are Terraform authoring (`fmt`/`validate` locally); **`plan`/`apply`
   are user-run** with cloud creds.
3. Phase 6 scripts + workflows + `infra/README.md` runbooks; workflows are authored, **never
   committed/pushed by the assistant**.
4. Phase 7 is the user's provision+deploy per env; assistant verifies read-only.
5. User touchpoints: the OQ defaults at go/no-go (this plan), then each `apply`/deploy/first-boot.

## Progress log

**2026-07-20 — Phases 0–2 authored + locally verified** (in-flight):
- **Phase 0** ✅ `infra/` tree scaffolded; `infra/README.md` stub (fleshed in Phase 6).
- **Phase 1** ✅ `infra/docker/app.Dockerfile` (per-app `ARG APP`/`ARG BASE_URL`, base URL baked via
  `turbo run build --filter`), `infra/docker/agent.Dockerfile` (ffmpeg + clamdscan runtime),
  `infra/scripts/build-images.sh` (8-app loop, git-SHA tag, app→base-URL map verified). pnpm pinned
  to `10.17.0` (repo `packageManager`). **Remaining gate:** a real `docker build` proving the
  `NUXT_APP_BASE_URL` bake per app. **✅ VERIFIED 2026-07-20** — see below.

**2026-07-20 — Phase 1 gate VERIFIED + two Dockerfile/env findings:**
- **Root `tsconfig.json` COPY was missing** — `packages/*/tsconfig.json` extend `../../tsconfig.json`;
  first Docker build failed `Tsconfig not found /app/tsconfig.json`. Fixed: both Dockerfiles now
  `COPY … tsconfig.json ./`.
- **Base-URL bake CONFIRMED**: building with `NUXT_APP_BASE_URL=<prefix>` bakes `app.baseURL` into
  the Nitro runtime config (`.output/server/chunks/nitro/nitro.mjs`). Control proof —
  **tenant-app → `baseURL: "/tenant"`** (23 `/tenant` refs through the server build) vs
  **home-app (empty) → `baseURL: "/"`**. The Dockerfile's `ENV NUXT_APP_BASE_URL=${BASE_URL}` before
  `nuxt build` is correct. (Physical `_nuxt/` assets stay at `_nuxt/`; the baked `baseURL` prefixes
  them at render — expected Nuxt behavior.)
- **Docker VM OOM finding (exit 137)**: a full in-Docker `nuxt build` was SIGKILLed by the local
  Docker Desktop VM's memory cap; the host build (more RAM) succeeded in ~46s. **Consequence for
  deploy:** the image builds are memory-hungry — CI runners / the build box need adequate RAM
  (reinforces OQ8 box-sizing). Noted for build-images.yml runner choice.
- Verification method: host `turbo run build --filter` (sidesteps the VM cap); throwaway `.output`
  + verify image cleaned up afterward.
- **Phase 2** ✅ `infra/compose/docker-compose.prod.yml` (17 services; validated via `docker compose
  config`; all 9 dev-only services dropped), `infra/docker/Caddyfile` (mirrors nginx + id./n8n.
  subdomains + 6 MB body cap), `infra/docker/pg-bootstrap.sh` (idempotent managed-PG bootstrap),
  `docker/zitadel/seed.mjs` **prod branch** (`ZITADEL_SEED_MODE=prod`, additive; dev path unchanged,
  parses), `infra/env/.env.prod.tpl` + `infra/env/render-env.mjs` (fail-loud gate tested both ways;
  composes URLs from `${DOMAIN}`).
- **New risk surfaced (deploy-time):** managed PG requires TLS. Compose sets `sslmode=require`
  (URLs), ZITADEL `SSL_MODE=require`, n8n `DB_POSTGRESDB_SSL_ENABLED=true` +
  `REJECT_UNAUTHORIZED=false`, agent-app `PGSSLMODE=require`. **Confirm the app pg client
  (`db-access`/`auth-server`) honors `?sslmode=require`** — may need a one-line `ssl` allowance like
  OQ4. Verify during first boot (Phase 7); mount the managed CA for full verification if wanted.
- **Next:** Phases 3–6 are Terraform + CI authoring (`fmt`/`validate` locally; `plan`/`apply`
  user-run); Phase 7 is user provision+deploy.

**2026-07-20 — Phases 3–4 (postgres-bootstrap + DigitalOcean) authored + `validate`-clean:**
- Local Terraform is **v1.5.7**. Strategy: child **modules** floor at `>= 1.5.7` → locally
  `init -backend=false && validate` (validates against the **real** provider schemas). **Env** dirs
  pin `~> 2.34` / `>= 1.6` (DO Spaces `endpoints{}` backend needs ≥1.6) → `fmt`-clean locally, full
  `validate` in CI; env module-wiring validated locally via a throwaway copy.
- **`modules/postgres-bootstrap`** (cyrilgdn/postgresql): DBs + roles + PostGIS — the TF-native
  **alternative** to the compose one-shot; documented as opt-in (default stays the one-shot, OQ5).
  validate ✓.
- **`modules/digitalocean`**: VPC, droplet (+cloud-init Docker), reserved IP, Managed PG cluster +
  `fnb` DB + firewall, Spaces (bucket + anon-read `public/*` policy + CORS + quarantine-7d
  lifecycle + optional CDN), DOCR, cloud firewall (80/443 + admin-only 22), DO domain + 3 A records.
  validate ✓ against provider v2.34.
- **`environments/do-prod`**: Spaces S3-compat backend, provider, module call, outputs (the
  `render-env.mjs` contract), placeholder `do-prod.tfvars`, README runbook. validate ✓ (wiring).
- **Refinement recorded:** DO's `database_db` can't set a DB owner, so `zitadel`/`n8n_engine` DBs
  are created by the **compose one-shot** (owner-correct), not natively — supersedes env-do §2's
  "3 native DBs". App connection uses `doadmin` for now (dev-superuser parity; downgrade tracked in
  `0040__security__superuser-database-url`).
- **Findings:** `S3_PUBLIC_BASE_URL` is virtual-hosted (no bucket path) — confirm app URL
  construction at deploy. DO Spaces native state-locking is unreliable — rely on CI apply
  serialization. Provider binaries + validation lock files cleaned up; `infra/terraform/.gitignore`
  added (ignores `.terraform/`/state, keeps `*.tf`/tfvars/lock).
- **Next:** Phase 5 (AWS module + aws-prod env, mirrors DO) → Phase 6 (deploy.sh, health-verify.sh,
  2 GH workflows, full `infra/README.md` runbooks).

**2026-07-20 — Phases 5–6 authored + verified. All author-able work COMPLETE (41 infra files + 2 workflows):**
- **Phase 5 (AWS)** ✅ `modules/aws` (VPC + 1 public/2 private subnets, IGW/route table, EC2 [Ubuntu
  AMI → same apt cloud-init] + EIP, EC2/RDS security groups, RDS + subnet group, S3 + PAB/policy/
  lifecycle/CORS, optional CloudFront [default cert, no ACM], ECR ×8 via `for_each`, IAM instance
  profile [ECR pull + SSM read on `/fnb/<env>/*`], Route 53 zone + 3 A records) — **validate ✓ vs
  provider ~>5.0**. `environments/aws-prod` (S3 `use_lockfile` backend, provider, module call,
  outputs, tfvars, README) — validate ✓ (wiring). Refinements recorded: SSM params created
  out-of-band (secrets stay out of state; module only grants read); `S3_ENDPOINT` = regional
  endpoint (OQ4, zero code change); RDS master password is the one secret in state (encrypted
  backend); PostGIS/zitadel/n8n_engine via the compose one-shot (RDS private, no CI network path).
- **Phase 6 (CI/CD + runbooks)** ✅ `scripts/deploy.sh` (ssh box: rsync artifacts, per-cloud
  registry login, `compose pull && up -d`), `scripts/health-verify.sh` (retry probes: home/auth/
  graphql/id./n8n.), `.github/workflows/{build-images,deploy}.yml` (design; YAML-valid; secrets/OIDC
  are the user's to wire — assistant never commits/pushes), and the **full `infra/README.md`
  per-environment runbooks** (deliverable #2) with the secrets checklist + DO/AWS step-by-step.
- **Final sweep:** all shell scripts `bash -n` clean; render-env/seed `node --check` clean;
  `terraform fmt -recursive -check` clean; both workflows YAML-valid; no stray `.terraform`/state.
- **REMAINING = Phase 7 only (user-run):** provision (`terraform apply` with real cloud creds) →
  deploy → first-boot verification per environment. The assistant cannot run these (needs cloud
  accounts/spend) and verifies read-only from pasted output. Deploy-time confirms to watch:
  managed-PG TLS (`sslmode=require` — confirm the app pg client honors it), `S3_PUBLIC_BASE_URL`
  virtual-hosted URL construction, DO Spaces state-lock reliability, image-build runner RAM (OOM
  finding).

## Out of scope / linked
- **agent-app + ClamAV removal** — explicitly a **later separate effort** (spec D9/§10); prod keeps
  the full agentic engine + ClamAV for now.
- **Staging environments** — deferred (spec D6); adding `do-staging`/`aws-staging` later is one more
  tfvars + backend, no new module work.
- **Horizontal scale / Fargate / EKS** — rejected (README §Considered & rejected); single-box
  vertical scale is the locked posture, Fargate is the documented upgrade path.
- **App role downgrade from superuser `DATABASE_URL`** — tracked in
  `0040__security__superuser-database-url__________HI___.plan.md`; prod assumes the app role exists,
  align when that lands (spec §7 Note).
- **`git` operations, secret/OIDC wiring, cloud provisioning, `terraform apply`, env rebuilds** —
  all **user-owned**; the assistant authors artifacts and verifies read-only only.
