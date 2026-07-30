# Modules, variables, outputs, locals

The fnb infra is **parameterized, prod-first**: reusable cloud *modules* (`digitalocean`, `aws`,
`postgres-bootstrap`) + thin per-environment dirs that supply a backend + a tfvars file. This is
exactly the "root module calls child modules, environments differ only by tfvars" pattern.

## Modules

A **module** is a directory of `.tf` files. The dir you run `terraform` in is the **root module**;
anything it calls via a `module` block is a **child module**. Standard structure:

```
modules/digitalocean/
├── main.tf        # resources + data sources
├── variables.tf   # inputs (alphabetical)
├── outputs.tf     # outputs (alphabetical)
├── versions.tf    # terraform{} required_version + required_providers
└── README.md
```

**Calling a module:**
```hcl
module "digitalocean" {
  source = "../../modules/digitalocean"     # local path: no version arg

  environment  = var.environment            # inputs = the child's variable names
  region       = "nyc3"
  droplet_size = "s-4vcpu-8gb"
  domain       = var.domain
}
```
- **`source`** (required): local path (`./`, `../`), registry (`namespace/name/provider`), or
  git (`git::https://…//subdir?ref=v1.2.0`). fnb uses **local paths** — no `version` arg for
  those (version only applies to registry/remote sources; always pin those with `~>`).
- **Inputs**: pass named arguments matching the child's `variable` blocks.
- **Outputs**: consume with `module.<name>.<output>` — `module.digitalocean.droplet_ip`.
- **`count`/`for_each` on modules** work too → indexed access `module.env["prod"].id`.

Implicit dependencies flow through outputs: if module B takes `module.A.vpc_id` as input,
Terraform orders A before B automatically.

## Variables (inputs)

```hcl
variable "environment" {
  type        = string
  description = "Deploy environment; suffixes every resource name."
  # no default -> required
  validation {
    condition     = contains(["prod", "staging"], var.environment)
    error_message = "environment must be prod or staging."
  }
}

variable "db_tier"    { type = string,  default = "db-s-1vcpu-2gb" }
variable "subnets"    { type = map(string), default = {} }        # map(cidr by AZ)
variable "pg_password" {
  type      = string
  sensitive = true            # kept out of CLI output (still in STATE — see backends)
}
```

**Type constraints:** `string`, `number`, `bool`; collections `list(T)`, `set(T)`, `map(T)`;
structural `object({ name = string, size = number })`, `tuple([...])`; and `any`. Reference
anywhere as `var.<name>`.

**Optional args:** `default`, `description` (always write one), `sensitive`, `nullable`
(default `true`), `validation` blocks. Recommended arg order: type → description → default →
sensitive → validation.

### Assigning values — precedence (highest wins)

1. `-var` / `-var-file` on the CLI (and HCP Terraform workspace vars)
2. `*.auto.tfvars` / `*.auto.tfvars.json` (lexical order)
3. `terraform.tfvars.json`
4. `terraform.tfvars`
5. `TF_VAR_<name>` environment variables
6. the variable's `default`

fnb pattern: each `environments/<env>/` holds a `do-prod.tfvars` (non-secret knobs) passed via
`-var-file`, and secrets arrive as `TF_VAR_*` from the secret store — **never** committed in a
tfvars file. Note: a `TF_VAR_x` with no matching `variable` block is silently ignored; a stray
`-var` errors.

## Outputs

```hcl
output "droplet_ip" {
  description = "Public IP of the prod droplet."
  value       = digitalocean_droplet.web.ipv4_address
}

output "pg_url" {
  description = "Managed-PG connection URL (consumed by render-env.mjs)."
  value       = digitalocean_database_cluster.pg.uri
  sensitive   = true          # required, or apply errors on exposing a sensitive value
}
```

Outputs are the **only** supported way to pass data out of a module / configuration. In fnb they
are the contract to `infra/env/render-env.mjs`, read via `terraform output -json`
(`references/cli-workflow.md`). Mark anything secret `sensitive = true` — and remember it is
**still stored in state in plaintext**, which is why the state backend is private/encrypted.

## Locals

```hcl
locals {
  name_prefix = "fnb-${var.environment}"
  common_tags = { environment = var.environment, managed_by = "terraform" }
}
# use as local.name_prefix
```

Computed once per module, not overridable by callers. Use for repeated expressions and the
`fnb-<env>` naming convention. Don't overuse — a local that's used once just adds indirection.

## Gotchas

- **`sensitive` ≠ secret at rest.** It only masks CLI output; the value is plaintext in state.
  Real protection = private/encrypted backend + not committing the value.
- **Child modules should not pin *max* provider versions** (`~>` in a shared module forces
  callers). Only the root/env constrains with `~>`; modules state a `>=` floor. (See
  `references/providers.md`.)
- **Output references fail at plan time** if you name a non-existent output — good, catch it early.
- **A module input has no value until instantiation** — validation runs when the module is called,
  not when it's defined.
