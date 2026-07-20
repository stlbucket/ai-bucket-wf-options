# Providers, version constraints, the lock file

Providers are the plugins that turn `resource`/`data` types into API calls. fnb uses `aws`,
`digitalocean`, and `postgresql` (the `postgres-bootstrap` module). Get versioning right — it's
the most-misremembered part.

## `required_providers`

Declared inside the `terraform` block. Left side = **local name** (the prefix in resource types);
right side = **source** + **version**.

```hcl
terraform {
  required_version = ">= 1.7"

  required_providers {
    aws          = { source = "hashicorp/aws",            version = "~> 5.0"  }
    digitalocean = { source = "digitalocean/digitalocean", version = "~> 2.0"  }
    postgresql   = { source = "cyrilgdn/postgresql",       version = "~> 1.21" }
  }
}
```

**Source address:** `[HOSTNAME/]NAMESPACE/TYPE` — hostname defaults to `registry.terraform.io`.
So `hashicorp/aws` = `registry.terraform.io/hashicorp/aws`. Omitting `source` entirely assumes
`hashicorp/<local-name>` (backward-compat) — **always be explicit**, especially for non-HashiCorp
providers like `digitalocean/digitalocean` and `cyrilgdn/postgresql`.

## Version constraint syntax

| Operator | Meaning | Example allows |
|---|---|---|
| `= 5.34.0` | exact | only 5.34.0 |
| `>= 5.0` | minimum | 5.0 and up (incl. 6.x) |
| `>= 5.0, < 6.0` | range | 5.x only |
| `~> 5.0` | pessimistic, minor floor | `>= 5.0, < 6.0` (allows 5.x, not 6.0) |
| `~> 5.34.0` | pessimistic, patch floor | `>= 5.34.0, < 5.35.0` (patch only) |

Terraform picks the **highest** version satisfying the constraint.

**Best practice by module role:**
- **Root / `environments/<env>`** — use `~>` to prevent surprise **major** upgrades
  (`~> 5.0`). Also pin `required_version` for the Terraform CLI itself (`>= 1.7`).
- **Reusable child modules** (`modules/*`) — state only a **minimum** (`>= 5.0`), no upper bound,
  so consumers aren't forced to a version. A `~>` in a shared module is a common trap that
  handcuffs callers.

## The dependency lock file

`terraform init` writes `.terraform.lock.hcl` recording the **exact** selected versions +
checksums. **Commit it** — it makes provider selection reproducible across the team and CI. To
upgrade: bump the `version` constraint (or run `terraform init -upgrade`) and re-init; review the
lock diff. (Distinct from **state** — the lock pins *plugins*, state tracks *resources*.)

## Provider configuration & aliases

```hcl
provider "aws" { region = var.region }                 # default config

provider "aws" {                                        # a second, aliased config
  alias  = "us_east_1"
  region = "us-east-1"                                  # e.g. ACM/CloudFront must be us-east-1
}

resource "aws_acm_certificate" "cdn" {
  provider = aws.us_east_1                              # opt a resource into the alias
  # ...
}
```

Resources whose type prefix matches the local name use the default config automatically — no
`provider` arg needed unless you want an alias.

### Passing providers into modules

A child module inherits the default provider by default. Pass explicit/aliased configs when a
module needs a specific region (or the `postgresql` provider pointed at a managed cluster):

```hcl
module "cdn" {
  source    = "../../modules/aws-cdn"
  providers = { aws = aws.us_east_1 }        # maps caller's alias -> module's default "aws"
}
```
The child declares what it expects via `configuration_aliases` in its `required_providers`
(`aws = { source = "hashicorp/aws", configuration_aliases = [aws.us_east_1] }`).

## fnb provider notes

- **`digitalocean/digitalocean`** — auth via `DIGITALOCEAN_TOKEN` (env, not committed). Covers the
  droplet, VPC, Managed PG cluster + DBs/users, Spaces bucket + policy/CORS/CDN, DOCR, firewall,
  DNS, reserved IP (spec §Phase 4). Spaces access keys are a separate `spaces_access_id` /
  `spaces_secret_key` pair — pass as env/vars, and the **Spaces-as-state-backend** flags live in
  `references/state-and-backends.md`.
- **`hashicorp/aws`** — auth in CI via **GitHub OIDC assume-role** (no static keys — spec §4/§6).
  Covers VPC/subnets, EC2 + EIP, SGs, RDS + subnet group, S3 + policy/CORS/CloudFront, ECR ×8,
  IAM instance profile, Route 53, SSM params (spec §Phase 5). `us-east-1` alias needed for
  CloudFront/ACM.
- **`cyrilgdn/postgresql`** — the `postgres-bootstrap` module option that creates the `zitadel` /
  `n8n_engine` DBs + owner roles + `CREATE EXTENSION postgis` on managed PG. Needs a network path
  to the cluster; on AWS the spec's alternative is an on-box `psql` one-shot (spec §Phase 3 /
  environment-aws.md). It is intentionally a module so both clouds call it identically.

## Gotchas

- **Omitting `source`** silently defaults to the HashiCorp namespace — wrong for `digitalocean`
  and `cyrilgdn/postgresql`. Always specify it.
- **Lock file not committed** → teammates/CI may pull different patch versions. Commit it.
- **`~>` in a shared module** forces every consumer's ceiling — keep `~>` at the root/env only.
- **Managed-PG bootstrap ordering** — the `postgresql` provider can't connect until the cluster
  exists and a network path is open; sequence with module dependencies or the on-box one-shot.
