# CLI workflow

The core loop is **`init → plan → apply`**. In fnb, CI runs it as
`terraform -chdir=infra/terraform/environments/<env> init && apply`, then `render-env.mjs`
consumes `terraform output -json`.

## The commands

| Command | Purpose | Key flags |
|---|---|---|
| `terraform init` | Download providers, configure the backend, write `.terraform.lock.hcl`. Run first, and again after changing backend/providers. | `-backend-config=<file|k=v>`, `-reconfigure`, `-migrate-state`, `-upgrade` |
| `terraform validate` | Static check: syntax + types + internal consistency. No cloud access — safe in CI/pre-commit. Doesn't validate arg *values* against the provider. | `-json` |
| `terraform fmt` | Canonical formatting (2-space indent, aligned `=`). Run before commit. | `-check` (CI gate, non-zero if unformatted), `-recursive`, `-diff` |
| `terraform plan` | Preview the diff (create/update/destroy). Read it before every apply. | `-out=plan.bin`, `-var`, `-var-file`, `-target`, `-refresh=false`, `-destroy` |
| `terraform apply` | Converge real infra to config. Prompts unless `-auto-approve` or given a saved plan file. | `plan.bin` (apply a saved plan), `-auto-approve`, `-var`, `-var-file`, `-target` |
| `terraform destroy` | Tear down everything in state. Alias for `apply -destroy`. | `-target`, `-auto-approve` |
| `terraform output` | Print root-module outputs — the extraction path for `render-env.mjs`. | `-json`, `-raw <name>` |
| `terraform show` | Human/JSON view of current state or a saved plan. | `-json` |
| `terraform state …` | `list` / `show` / `mv` / `rm` — inspect & surgically edit state. | see state-and-backends.md |
| `terraform import` | Bind an existing object into state at an address. `import {}` blocks (TF ≥1.5) are the reviewable alternative. | `-var`, `plan -generate-config-out=` (with import blocks) |
| `terraform console` | REPL for expressions/functions against current state. | — |
| `terraform workspace` | Multiple named states in one backend. Not used for fnb prod/staging (separate dirs instead). | `new`, `select`, `list` |

**Global option:** `-chdir=<dir>` runs as if from that dir (fnb CI uses it to target an
environment without `cd`). It comes *before* the subcommand: `terraform -chdir=infra/terraform/environments/do-prod apply`.

## The standard loop

```bash
cd infra/terraform/environments/do-prod        # or use -chdir
terraform init -backend-config=backend.hcl     # once, or after backend/provider change
terraform fmt -check && terraform validate     # cheap gates
terraform plan  -var-file=do-prod.tfvars -out=tfplan
# review the plan (a human, or a PR speculative plan)
terraform apply tfplan                          # apply the exact reviewed plan
terraform output -json > outputs.json           # feed render-env.mjs
```

Applying a **saved plan file** (`-out` then `apply tfplan`) guarantees you apply exactly what was
reviewed — no drift between plan and apply. Secrets: pass via `TF_VAR_*` / assume-role env, not
baked into the saved plan (time-limited creds can expire before apply).

## Extracting outputs (there is no `terraform export`)

The "export" people mean is one of:

```bash
terraform output -json                       # all outputs as JSON  -> render-env.mjs parses this
terraform output -raw pg_url                 # one value, unquoted (scripts)
terraform show -json                         # full state/plan as JSON (jq-able)
terraform show -json tfplan | jq …           # inspect a saved plan programmatically
```

In fnb, `infra/env/render-env.mjs` reads `terraform output -json`, pulls the `sensitive` outputs
(managed-PG URL/password, bucket keys), and renders the box `.env` — failing loud on any missing
key (the `${VAR:?}` discipline moved to render time; spec §3).

## CI/CD notes (spec §4)

- Two workflows: `build-images.yml` (images → registry) then `deploy.yml` (`init && apply` +
  render `.env` + `deploy.sh` + `health-verify.sh`). The scripts are the primitive; the workflows
  are thin wrappers so a human can run the same deploy locally.
- Gate PRs with `terraform fmt -check` + `terraform validate` (+ TFLint if adopted). Post `plan`
  as a reviewable artifact/comment; apply only after review.
- Whether prod `apply` is automatic in `deploy.yml` or a separate manual gate is an **open item**
  (spec §6) — prefer a manual approval gate for prod safety.

## Gotchas

- **`-target` is surgery, not routine** — it applies a partial graph and can leave state/plan
  inconsistent; a normal full `plan`/`apply` is almost always right.
- **`-auto-approve`** belongs only in CI after a reviewed plan (or applying a saved plan file);
  never as a reflex locally.
- **`init` after backend change** may need `-reconfigure` (ignore old state) or `-migrate-state`
  (copy it) — pick deliberately, and back up state first.
- **`fmt`/`validate` are cheap and catch most mistakes** — wire them as the first CI step and a
  pre-commit hook.
- **Never run `apply`/`destroy`/`git` on the user's behalf** in this repo — author the code and
  hand off; the user owns commits and applies (project CLAUDE.md).
