# State & backends

## What state is

State is the JSON binding between the resource instances in your config and the real objects in
the cloud. Terraform needs it to: (1) map config → real object, (2) store metadata for lifecycle,
(3) avoid re-reading everything on every run. Before an operation Terraform refreshes state
against reality, then diffs against config to build the plan.

**State holds secrets in plaintext** (passwords, keys, connection URLs — anything a resource or a
`sensitive` output computed). Therefore: the backend must be **private + encrypted**, and you
**never** commit `terraform.tfstate*` or edit it by hand. Manipulate it only through the CLI
(`terraform state …`, `import`, `moved`/`import` blocks).

## Backends — where state lives

A **backend** is configured in the `terraform` block (at most one, and it can't reference
variables/locals/data — it's resolved before everything else):

```hcl
terraform {
  backend "s3" {
    bucket = "fnb-tfstate"
    key    = "aws-prod/terraform.tfstate"
    region = "us-east-1"
  }
}
```

Default backend is **local** (`terraform.tfstate` on disk) — fine for scratch, wrong for teams
and CI. fnb uses **remote, per-environment** state: never share one state across environments.

### Per-environment separation (the fnb pattern)

Each `environments/<env>/` has its **own backend block + its own state**. Separate by the `key`
(state path) — and/or a separate bucket per cloud:

```hcl
# environments/aws-prod/backend.tf   -> key = "aws-prod/terraform.tfstate"
# environments/do-prod/backend.tf    -> key = "do-prod/terraform.tfstate"
```

Prefer distinct `environments/<env>/` directories (fnb's choice) over Terraform *workspaces* for
prod/staging isolation — separate dirs make the backend, tfvars, and blast radius explicit.
(Workspaces store extra states under a `workspace_key_prefix` in the same backend; handy for
ephemeral copies, not for prod/staging here.)

## The `s3` backend

Required: `bucket`, `key`, `region`. Common options: `encrypt = true`, `kms_key_id`, `profile`
or an `assume_role { role_arn = … }` block, `acl`. **Enable S3 bucket versioning** for state
recovery.

**Locking** prevents two applies from corrupting state:
- **`use_lockfile = true`** — S3-**native** lock (a `<key>.tflock` object). The current
  recommendation.
- **`dynamodb_table = "…"`** — legacy DynamoDB lock (partition key `LockID`, type String).
  **Deprecated** and slated for removal — prefer `use_lockfile`. (The fnb spec's "S3+DynamoDB
  lock" wording predates native locking; `use_lockfile` is the modern equivalent and one fewer
  resource — flag this when authoring the AWS backend.)

```hcl
terraform {
  backend "s3" {
    bucket       = "fnb-tfstate"
    key          = "aws-prod/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}
```

### DigitalOcean Spaces (S3-compatible) backend

Spaces speaks the S3 API but lacks STS/IAM/metadata, so point `endpoints.s3` at the Spaces
region host and set the `skip_*` flags. Credentials go through `AWS_ACCESS_KEY_ID` /
`AWS_SECRET_ACCESS_KEY` env vars (the Spaces key/secret) — not in the block.

```hcl
terraform {
  backend "s3" {
    bucket = "fnb-tfstate-do"
    key    = "do-prod/terraform.tfstate"
    region = "nyc3"                                     # Spaces region name
    endpoints                   = { s3 = "https://nyc3.digitaloceanspaces.com" }
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_metadata_api_check     = true
    skip_requesting_account_id  = true
    skip_s3_checksum            = true                  # Spaces checksum differs
    use_path_style              = true                  # if virtual-hosted style misbehaves
  }
}
# Native lockfile support on non-AWS S3 stores is uneven — verify use_lockfile works on Spaces;
# otherwise rely on the CI serialization (one apply at a time) as the practical lock.
```

## Partial configuration (keep secrets out of the repo)

Omit sensitive/variable backend args from the block and pass them at init — fits CI:

```bash
terraform init -backend-config=backend.hcl          # a file of key=value
terraform init -backend-config="key=aws-prod/terraform.tfstate" -backend-config="region=us-east-1"
```

The merged result lands in `.terraform/` — which is **git-ignored** (it can contain credentials).

## Reading another config's state

```hcl
data "terraform_remote_state" "network" {
  backend = "s3"
  config  = { bucket = "fnb-tfstate", key = "aws-prod/network/terraform.tfstate", region = "us-east-1" }
}
# use: data.terraform_remote_state.network.outputs.vpc_id
```
Only that config's **outputs** are exposed — one more reason outputs are the module contract.

## Migrating & manipulating state (rare, careful)

- **Change backends** → next `terraform init` offers to migrate existing state; **back up the
  state file first**. `-reconfigure` ignores existing state; `-migrate-state` copies it.
- **Inspect/repair:** `terraform state list`, `state show <addr>`, `state mv <a> <b>` (rename
  without destroy/create — or use a `moved {}` block in config, which is reviewable in the plan),
  `state rm <addr>` (stop managing without destroying).
- **Adopt existing infra:** `terraform import <addr> <id>`, or an **`import {}` block** (TF ≥1.5,
  reviewable, works with `plan -generate-config-out=…` to scaffold the HCL). After any import you
  own the one-object-per-instance mapping — mismatch → orphans or accidental deletes.

## Gotchas

- **Never commit or hand-edit state.** Corruption or a leaked secret is the cost.
- **DynamoDB locking is deprecated** — reach for `use_lockfile`.
- **S3-compatible ≠ guaranteed** — HashiCorp only fully supports real S3; test Spaces backend
  behavior (locking especially) before trusting it.
- **`-target` / partial applies drift state** — use for surgery, not routine runs.
- **Time-limited creds + saved plans** — assume-role creds can expire between `plan -out` and
  `apply`; pass creds via env vars, not baked into the plan.
