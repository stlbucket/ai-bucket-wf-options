# Environment — AWS

## Status
Draft — AWS-specific provisioning. Implements the cloud-agnostic contract in
`production-runtime.md`. Topology decision: **EC2 lift-and-shift** — a single EC2 instance runs the
identical prod Compose stack as DO, backed by RDS + S3. This keeps the two environments
near-identical (one compose file, one mental model). ECS Fargate / EKS were considered and rejected
(README).

---

## 1. Topology

```
                         Internet
                            │  (443/80)
                    ┌───────▼────────┐
                    │  EC2 instance  │   Amazon Linux / Ubuntu + Docker Engine + Compose plugin
                    │  ┌──────────┐  │
   Route 53 ───────►│  │  caddy   │  │  TLS (Let's Encrypt) + path routing + subdomains
   <domain>         │  └────┬─────┘  │
   id.<domain>      │   8 app        │  auth home tenant msg game graphql-api storage agent
   n8n.<domain>     │   containers   │  + zitadel + n8n + clamav  (+ one-shots at deploy)
                    └───┬────────┬───┘
                        │        │  (VPC-private subnets)
              ┌─────────▼──┐  ┌──▼─────────────┐
              │ RDS        │  │ S3 bucket      │  object storage
              │ Postgres   │  │ (+ CloudFront) │  public/ (anon read), quarantine/ (lifecycle 7d)
              │ (PostGIS)  │  └────────────────┘
              │ 3 DBs      │
              └────────────┘
```

Same shape as DO with EC2 ⇄ droplet, RDS ⇄ Managed PG, S3 ⇄ Spaces, ECR ⇄ DOCR, Route 53 ⇄ DO DNS.
The **same prod Compose file and Caddyfile** run on both — that is the value of this choice.

---

## 2. AWS resources (Terraform)

Provider: `hashicorp/aws`. Everything below is Terraform-managed.

| Resource | Terraform | Notes |
|---|---|---|
| **VPC + subnets** | `aws_vpc`, `aws_subnet` (public for EC2, private for RDS) | + `aws_internet_gateway`, route tables |
| **EC2 instance** | `aws_instance` | Amazon Linux 2023 / Ubuntu LTS; size from tfvars (start ~`t3.large`/`t3.xlarge` — same memory pressure as the droplet). Docker via `user_data`. |
| **Elastic IP** | `aws_eip` | stable IP across instance replacement |
| **Security group (EC2)** | `aws_security_group` | inbound 80/443 (Caddy) + 22 (SSH, admin CIDR only). zitadel/n8n reached **via Caddy**, not raw ports. |
| **RDS Postgres** | `aws_db_instance` (`engine = "postgres"`) | PostGIS via `CREATE EXTENSION` under `rds_superuser` (admin user, not true superuser). In private subnets. |
| **RDS subnet group / SG** | `aws_db_subnet_group`, `aws_security_group` | RDS SG allows 5432 **only** from the EC2 SG |
| **S3 bucket** | `aws_s3_bucket` | `fnb-assets-<env>`; the S3 target |
| **S3 public access + policy** | `aws_s3_bucket_policy`, `aws_s3_bucket_public_access_block` | anonymous read on `public/*` only (block the rest) |
| **S3 lifecycle** | `aws_s3_bucket_lifecycle_configuration` | expire `quarantine/*` after 7 days |
| **S3 CORS** | `aws_s3_bucket_cors_configuration` | browser uploads |
| **CloudFront** (optional) | `aws_cloudfront_distribution` | the `S3_PUBLIC_BASE_URL` origin/CDN for `public/` |
| **ECR repos** | `aws_ecr_repository` ×8 | one per app image; EC2 pulls via its instance-profile role |
| **IAM** | `aws_iam_role` + instance profile | EC2 role: ECR pull, SSM Parameter Store read, (optional) S3 access; app S3 creds can be an IAM user or role-derived |
| **Route 53** | `aws_route53_record` ×3 | `<domain>`, `id.<domain>`, `n8n.<domain>` → EIP |
| **SSM Parameter Store** | `aws_ssm_parameter` (SecureString) | the secret store (§4) |

### Postgres bootstrap on AWS
RDS has **no init-dir hook** and no declarative "create these databases" API. So the dev init
scripts' logic **is ported** to an idempotent bootstrap run against RDS before the apps start
(`production-runtime.md` §7): create `zitadel` + `n8n_engine` databases and their owner roles, and
`CREATE EXTENSION postgis` on the app DB. Mechanism: Terraform **`cyrilgdn/postgresql` provider**
(runs from the apply, reaching RDS through the VPC — the runner must have network path) **or** a
one-shot bootstrap container on the EC2 box running `psql` with the RDS admin creds. Pick one in
`terraform-and-cicd.md`; the one-shot-on-box path avoids Terraform needing VPC network access.

---

## 3. Object storage mapping (S3)

Native S3 — the code already targets S3 semantics (`production-runtime.md` §4):

```
S3_ENDPOINT         = ""                      # empty → AWS SDK default endpoint for the region
S3_PUBLIC_BASE_URL  = https://<cloudfront-domain>/fnb-assets   # or the S3 website/object URL
S3_BUCKET           = fnb-assets-<env>
S3_REGION           = <region>                # e.g. us-east-1
S3_FORCE_PATH_STYLE = false
S3_ACCESS_KEY/S3_SECRET_KEY = IAM creds scoped to the bucket (or instance-role-derived), from SSM
```
If the code requires a non-empty `S3_ENDPOINT` (it currently reads it via `requiredEnv`), set it to
the regional S3 endpoint (`https://s3.<region>.amazonaws.com`) rather than empty — confirm during
implementation; a small code allowance for "unset = SDK default" may be cleaner (Open Question).

---

## 4. Secrets on AWS (SSM Parameter Store)

- All secrets live as **SSM Parameter Store SecureString** params under a per-env prefix
  (`/fnb/<env>/...`): DB URL, S3 keys, `ANTHROPIC_API_KEY`, `NUXT_SESSION_SECRET`,
  `ZITADEL_MASTERKEY`, `N8N_ENCRYPTION_KEY`, the `*_PG_PASSWORD`s, `AGENT_TRIGGER_SECRET`,
  `N8N_WEBHOOK_SECRET`.
- The deploy pipeline (or a small `user_data`/systemd unit on the box using the instance role)
  reads them and **renders the box `.env`** (root-only). No secrets in the repo or in the Compose
  file.
- Secrets Manager is an alternative to Parameter Store (rotation support) — Parameter Store
  SecureString is sufficient and cheaper for this static-secret set; noted as a swappable choice.
- `ZITADEL_MASTERKEY` / `N8N_ENCRYPTION_KEY` immutable per environment (same rule as DO).

---

## 5. Deploy flow (AWS)

Follows `production-runtime.md` §9. AWS specifics:
1. GitHub Actions builds the 8 images, pushes to **ECR** (git-SHA tags) via OIDC-assumed role (no
   long-lived keys in CI).
2. `terraform apply` provisions/refreshes VPC, EC2, RDS, S3, Route 53, IAM, SSM.
3. Pipeline (or the box via instance role) logs into ECR, reads SSM params → renders `.env`,
   copies the prod Compose file + `Caddyfile` + `db/` + `n8n/` to the box.
4. `docker compose pull && docker compose up -d` → `db-migrate`, `n8n-import`, `zitadel-seed`
   (first boot), then apps.
5. Health verify (same probes as DO).

---

## 6. Why EC2 and not Fargate (recorded)

The cloud-native ECS Fargate path (ALB path-routing replacing Caddy, one Fargate service per app,
Secrets Manager) is the more "AWS-idiomatic" answer and scales better, but it is a **second,
divergent topology** to build and keep in sync with DO — more Terraform surface, a different
front-door model (ALB vs Caddy), and per-service task defs. The locked choice optimizes for **two
near-identical environments** and the smallest delta from the working dev stack. If AWS scale
demands it later, Fargate is the documented upgrade path (see README → Considered & rejected). EKS
was rejected as overkill.

---

## 7. Open items specific to AWS
- Confirm region.
- `S3_ENDPOINT` empty-vs-regional-endpoint handling (see §3) — may want a one-line code allowance.
- PostGIS/bootstrap mechanism: Terraform `postgresql` provider (needs VPC network path from the
  runner) vs a one-shot bootstrap container on the EC2 box. Recommend the on-box one-shot.
- CloudFront in front of S3 for `public/` (vs. direct S3 URLs).
