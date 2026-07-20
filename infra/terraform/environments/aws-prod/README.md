# environment: `aws-prod`

AWS production (EC2 lift-and-shift). Thin root: the S3 state backend + a call to `modules/aws`.

## Prerequisites (one-time)
- An AWS account + a domain you control (delegate its **NS records** to the Route 53 zone this
  creates — see the `route53_name_servers` output).
- An **EC2 key pair** in the region (for SSH), if you want shell access.
- An **S3 bucket for Terraform state** (`fnb-tfstate`) with **versioning + default encryption**,
  created out of band.
- **SSM SecureString params** under `/fnb/prod/*` populated out of band (the secret store) — this
  module grants the instance role read access but does NOT create the params (keeps secrets out of
  Terraform state, spec §3).
- **Terraform ≥ 1.10** (S3 `use_lockfile` native locking). CI pins a recent CLI.

## Credentials
- **CI:** GitHub OIDC assume-role (no long-lived keys — spec §4/§6).
- **Local:** the usual AWS credential chain (profile / env).
- `db_password` (RDS master) via `export TF_VAR_db_password=...` from the secret store — never in a
  tfvars.

## Deploy
```bash
cd infra/terraform/environments/aws-prod
export TF_VAR_db_password=...                      # from the secret store
terraform init
terraform apply -var-file=aws-prod.tfvars          # fill aws-prod.tfvars first
terraform output -json                             # feeds infra/env/render-env.mjs
```
Then continue with the image build + box deploy — see the top-level `infra/README.md` runbook.

## Notes
- **DB bootstrap:** zitadel/n8n_engine DBs + roles + PostGIS are created by the compose
  `pg-bootstrap` one-shot on the EC2 box (OQ5) — RDS sits in a private subnet, so a Terraform
  `postgresql` provider from CI has no network path. RDS creates the `fnb` app DB (`db_name`).
- **App connection** uses the RDS master user for now (dev-superuser parity;
  `superuser-database-url.plan.md`).
- **`S3_ENDPOINT`** is set to the regional endpoint (`https://s3.<region>.amazonaws.com`) so the
  app's `requiredEnv('S3_ENDPOINT')` is satisfied with **zero code change** (OQ4).
- **CloudFront** (`enable_cdn=true`) uses the default `*.cloudfront.net` cert (no ACM/us-east-1
  alias needed); a custom CDN domain would add an ACM cert in us-east-1.
- **PG password reaches state** (RDS needs it) — keep the state backend private + encrypted. Other
  secrets never enter Terraform (SSM + render-env).
