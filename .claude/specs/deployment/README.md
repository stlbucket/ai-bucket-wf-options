# Deployment — DigitalOcean + AWS (Terraform)

> **Execution Directive:** plan + build this spec via `/fnb-stack-implementor
> .claude/specs/deployment/README.md` — the implementor derives the `.claude/issues/` plan file
> (R23) from the Implementation Task List below, then executes it.

## Status
**Draft** — no `[FILL IN]` markers; all locked decisions captured. Remaining Open Questions are
deferred (implementation-time), not blockers. This is an **infrastructure** spec: there are no
pages and no GraphQL, so it uses design files (below) rather than `.ui.md`/`.data.md` page pairs —
the same way `monorepo-bootstrap-pattern.md` is a non-page pattern spec.

---

## Purpose

Take the fnb stack — today a ~20-service dev `docker-compose.yml` where every app runs `nuxt dev`
against bind-mounted source — and make it deployable to **two production environments** via
**Terraform**:

- **DigitalOcean** — the prod Compose stack on a **single droplet** (Caddy broker included), backed
  by **DO Managed Postgres** + **Spaces**.
- **AWS** — the **same** prod Compose stack on a **single EC2** instance, backed by **RDS** + **S3**
  (an intentional lift-and-shift so the two environments stay near-identical).

Both are fed by **immutable, pre-built images** (a new production image pipeline replaces the dev
`nuxt dev` / `pnpm-install` / `packages-watch` model), fronted by **Caddy with automatic TLS**, and
provisioned + deployed by **Terraform + GitHub Actions**. All final artifacts land in a new
top-level **`infra/`** directory.

---

## Locked decisions (with the why)

| # | Decision | Why |
|---|---|---|
| D1 | **DO = Compose on one droplet** (not DinD, not App Platform) | Achieves the "one cheap box, nginx broker included, one `up`" goal without DinD's shared-PID/no-per-service-health/painful-logs anti-pattern |
| D2 | **AWS = EC2 lift-and-shift** running the identical prod Compose (not Fargate/EKS) | Two **near-identical** environments, one Compose file + one mental model, smallest delta from the working dev stack; Fargate is the documented scale-up path |
| D3 | **Managed data everywhere** — DO Managed PG + Spaces; AWS RDS + S3 | Backups/patching/HA off the box; app code already speaks S3 so object storage is a config swap |
| D4 | **Immutable prod image pipeline is in scope** — multi-stage build → registry → run `.output` | `nuxt dev` + bind mounts + in-stack `pnpm install` is not a production posture; this is the correct one |
| D5 | **Caddy replaces nginx** as the broker, with **automatic Let's Encrypt** | ZITADEL hard-requires TLS + a real https issuer origin in prod; Caddy gives same path routing + auto-TLS with least ops; both envs identical |
| D6 | **Terraform parameterized, prod first** (reusable cloud modules + per-env tfvars) | Ship `do-prod`/`aws-prod` now; adding staging later is one more tfvars file — no premature staging infra |
| D7 | **GitHub Actions** builds+pushes images then applies Terraform + deploys | Reproducible, no laptop state; scripts are the primitive so a human can run the same deploy locally |
| D8 | **Prod = full functional parity, minus dev-only helpers** | Drops `pnpm-install`, `packages-watch`, `pinger`, `dozzle` (images are pre-built); keeps all 8 apps, ZITADEL, n8n, ClamAV, storage |
| D9 | **`agent-app` (and ClamAV) are KEPT for now** | User: agent-app removal is a **separate later effort**; until then prod runs the full agentic engine + its ClamAV dependency |
| D10 | **Artifacts land in a new top-level `infra/`** | User's requested landing spot; stands apart from the pnpm workspace like `db/` |
| D11 | **Managed-PG multi-DB + role bootstrap replaces the dev init scripts** | Managed PG has no `/docker-entrypoint-initdb.d` hook and no superuser; `zitadel`/`n8n_engine` DBs + roles + PostGIS must be created explicitly (native DO resources / a psql one-shot on AWS) |

---

## Files in this spec

| File | Contents |
|---|---|
| `README.md` | this index — decisions, task list, open questions |
| `production-runtime.md` | **read first** — the cloud-agnostic contract: dev→prod gap, service inventory, image pipeline, object-storage swap, Caddy broker, ZITADEL hardening, managed-PG bootstrap, secrets, deploy flow, consequences |
| `environment-digitalocean.md` | DO topology + Terraform resources (droplet, Managed PG, Spaces, DOCR, DNS, firewall) + deploy flow |
| `environment-aws.md` | AWS topology + Terraform resources (EC2, RDS, S3, ECR, Route 53, IAM, SSM) + deploy flow + why-not-Fargate |
| `terraform-and-cicd.md` | the `infra/` directory layout, Terraform module/env structure, secrets, GitHub Actions pipeline |

---

## Implementation Task List (build order)

### Phase 0 — Scaffold `infra/`
- [ ] Create the top-level `infra/` tree (`terraform-and-cicd.md` §1): `compose/`, `docker/`,
      `env/`, `scripts/`, `terraform/{modules,environments}/`
- [ ] `infra/README.md` pointing back at this spec

### Phase 1 — Production image pipeline (cloud-agnostic; the biggest shared chunk)
- [ ] `infra/docker/app.Dockerfile` — multi-stage builder (`pnpm install --frozen-lockfile` →
      `pnpm build`) + per-app runtime stage (`ARG APP`, `ARG BASE_URL`, ship only `.output`)
- [ ] Verify **`NUXT_APP_BASE_URL` is applied at build time** per app and assets resolve (highest-risk item)
- [ ] agent-app runtime variant retaining ffmpeg + clamdscan on top of `.output`
- [ ] `infra/scripts/build-images.sh` — loop the 8 apps, git-SHA tag, push

### Phase 2 — Prod Compose + Caddy (cloud-agnostic)
- [ ] `infra/compose/docker-compose.prod.yml` — images from registry, no bind mounts, managed PG/S3,
      drop dev-only helpers, keep all functional services + one-shots (`db-migrate`, `zitadel-*`,
      `n8n-import`)
- [ ] `infra/docker/Caddyfile` — path routing (mirror nginx) + `id.<domain>`/`n8n.<domain>` vhosts +
      auto-TLS + body-size limit; persisted ACME volume
- [ ] ZITADEL prod-hardening env (`ExternalSecure`, https issuer, subdomain) + a **prod seed** path
      (no dev users, real complexity, https redirect URIs)
- [ ] `infra/env/.env.prod.tpl` + `render-env.mjs` (fail-loud on missing keys)

### Phase 3 — Managed-Postgres bootstrap module
- [ ] `infra/terraform/modules/postgres-bootstrap` — create `zitadel` + `n8n_engine` DBs + owner
      roles + `CREATE EXTENSION postgis`; idempotent (DO: native resources; AWS: `postgresql`
      provider or on-box one-shot)

### Phase 4 — DigitalOcean environment
- [ ] `infra/terraform/modules/digitalocean` — droplet (+cloud-init Docker), VPC, Managed PG (+3
      DBs/users), Spaces (+policy/CORS/lifecycle/CDN), DOCR, firewall, DNS, reserved IP
- [ ] `infra/terraform/environments/do-prod` — backend + `do-prod.tfvars`
- [ ] Spaces env mapping (`S3_*`) in the rendered `.env`

### Phase 5 — AWS environment
- [ ] `infra/terraform/modules/aws` — VPC/subnets, EC2 (+cloud-init), EIP, SGs, RDS (+subnet
      group), S3 (+policy/public-access-block/lifecycle/CORS/CloudFront), ECR ×8, IAM instance
      profile, Route 53, SSM params
- [ ] `infra/terraform/environments/aws-prod` — backend + `aws-prod.tfvars`
- [ ] Resolve `S3_ENDPOINT` empty-vs-regional handling (§AWS §3) — code allowance if needed

### Phase 6 — CI/CD + deploy scripts
- [ ] `infra/scripts/deploy.sh` (ssh box: registry login, copy artifacts, `compose pull && up -d`)
      + `health-verify.sh`
- [ ] `.github/workflows/build-images.yml` + `deploy.yml` (design; user wires secrets/OIDC — **no
      git/push performed by the assistant**)

### Phase 7 — First-boot verification (per environment)
- [ ] Provision → deploy → confirm: `db-migrate` deploys, `zitadel-seed` runs, `n8n-import` imports,
      Caddy serves TLS on `<domain>`/`id.<domain>`/`n8n.<domain>`, login ceremony works end-to-end,
      an upload scans+promotes (agent-app + ClamAV path), a game plays (n8n referee path)

---

## Remaining Open Questions (implementation-time; not blockers)
1. **Domain(s).** The real domain + subdomain scheme (`<domain>`, `id.<domain>`, `n8n.<domain>`).
   Needed before TLS/DNS/ZITADEL issuer are concrete.
2. **Regions** — DO region (Spaces endpoint + droplet) and AWS region.
3. **ZITADEL prod seed** — the concrete prod admin identity + whether seeding is scripted or a
   manual first-run console step (dev seed's users/complexity relaxation must not carry over).
4. **`S3_ENDPOINT` on AWS** — set the regional endpoint vs. allow "unset = SDK default" (one-line
   code allowance).
5. **PostGIS/bootstrap mechanism on AWS** — Terraform `postgresql` provider (needs VPC network
   path) vs. an on-box one-shot (recommended).
6. **CDN** — Spaces CDN / CloudFront for `public/` vs. direct object URLs.
7. **State backend** — single shared S3 vs. per-cloud backends; ECR auth via GitHub OIDC.
8. **Box sizing** — starting droplet/EC2 size (memory pressure: 8 Node apps + ZITADEL + n8n +
   ClamAV).

---

## Considered & rejected
- **DigitalOcean single container via docker-in-docker** — the user's original phrasing; rejected
  for the shared-PID/signal, no per-service restart/health, and painful-logs anti-pattern. Compose
  on one droplet (D1) meets the same "one box" goal cleanly.
- **DO App Platform (managed PaaS)** — too large a departure from the Compose topology and pricier
  per component; loses the two-envs-identical property.
- **AWS ECS Fargate (cloud-native, ALB path-routing)** — more AWS-idiomatic and better horizontal
  scaling, but a **second divergent topology** to maintain vs. DO; more Terraform surface. Recorded
  as the documented scale-up path if EC2 vertical scaling is outgrown (`environment-aws.md` §6).
- **AWS EKS (Kubernetes)** — overkill for this stack's size.
- **Self-hosted Postgres/MinIO containers in prod** — cheapest but you own backups/HA/disk;
  rejected in favor of managed data services (D3).
- **Cloud load balancer for TLS (DO LB / ALB+ACM)** — offloads certs but adds a per-env front-end
  component and diverges the two environments; Caddy auto-TLS on the box (D5) is simpler and
  identical across clouds.
