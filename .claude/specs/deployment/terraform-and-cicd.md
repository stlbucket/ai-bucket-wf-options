# Terraform Layout & CI/CD

## Status
Draft — the mechanics shared by both environments: the new top-level `infra/` directory, the
Terraform module/variable structure (parameterized, prod first), secret handling, and the GitHub
Actions pipeline. Implements the flow in `production-runtime.md` §9.

---

## 1. The `infra/` top-level directory (the artifact landing spot)

A **new top-level directory** `infra/` holds every deployment artifact (the user's requested
landing spot). It is not a pnpm workspace package (like `db/`, it stands apart).

```
infra/
├── README.md                       # how to deploy each env (points back at .claude/specs/deployment/)
├── compose/
│   └── docker-compose.prod.yml     # the prod stack (§Production Runtime §2) — no bind mounts,
│                                    #   images from registry, managed PG/S3, Caddy broker
├── docker/
│   ├── app.Dockerfile              # multi-stage builder + per-app runtime (ARG APP, ARG BASE_URL)
│   └── Caddyfile                   # TLS + path routing + id./n8n. subdomains
├── env/
│   ├── .env.prod.tpl               # rendered on the box from the secret store (no secrets in repo)
│   └── render-env.mjs              # renders the template from SSM / tf outputs (dev-parity: ${VAR:?})
├── scripts/
│   ├── build-images.sh             # loop 8 apps → build+push to the registry, git-SHA tag
│   ├── deploy.sh                    # ssh box: registry login, copy artifacts, compose pull && up -d
│   └── health-verify.sh            # post-deploy probes (Caddy 200s, graphql ready, zitadel ready)
└── terraform/
    ├── modules/
    │   ├── digitalocean/           # droplet, VPC, managed PG (+3 DBs/users), Spaces, DOCR, DNS, fw
    │   ├── aws/                    # VPC, EC2, RDS, S3, ECR, Route53, IAM, SSM
    │   └── postgres-bootstrap/    # create zitadel + n8n_engine DBs/roles + PostGIS (managed PG)
    └── environments/
        ├── do-prod/               # backend + do-prod.tfvars → module "digitalocean"
        └── aws-prod/              # backend + aws-prod.tfvars → module "aws"
        # staging is added later as do-staging/ + aws-staging/ — just another tfvars + backend
```

**Parameterized, prod first** (locked): the clouds are reusable **modules**; each environment is a
thin `environments/<name>/` that supplies a backend + a tfvars file. Adding staging = copy an env
dir and change values. No premature staging infra is provisioned now.

---

## 2. Terraform structure

- **Remote state, per environment.** Each `environments/<name>` has its own backend + state (DO
  Spaces backend for DO, S3+DynamoDB lock for AWS — or one S3 backend for both). Never share state
  across environments.
- **Modules take a `var.environment`** (`prod`, later `staging`) that suffixes every named resource
  (`fnb-assets-<env>`, `/fnb/<env>/...`) so two environments never collide.
- **Inputs per module:** region, box size, domain + subdomains, admin SSH CIDR, DB tier, image tag,
  registry URL. **Outputs:** box IP/EIP, managed-PG connection parts, bucket name + public base
  URL, registry URL — consumed by `render-env.mjs`.
- The **`postgres-bootstrap` module** (create `zitadel`/`n8n_engine` DBs + owner roles + PostGIS)
  is shared; on DO much of it is native resources, on AWS it's the `postgresql` provider or the
  on-box one-shot (see the env files). Keep it a module so both call it the same way.
- `NODE_ENV=production` and `PORT=443`-equivalents: the box's public URLs are `https://<domain>`;
  the Compose file's structural constants are unchanged from dev.

---

## 3. Secrets

- **Never in the repo, never in Terraform state in plaintext.** Static secrets
  (`NUXT_SESSION_SECRET`, `ZITADEL_MASTERKEY`, `N8N_ENCRYPTION_KEY`, `ANTHROPIC_API_KEY`,
  `AGENT_TRIGGER_SECRET`, `N8N_WEBHOOK_SECRET`, the `*_PG_PASSWORD`s) live in the secret store:
  **SSM Parameter Store** (AWS) / GitHub Actions secrets + DO-side (DO).
- **Infra-derived secrets** (managed-PG password/URL, bucket keys) are Terraform **outputs** →
  `render-env.mjs` writes them into the box `.env`. Mark them `sensitive = true`; the state backend
  must be private/encrypted.
- `render-env.mjs` enforces the dev discipline: it fails loudly if any required key is missing (the
  `${VAR:?}` contract, moved to render time).
- Immutability: `ZITADEL_MASTERKEY` and `N8N_ENCRYPTION_KEY` are generated **once per environment**
  and never rotated without a data re-init (documented in both env files).

---

## 4. GitHub Actions pipeline (locked deploy path)

Two workflows keep build and deploy separable but chained. **I only design these — per the
standing global rule I never run git operations or push anything myself; the user wires the actual
secrets/OIDC and owns all commits.**

```
.github/workflows/
├── build-images.yml     # on: push tag / manual — build 8 images, push to registry (git-SHA tag)
└── deploy.yml           # on: successful build / manual (env input) — terraform apply + box deploy
```

**build-images.yml**
1. checkout, set up Docker Buildx, `pnpm` (for the frozen lockfile only — the image builds inside
   Docker).
2. auth to the registry: **DOCR** (doctl token) or **ECR** (OIDC-assumed IAM role — no static keys).
3. `infra/scripts/build-images.sh`: loop the 8 apps, `docker build --build-arg APP=<slug>
   --build-arg BASE_URL=/<slug> -t $REGISTRY/fnb-<slug>-app:$GITHUB_SHA`, push. (`home-app` has no
   base URL.)

**deploy.yml** (input: `environment` = `do-prod` | `aws-prod`)
1. `terraform -chdir=infra/terraform/environments/<env> init && apply` (image tag = the SHA built).
2. render `.env` from tf outputs + secret store (`render-env.mjs`).
3. `infra/scripts/deploy.sh`: ssh the box → registry login → copy `docker-compose.prod.yml` +
   `Caddyfile` + `db/` + `n8n/` + `.env` → `docker compose pull && docker compose up -d`.
4. `infra/scripts/health-verify.sh` gates success.

**Local parity:** `deploy.sh` / `build-images.sh` are the primitive; the workflows are thin wrappers,
so a human can run the exact same deploy from a laptop (the "scripts are the primitive" posture) if
CI is unavailable.

---

## 5. Environment matrix (today)

| Env | Terraform dir | Cloud module | Registry | Secret store |
|---|---|---|---|---|
| `do-prod` | `environments/do-prod` | `digitalocean` | DOCR | GH secrets + DO |
| `aws-prod` | `environments/aws-prod` | `aws` | ECR | SSM Parameter Store |
| `*-staging` | *(later)* | same modules | same | same |

---

## 6. Open items
- State backend choice (single shared S3 vs per-cloud) — pick in the plan.
- ECR auth via GitHub OIDC role (recommended) vs static keys — confirm the AWS account setup.
- Whether `deploy.sh` runs `terraform apply` or that stays a separate manual gate for prod safety.
