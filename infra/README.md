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
├── compose/docker-compose.prod.yml   # the prod stack (17 services; images from registry, managed PG/S3, Caddy)
├── docker/
│   ├── app.Dockerfile                # multi-stage per-app build (ARG APP, ARG BASE_URL baked at build)
│   ├── Caddyfile                     # TLS + path routing + id./n8n. subdomains
│   └── pg-bootstrap.sh               # idempotent managed-PG bootstrap (zitadel/n8n_engine DBs + PostGIS)
├── env/
│   ├── .env.prod.tpl                 # rendered to the box .env (composes URLs from ${DOMAIN})
│   └── render-env.mjs                # fail-loud renderer (missing key => non-zero)
├── scripts/
│   ├── build-images.sh               # loop 8 apps -> build+push, git-SHA tag
│   ├── deploy.sh                     # ssh box: copy artifacts, registry login, compose pull && up -d
│   └── health-verify.sh              # post-deploy TLS/health probes
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
DBs + PostGIS) → **db-migrate** (sqitch, 12 packages) → **zitadel-seed** (first boot) →
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
| `ZITADEL_DB_PASSWORD`, `N8N_ENGINE_DB_PASSWORD` | owner-role passwords (pg-bootstrap) |
| `N8N_WORKER_PG_PASSWORD` | sqitch-created worker role |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY` | Spaces key / scoped IAM key (NOT MinIO root) |
| `ZITADEL_ADMIN_USERNAME/EMAIL/PASSWORD` | prod console admin (FirstInstance) |
| `MAPBOX_ACCESS_TOKEN` | tenant-app maps |
| `DB_PASSWORD` | **aws-prod only** — RDS master password (`TF_VAR_db_password`) |

Infra-derived values (PG host/port/admin creds, bucket, registry, box IP) are **Terraform outputs**,
not secrets — `render-env.mjs` gets them via `terraform output -json`.

---

## Runbook — DigitalOcean (`do-prod`)

**Prereqs:** DO account; a domain (delegate NS to DO); `doctl` auth'd; a DO SSH key; a Spaces state
bucket `fnb-tfstate-do` (versioning on) + Spaces key/secret; **Terraform ≥ 1.6**.

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
```
Details + notes: `infra/terraform/environments/do-prod/README.md`.

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

- **`build-images.yml`** — on tag `v*` (or manual, env input): build 8 images → push to the env's
  registry (DOCR via doctl / ECR via OIDC), git-SHA tag.
- **`deploy.yml`** — manual (env + image_tag inputs): `terraform apply` → `render-env.mjs` →
  `deploy.sh` → `health-verify.sh`. `run_apply=false` gives an init+plan-only gate for prod safety.

The scripts are the primitive; the workflows are thin wrappers, so the exact same deploy runs from
a laptop if CI is unavailable.

## First-boot expectations (Phase 7 verification)

`db-migrate` deploys all 12 sqitch packages · `zitadel-seed` (prod branch — no dev users) runs ·
`n8n-import` imports + publishes (error-handler ACTIVE) · Caddy serves TLS on `<domain>` /
`id.<domain>` / `n8n.<domain>` · the login ceremony works · an upload scans+promotes (n8n
asset-scan + ClamAV) · a game plays (n8n referee).

## Immutable-per-environment secrets
`ZITADEL_MASTERKEY` (exactly 32 chars) and `N8N_ENCRYPTION_KEY` are generated **once per
environment** and must **never** rotate without a data re-init.
