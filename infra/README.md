# `infra/` — production deployment (DigitalOcean + AWS)

Deployment artifacts for the fnb stack. Like `db/`, this directory stands apart from the pnpm
workspace. The dev stack (root `docker-compose.yml`, `docker/`) is unchanged — this is additive.

> **Spec (single source of truth):** `.claude/specs/deployment/` — read `production-runtime.md`
> first (the cloud-agnostic contract), then `environment-digitalocean.md` / `environment-aws.md`
> and `terraform-and-cicd.md`. This README is the operator runbook; the specs hold the reasoning.

## What deploys where

Two **near-identical** production environments run the *same* pre-built images, prod Compose file,
and Caddyfile. Only the managed data services, registry, and secret store differ:

| | DigitalOcean (`do-prod`) | AWS (`aws-prod`) |
|---|---|---|
| Box | Droplet (Compose) | EC2 (Compose) |
| Postgres | DO Managed PG | RDS |
| Object storage | Spaces | S3 |
| Registry | DOCR | ECR |
| DNS | DO DNS | Route 53 |
| Secret store | GH secrets + DO | SSM Parameter Store + GH secrets |
| TLS front door | Caddy (auto Let's Encrypt) | Caddy (auto Let's Encrypt) |

## Layout

```
infra/
├── README.md                         # this file
├── compose/docker-compose.prod.yml   # the prod stack (16 services; images from registry, managed PG/S3, Caddy)
├── docker/
│   ├── app.Dockerfile                # multi-stage per-app build (ARG APP, ARG BASE_URL baked at build)
│   ├── Caddyfile                     # TLS + path routing + id./n8n. subdomains (+ www -> apex 301)
│   └── pg-bootstrap.sh               # idempotent managed-PG bootstrap (zitadel/n8n_engine DBs + PostGIS)
├── env/
│   ├── .env.prod.tpl                 # rendered to the box .env (composes URLs from ${DOMAIN})
│   └── render-env.mjs                # fail-loud renderer (missing key => non-zero)
├── scripts/
│   ├── build-images.sh               # 7 apps + hardened n8n image -> build+push, git-SHA tag
│   ├── deploy.sh                     # ssh box: copy artifacts, registry login, compose pull && up -d
│   ├── health-verify.sh              # post-deploy TLS/health probes
│   ├── bootstrap-identities.sh       # idempotent site-admin + n8n-owner bootstrap (§9.1; called by the two below)
│   ├── do-env-build.sh               # pnpm do-env-build — one-command DO deploy (chains the above; user-run)
│   ├── do-env-teardown.sh            # pnpm do-env-teardown — terraform destroy w/ typed confirm (user-run)
│   ├── do-db-rebuild.sh              # pnpm do-db-rebuild — fnb-DB-only data reset w/ typed confirm (user-run)
│   └── do-db-psql.sh                 # pnpm do-db-psql — interactive psql into prod fnb via the box (user-run)
└── terraform/
    ├── modules/{digitalocean, aws, postgres-bootstrap}
    └── environments/{do-prod, aws-prod}       # backend + tfvars + module call (see each env's README)

.github/workflows/{build-images.yml, deploy.yml}   # CI (design; you wire secrets/OIDC)
```

## The deploy flow (both clouds)

```
build-images.sh  →  terraform apply  →  render-env.mjs  →  deploy.sh  →  health-verify.sh
   (registry)        (box+PG+bucket+DNS)   (box .env)       (up -d)        (TLS 200s)
```

On the box, `docker compose up -d` runs the one-shots first: **pg-bootstrap** (zitadel/n8n_engine
DBs + PostGIS) → **db-migrate** (sqitch, 13 packages) → **zitadel-seed** (first boot) →
**n8n-import**, then the apps + Caddy.

---

## Secrets checklist (fill these before deploying — the OQ inputs)

Put these in the secret store (GH Actions secrets, and SSM `/fnb/prod/*` on AWS). **Never commit
them.** `render-env.mjs` fails loudly if any is missing.

| Secret | Notes |
|---|---|
| `ACME_EMAIL` | Let's Encrypt contact |
| `NUXT_SESSION_SECRET` | ≥ 32 chars |
| `ZITADEL_MASTERKEY` | **exactly 32 chars, IMMUTABLE per environment** |
| `N8N_ENCRYPTION_KEY` | **IMMUTABLE per environment** |
| `ANTHROPIC_API_KEY` | n8n `anthropic-api-key` credential (game-event AI) |
| `N8N_WEBHOOK_SECRET` | n8n webhook shared secret |
| `RESEND_API_KEY` | prod email (n8n `fnb-smtp` credential → Resend SMTP; verify the domain + SPF/DKIM in Resend first) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | **PARKED — not required while prod SMS stays log-sink.** Prod SMS (n8n `fnb-twilio` credential; token also verifies status-callback signatures) — upgraded account + A2P 10DLC/toll-free registration first (twilio-production-sms spec, plan 0580) |
| `TWILIO_FROM_NUMBER` | **PARKED** — prod SMS sender, E.164 (`+1…`), the registered Twilio number |
| `ZITADEL_DB_PASSWORD`, `N8N_ENGINE_DB_PASSWORD` | owner-role passwords (pg-bootstrap) |
| `N8N_WORKER_PG_PASSWORD` | sqitch-created worker role |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY` | Spaces key / scoped IAM key (NOT MinIO root) |
| `ZITADEL_ADMIN_USERNAME/EMAIL/PASSWORD` | prod console admin (FirstInstance) |
| `MAPBOX_ACCESS_TOKEN` | tenant-app maps |
| `DB_PASSWORD` | **aws-prod only** — RDS master password (`TF_VAR_db_password`) |
| `SETUP_TOKEN` | first-run `/auth/setup` gate — rendered onto the box AND presented by bootstrap-identities |
| `SITE_ADMIN_EMAIL/_FIRST_NAME/_LAST_NAME/_PHONE` | site admin identity (bootstrap-identities; laptop-side only, never rendered onto the box) |
| `SITE_ADMIN_PASSWORD` | site admin ZITADEL password — prod policy: ≥ 8 chars, upper+lower+number+symbol |
| `SITE_TENANT_NAME` | anchor tenant name (e.g. `Anchor Tenant`) |
| `N8N_ADMIN_PASSWORD` | n8n owner password — n8n policy: ≥ 8 chars, 1 number, 1 capital |

Infra-derived values (PG host/port/admin creds, bucket, registry, box IP) are **Terraform outputs**,
not secrets — `render-env.mjs` gets them via `terraform output -json`.

---

## Runbook — DigitalOcean (`do-prod`)

**Prereqs:** DO account; a domain (delegate NS to DO); `doctl` auth'd; a DO SSH key; a Spaces state
bucket `fnb-tfstate-do` (versioning on) + Spaces key/secret; **Terraform ≥ 1.6**.

**One-command path:** with secrets in `~/.config/fnb/prod-secrets.env`, `pnpm do-env-build` chains
steps 1–4 below (toggles: `SKIP_APPLY`, `SKIP_BUILD`, `AUTO_APPROVE`, `IMAGE_TAG`);
`pnpm do-env-teardown` destroys the environment (typed confirmation; `PURGE_BUCKET=1` empties the
assets bucket first). Both are **user-run only**. The manual steps remain the primitive:

```bash
# 0. Fill non-secret knobs + put secrets in the store.
$EDITOR infra/terraform/environments/do-prod/do-prod.tfvars   # domain, region, size, SSH key, admin CIDR

# 1. Build + push images (git-SHA tag).
doctl registry login
REGISTRY=registry.digitalocean.com/<name> IMAGE_TAG=$(git rev-parse --short=12 HEAD) \
  infra/scripts/build-images.sh

# 2. Provision.
export DIGITALOCEAN_TOKEN=... SPACES_ACCESS_KEY_ID=... SPACES_SECRET_ACCESS_KEY=...
export AWS_ACCESS_KEY_ID=$SPACES_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY=$SPACES_SECRET_ACCESS_KEY  # state backend
terraform -chdir=infra/terraform/environments/do-prod init
terraform -chdir=infra/terraform/environments/do-prod apply -var-file=do-prod.tfvars

# 3. Render the box .env from tf outputs + secrets, then deploy.
#    (populate the render env from `terraform output -json` + your secret store — see deploy.yml)
node infra/env/render-env.mjs infra/env/.env.prod.tpl /tmp/fnb.env
ENVIRONMENT=do-prod BOX_HOST=<reserved_ip> REGISTRY=<docr> IMAGE_TAG=<sha> \
  ENV_FILE=/tmp/fnb.env DIGITALOCEAN_TOKEN=... infra/scripts/deploy.sh

# 4. Verify.
DOMAIN=<domain> infra/scripts/health-verify.sh

# 5. Bootstrap identities (spec production-runtime.md §9.1; idempotent — do-env-build step 6).
#    Site admin: POST https://<domain>/auth/api/setup/initialize  (409 = already done, no-op)
#    n8n owner:  POST https://n8n.<domain>/rest/owner/setup       (no-op once an owner exists)
#    Requires SITE_ADMIN_*, SITE_TENANT_NAME, SETUP_TOKEN, N8N_ADMIN_PASSWORD in the secrets file.
#    Afterwards: app login at https://<domain> (ZITADEL), n8n editor at https://n8n.<domain>.
```
Details + notes: `infra/terraform/environments/do-prod/README.md`. The CI `deploy.yml` path stops
at health-verify — bootstrap-identities is a `do-env-build` (operator) step.

### DB rebuild — `pnpm do-db-rebuild` (user-run only)

Resets the **fnb DB only** to a clean, bootstrapped state — the prod counterpart of dev
`pnpm db-rebuild`; spec: `.claude/specs/deployment/prod-db-rebuild.md`. Typed confirmation
(`rebuild do-prod fnb`); `BACKUP=1` takes a `pg_dump -Fc` to `/opt/fnb/backups/` on the box
first (a failed dump aborts the run). **Destroys** all app data AND empties the assets bucket
(orphan objects are never left behind). **Survives**: ZITADEL identities, the n8n engine DB
(workflows/credentials/owner), cluster roles, and all infrastructure — terraform is read, never
applied. Flow: rsync the repo's current `db/` tree to the box (a rebuild deploys *current*
migrations; entrypoint/Dockerfile changes still need a deploy) → stop fnb-connected services →
`DROP DATABASE fnb WITH (FORCE)` + recreate →
pg-bootstrap + db-migrate one-shots (SEED_DATA=empty) → bucket purge → `up -d` + n8n restart →
health-verify → bootstrap-identities (site admin re-created against the surviving ZITADEL user;
n8n owner no-ops). Pre-rebuild invited users are orphaned in ZITADEL — re-invite them.

### DB console — `pnpm do-db-psql` (user-run only)

Interactive psql into the prod **fnb** DB, the prod sibling of dev `pnpm db-psql`. Runs on the
box over `ssh -t` (`postgres:16-alpine` on `fnb-network` — the cluster firewall only admits the
droplet); credentials come from the box's root-only `.env`, never ssh argv. `DB=<name>` targets
another database (`DB=zitadel`, `DB=n8n_engine`, `DB=defaultdb`). You connect as the managed
**admin** user — full rights, no RLS; type carefully.

## Runbook — AWS (`aws-prod`)

**Prereqs:** AWS account; a domain (delegate NS to the Route 53 zone TF creates); an EC2 key pair; a
state bucket `fnb-tfstate` (versioning + encryption); SSM `/fnb/prod/*` populated; **Terraform ≥ 1.10**.

```bash
# 0. Fill knobs + secrets; RDS master password via TF_VAR (secret store).
$EDITOR infra/terraform/environments/aws-prod/aws-prod.tfvars
export TF_VAR_db_password=...

# 1. Build + push to ECR (OIDC in CI; locally via your AWS creds).
aws ecr get-login-password --region <region> | docker login <acct>.dkr.ecr.<region>.amazonaws.com -u AWS --password-stdin
REGISTRY=<acct>.dkr.ecr.<region>.amazonaws.com IMAGE_TAG=$(git rev-parse --short=12 HEAD) \
  infra/scripts/build-images.sh

# 2. Provision.
terraform -chdir=infra/terraform/environments/aws-prod init
terraform -chdir=infra/terraform/environments/aws-prod apply -var-file=aws-prod.tfvars

# 3. Render + deploy (box user is `ubuntu` on AWS).
node infra/env/render-env.mjs infra/env/.env.prod.tpl /tmp/fnb.env
ENVIRONMENT=aws-prod BOX_HOST=<eip> BOX_USER=ubuntu REGISTRY=<ecr> IMAGE_TAG=<sha> \
  ENV_FILE=/tmp/fnb.env AWS_REGION=<region> infra/scripts/deploy.sh

# 4. Verify.
DOMAIN=<domain> infra/scripts/health-verify.sh
```
Details + notes: `infra/terraform/environments/aws-prod/README.md`.

## CI (GitHub Actions — design; you wire secrets/OIDC)

- **`build-images.yml`** — on tag `v*` (or manual, env input): build 7 app images + fnb-n8n → push to the env's
  registry (DOCR via doctl / ECR via OIDC), git-SHA tag.
- **`deploy.yml`** — manual (env + image_tag inputs): `terraform apply` → `render-env.mjs` →
  `deploy.sh` → `health-verify.sh`. `run_apply=false` gives an init+plan-only gate for prod safety.

The scripts are the primitive; the workflows are thin wrappers, so the exact same deploy runs from
a laptop if CI is unavailable.

## First-boot expectations (Phase 7 verification)

`db-migrate` deploys all 13 sqitch packages · `zitadel-seed` (prod branch — no dev users) runs ·
`n8n-import` imports + publishes (error-handler ACTIVE) · Caddy serves TLS on `<domain>` /
`id.<domain>` / `n8n.<domain>` · the login ceremony works · an upload scans+promotes (n8n
asset-scan + ClamAV) · a game plays (n8n referee).

## Immutable-per-environment secrets
`ZITADEL_MASTERKEY` (exactly 32 chars) and `N8N_ENCRYPTION_KEY` are generated **once per
environment** and must **never** rotate without a data re-init.
