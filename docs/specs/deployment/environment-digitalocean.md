# Environment — DigitalOcean

## Status
Draft — DO-specific provisioning. Implements the cloud-agnostic contract in
`production-runtime.md`. Topology decision: **Compose on a single droplet** (not DinD, not App
Platform).

---

## 1. Topology

```
                         Internet
                            │  (443/80)
                    ┌───────▼────────┐
                    │  DO Droplet    │   Ubuntu LTS + Docker Engine + Compose plugin
                    │  ┌──────────┐  │
   DNS (DO) ───────►│  │  caddy   │  │  TLS (Let's Encrypt) + path routing + subdomains
   <domain>         │  └────┬─────┘  │
   id.<domain>      │   8 app        │  auth home tenant msg game graphql-api storage agent
   n8n.<domain>     │   containers   │  + zitadel + n8n + clamav  (+ one-shots at deploy)
                    │  db-migrate…   │
                    └───┬────────┬───┘
                        │        │  (VPC-private)
              ┌─────────▼──┐  ┌──▼─────────────┐
              │ DO Managed │  │ DO Spaces      │  object storage (S3-compatible)
              │ Postgres   │  │ + CDN endpoint │  bucket: public/ (anon read), quarantine/ (ILM 7d)
              │ (PostGIS)  │  └────────────────┘
              │ 3 DBs      │
              └────────────┘
```

One droplet runs the prod Compose stack. Managed Postgres + Spaces are attached over the DO VPC
(private networking). Container Registry (DOCR) holds the app images.

---

## 2. DO resources (Terraform)

Provider: `digitalocean/digitalocean`. Everything below is Terraform-managed.

| Resource | Terraform | Notes |
|---|---|---|
| **Droplet** | `digitalocean_droplet` | Ubuntu LTS; size from tfvars (start ~`s-4vcpu-8gb` — 8 apps + zitadel + n8n + clamav are memory-hungry, clamav alone wants ~1–2 GB). Docker installed via `user_data` cloud-init. In the VPC. |
| **VPC** | `digitalocean_vpc` | private network for droplet ↔ managed PG ↔ Spaces |
| **Managed Postgres** | `digitalocean_database_cluster` (`engine = "pg"`) | PostGIS available; private-network host. Admin user `doadmin` (not superuser). |
| **PG databases** | `digitalocean_database_db` ×3 | `fnb` (app), `zitadel`, `n8n_engine` |
| **PG users** | `digitalocean_database_user` | app role + `zitadel` + `n8n_engine` owners (the `agent_worker`/`n8n_worker` roles are still made by sqitch inside `db-migrate`) |
| **PG firewall** | `digitalocean_database_firewall` | allow only the droplet |
| **Spaces bucket** | `digitalocean_spaces_bucket` | `fnb-assets-<env>`; the S3 target |
| **Spaces bucket policy / CORS** | `digitalocean_spaces_bucket_policy`, `_cors_configuration` | anonymous read on `public/*`; CORS for browser uploads |
| **Spaces lifecycle** | `digitalocean_spaces_bucket` `lifecycle_rule` | expire `quarantine/*` after 7 days (replaces the `mc ilm` rule) |
| **Spaces CDN** | `digitalocean_cdn` (optional) | the `S3_PUBLIC_BASE_URL` origin |
| **Container Registry** | `digitalocean_container_registry` | DOCR; the droplet authenticates via a registry token to pull |
| **Firewall** | `digitalocean_firewall` | inbound 80/443 (Caddy) + 22 (SSH, locked to admin IPs); everything else closed. n8n/zitadel are reached **through Caddy**, not their raw ports. |
| **DNS** | `digitalocean_record` ×3 | `<domain>`, `id.<domain>`, `n8n.<domain>` → droplet IP (A records) |
| **Reserved IP** | `digitalocean_reserved_ip` | stable IP across droplet rebuilds |

### Postgres bootstrap on DO
Databases + owner roles are created **declaratively** by the `digitalocean_database_db` /
`digitalocean_database_user` resources above — DO's API handles it, so the dev init scripts
(`10-create-zitadel-db.sh`, `n8n-db-init.sh`) are **not ported** to a psql step on DO; Terraform is
the bootstrap. **PostGIS** enablement (`CREATE EXTENSION postgis`) still needs a psql step under
`doadmin` (DO permits it) — run once via the Terraform `postgresql` provider or a one-shot. See
`production-runtime.md` §7.

---

## 3. Object storage mapping (Spaces)

Spaces is S3-compatible; the code change is env-only (`production-runtime.md` §4):

```
S3_ENDPOINT         = https://<region>.digitaloceanspaces.com
S3_PUBLIC_BASE_URL  = https://fnb-assets-<env>.<region>.cdn.digitaloceanspaces.com/fnb-assets   # CDN
S3_BUCKET           = fnb-assets-<env>
S3_REGION           = <region>          # e.g. nyc3
S3_FORCE_PATH_STYLE = false             # Spaces uses virtual-hosted style
S3_ACCESS_KEY/S3_SECRET_KEY = Spaces access keys (secret store, NOT MinIO root)
```

---

## 4. Secrets on DO

- Source of truth: encrypted tfvars / GitHub Actions secrets (see `terraform-and-cicd.md`).
- Terraform outputs the managed-PG connection string + Spaces keys; the pipeline renders them into
  the box's `.env` (root-only) alongside the app secrets (`ANTHROPIC_API_KEY`, `NUXT_SESSION_SECRET`,
  `ZITADEL_MASTERKEY`, `N8N_ENCRYPTION_KEY`, the `*_PG_PASSWORD`s, `AGENT_TRIGGER_SECRET`,
  `N8N_WEBHOOK_SECRET`).
- `ZITADEL_MASTERKEY` and `N8N_ENCRYPTION_KEY` are **immutable per environment** — generate once,
  store, never rotate without a re-init.

---

## 5. Deploy flow (DO)

Follows `production-runtime.md` §9. DO specifics:
1. GitHub Actions builds the 8 images, pushes to **DOCR** (tagged by git SHA).
2. `terraform apply` provisions/refreshes droplet, managed PG, Spaces, DNS, firewall.
3. Pipeline SSHes to the droplet: `doctl registry login` (or token), renders `.env`, copies the
   prod Compose file + `Caddyfile` + `db/` + `n8n/`.
4. `docker compose pull && docker compose up -d` → `db-migrate`, `n8n-import`, `zitadel-seed`
   (first boot), then apps.
5. Health verify: Caddy serves `https://<domain>/` and `/auth`, `graphql-api` ready, `zitadel
   ready`.

---

## 6. Cost & sizing notes (informational)

- Droplet `s-4vcpu-8gb` is a sensible start; watch ClamAV + n8n + 8 Node processes memory. Scale
  the droplet vertically if needed (the single-box, vertical-scale posture is locked).
- Managed PG smallest tier is fine for the app's current volume; it grows independently of the box.
- Spaces is flat-rate + bandwidth; CDN optional.

---

## 7. Open items specific to DO
- Confirm the DO region (drives Spaces endpoint + droplet locality).
- Confirm whether Spaces CDN is wanted (vs. serving `public/` straight from the Spaces origin).
- PostGIS-under-`doadmin` enablement path (Terraform `postgresql` provider vs one-shot) — pick one.
