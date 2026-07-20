# environment: `do-prod`

DigitalOcean production. Thin root: the Spaces state backend + a call to `modules/digitalocean`.

## Prerequisites (one-time)
- A DO account + a domain you control (delegate its **NS records** to DO nameservers).
- `doctl` authenticated; a DO SSH key uploaded (`doctl compute ssh-key list` → fingerprint).
- A **Spaces bucket for Terraform state** (`fnb-tfstate-do`) with **versioning on**, created out of
  band, plus a Spaces access key/secret.
- **Terraform ≥ 1.6** (the Spaces `endpoints {}` backend form). CI pins a recent CLI.

## Credentials (env, never committed)
```
export DIGITALOCEAN_TOKEN=...            # provider (droplet, PG, DNS, DOCR, firewall)
export SPACES_ACCESS_KEY_ID=...          # provider: Spaces bucket resources
export SPACES_SECRET_ACCESS_KEY=...
export AWS_ACCESS_KEY_ID=...             # state backend (the Spaces key again)
export AWS_SECRET_ACCESS_KEY=...
```

## Deploy
```bash
cd infra/terraform/environments/do-prod
terraform init                                  # first time / on backend change
terraform apply -var-file=do-prod.tfvars        # fill do-prod.tfvars first (domain/region/size/SSH)
terraform output -json                          # feeds infra/env/render-env.mjs
```
Then continue with the image build + box deploy — see the top-level `infra/README.md` runbook
(build-images.sh → render-env.mjs → deploy.sh → health-verify.sh).

## Notes
- **DB bootstrap:** the `zitadel` + `n8n_engine` databases/roles + PostGIS are created by the
  compose `pg-bootstrap` one-shot at deploy (OQ5), not here — DO's `database_db` can't set a DB
  owner, which those two need. This module creates the cluster + the `fnb` app DB.
- **App connection** currently uses `doadmin` (parity with the dev superuser DATABASE_URL); the
  scoped-role downgrade is tracked in `superuser-database-url.plan.md`.
- **Secrets** (`ZITADEL_DB_PASSWORD`, `N8N_ENGINE_DB_PASSWORD`, `S3_ACCESS_KEY/SECRET`, all app
  secrets, `ZITADEL_ADMIN_*`, `MAPBOX_ACCESS_TOKEN`) are NOT Terraform-managed — they come from the
  secret store into `render-env.mjs`. Only infra-derived values (PG host/port/admin creds, bucket,
  registry) are TF outputs.
- **`S3_PUBLIC_BASE_URL`** is virtual-hosted (no bucket path segment) — confirm the app's public-URL
  construction at first deploy.
