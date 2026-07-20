# module: `postgres-bootstrap`

The **Terraform-native** alternative to `infra/docker/pg-bootstrap.sh`: creates the `zitadel` +
`n8n_engine` databases + owner login roles + PostGIS on the app DB, via the `cyrilgdn/postgresql`
provider (spec `production-runtime.md` §7).

## Default vs. this module

The **default wired mechanism is the on-box compose one-shot** (`pg-bootstrap` service in
`docker-compose.prod.yml`, running `infra/docker/pg-bootstrap.sh`) — it is idempotent, needs no
Terraform network path to the cluster, and is uniform across both clouds (OQ5). Use **this module**
only if you want Terraform to own the bootstrap AND the runner has a network path to the managed
cluster (a real hurdle on AWS, where the cluster sits in a private subnet — env-aws.md §2).

## Provider configuration (supplied by the caller)

This module declares the `postgresql` provider requirement but not its configuration — the calling
environment root configures it, pointed at the managed cluster's admin connection:

```hcl
provider "postgresql" {
  host     = module.digitalocean.pg_host
  port     = module.digitalocean.pg_port
  username = module.digitalocean.pg_admin_user
  password = module.digitalocean.pg_admin_password
  sslmode  = "require"
  superuser = false            # managed admin (doadmin / rds master) is NOT a true superuser
}

module "postgres_bootstrap" {
  source                 = "../../modules/postgres-bootstrap"
  app_db                 = "fnb"
  zitadel_db_password    = var.zitadel_db_password
  n8n_engine_db_password = var.n8n_engine_db_password
}
```

`terraform validate` works offline; a real `apply` requires the cluster reachable and admin creds.

## Inputs / Outputs

| Input | Default | Notes |
|---|---|---|
| `app_db` | `fnb` | database that gets the PostGIS extension |
| `zitadel_db_password` | — | sensitive; owner role password |
| `n8n_engine_db_password` | — | sensitive; owner role password |

Outputs: `databases`, `roles` (names).
