---
name: terraform-export
description: >
  Terraform (HCL / OpenTofu-compatible) technology reference for authoring and operating the
  fnb `infra/terraform/` deployment code. Use for any Terraform task — writing/organizing HCL,
  the terraform/provider/resource/data/variable/output/locals/module blocks, reusable modules +
  per-environment tfvars, remote state and backends (S3 + DynamoDB/native lock, DigitalOcean
  Spaces as an S3-compatible backend), provider requirements + version constraints + the lock
  file, and the `init → plan → apply` CLI workflow (incl. `terraform output -json` feeding
  render-env.mjs). Triggers include: "terraform", "HCL", ".tf file", "terraform module",
  "backend/remote state", "tfvars", "terraform plan/apply", "provider version constraint",
  "terraform output", or any work under `infra/terraform/`. Prefer this over memory — version
  constraint syntax, backend keys, and state semantics are easy to get wrong.
---

# Terraform (`terraform-export`)

A technology-reference specialist for the fnb stack's Infrastructure-as-Code. The deployment
spec (`.claude/specs/deployment/`) provisions **two environments** — DigitalOcean and AWS — with
**parameterized, prod-first Terraform**: reusable cloud *modules* + thin per-environment
directories that each supply a *backend* + a *tfvars* file. This skill holds the **how** of
Terraform itself; the spec holds the **truth** of what fnb provisions. Read `terraform-and-cicd.md`
for the concrete `infra/` layout — do not restate it here.

> **The name.** "`terraform-export`" is the repo's slug for this reference; scope is the *general
> Terraform language + workflow* (the user's chosen scope), not a single `export` command. Note
> there is **no `terraform export`** command — output extraction is `terraform output -json` /
> `terraform show -json` (see `references/cli-workflow.md`).

## Core mental model

Terraform is **declarative**: you describe the desired end state in `.tf` files (HCL); Terraform
diffs that against **state** (its record of real objects) and computes the minimal set of API
calls to converge. Four moving parts:

1. **Configuration** — `.tf` files in a directory (the *root module*). Blocks: `terraform`,
   `provider`, `resource`, `data`, `variable`, `output`, `locals`, `module`. Order and file
   split are insignificant — Terraform loads all `.tf` in the dir together.
2. **Providers** — plugins that map resource types to a cloud API (`aws`, `digitalocean`,
   `postgresql`). Declared in `terraform { required_providers {} }`, pinned by the
   `.terraform.lock.hcl`, installed by `terraform init`.
3. **State** — the JSON binding between config resource instances and real objects. Lives in a
   **backend** (local file by default; **remote** for teams — S3/Spaces here). Contains secrets
   in plaintext → the backend must be private + encrypted; **never edit by hand**.
4. **Workflow** — `init` (once / on backend|provider change) → `plan` (preview) → `apply`
   (converge). Outputs are extracted with `terraform output -json`.

**Dependencies are implicit**: referencing `aws_vpc.main.id` from another resource creates the
edge and the ordering. Reach for `depends_on` only when there's a hidden dependency Terraform
can't see.

## Decision guide — read the reference for your task first

| Your task | Read |
|---|---|
| Writing/structuring HCL: blocks, meta-args (`count`/`for_each`/`lifecycle`/`depends_on`), resources vs data sources, expressions, `for`/`dynamic`, functions | `references/hcl-language.md` |
| Building a reusable module, wiring `var`/`output`/`locals`, calling modules with per-env tfvars, validation, sensitive values | `references/modules-variables-outputs.md` |
| Remote state, the `s3` backend (AWS **and** DigitalOcean Spaces), locking (DynamoDB vs native lockfile), per-env state separation, `terraform_remote_state`, partial backend config, state surgery/import | `references/state-and-backends.md` |
| `required_providers`, source addresses, **version constraint syntax** (`~>` etc.), the lock file, provider `alias`, passing providers to modules; DO/AWS provider notes | `references/providers.md` |
| The CLI: `init/validate/fmt/plan/apply/destroy/output/show/state/import/console`, flags (`-var`/`-var-file`/`-out`/`-chdir`/`-backend-config`/`-target`/`-auto-approve`), CI/CD loop, `output -json` → `render-env.mjs` | `references/cli-workflow.md` |

Do not paraphrase a reference from memory — open it. The files carry the exact syntax and the
gotchas (version-constraint semantics, S3-compatible `skip_*` flags, precedence order) that are
routinely misremembered.

## fnb-specific anchors (don't re-derive)

- **Where the code lives:** `infra/terraform/` — `modules/{digitalocean,aws,postgres-bootstrap}`
  + `environments/{do-prod,aws-prod}`. Each environment is a thin backend + `*.tfvars` calling a
  cloud module. Full tree: `.claude/specs/deployment/terraform-and-cicd.md` §1.
- **State backends:** per-environment, never shared — **S3 + DynamoDB (or native) lock** for AWS,
  **DigitalOcean Spaces** (S3-compatible endpoint + `skip_*` flags) for DO. See
  `references/state-and-backends.md` and spec §2.
- **Secrets discipline (spec §3):** static secrets live in the secret store (SSM / GH secrets),
  **never** in the repo or in state plaintext. Infra-derived secrets (managed-PG password/URL,
  bucket keys) are `sensitive = true` **outputs** → consumed by `infra/env/render-env.mjs` via
  `terraform output -json`. The state backend must be private/encrypted precisely because those
  land in state.
- **CI/CD (spec §4):** `deploy.yml` runs `terraform -chdir=infra/terraform/environments/<env>
  init && apply`; the module `var.environment` suffixes every resource name so `prod`/`staging`
  never collide. **Never** run `git`/push or the actual `apply` on the user's behalf — design and
  author the code; the user owns commits and runs (project CLAUDE.md + global R).

## Handoffs

- The `infra/` build **sequence** (phases, task list, first-boot verification) is owned by the
  deployment spec + `fnb-stack-implementor` — this skill only supplies Terraform know-how.
- Sideways: DB bootstrap semantics → `fnb-db-designer`/`sqitch-expert`; the ZITADEL/n8n prod
  hardening those modules must satisfy → `zitadel-expert` / `n8n-cli`. Object storage / S3 API
  behavior the app relies on is in the deployment spec, not here.
