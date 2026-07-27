# Pushing a new build to prod (do-prod)

Quick operator steps for shipping the current code to `function-bucket.com` via GitHub Actions.
This is the short version — the full runbook (secrets checklist, laptop fallback, first-boot
expectations, teardown) is `infra/README.md`; the reasoning lives in `.claude/specs/deployment/`.

**The pipeline in one line:** images are built per commit SHA by `build-images.yml`, and
`deploy.yml` (always manual) applies terraform, renders the box `.env`, ships artifacts over a
temporary ssh window, runs `compose pull && up -d`, restarts n8n, and health-verifies TLS.

aws-prod is **parked** (terraform is authored but never provisioned) — both workflows only
offer `do-prod` until it's re-added (plan 0560 item 7).

## 0. One-time prerequisites (already done for this repo)

- 22 repo-level GH Actions secrets (`infra/README.md` §Secrets checklist + `DIGITALOCEAN_ACCESS_TOKEN`,
  `SPACES_ACCESS_KEY_ID/SECRET_ACCESS_KEY`, `DOCR_REGISTRY`, `BOX_SSH_PRIVATE_KEY`).
  (+3 `TWILIO_*` secrets when the parked twilio-production-sms cutover resumes — plan 0580.)
- The `gh` CLI authenticated (`gh auth login`).

## 1. Land the code

Merge to `main` (or push the branch you intend to ship — both workflows run against whatever
`--ref` you dispatch on, but steady-state releases should come from `main`).

## 2. Build the images

Either **tag a release** (auto-builds):

```zsh
git tag v0.x.y && git push origin v0.x.y
```

or **dispatch manually** from a branch:

```zsh
gh workflow run build-images.yml --ref main -f environment=do-prod
gh run watch
```

Takes ~12 min (8 images: 7 apps + fnb-n8n, amd64 runners). The image tag is the **full 40-char
commit SHA** of the ref that was built.

## 3. (Recommended) plan-only gate

Preview the terraform diff before anything changes:

```zsh
SHA=$(gh run list --workflow=build-images.yml --limit 1 --json headSha --jq '.[0].headSha')
gh workflow run deploy.yml --ref main -f environment=do-prod -f image_tag=$SHA -f run_apply=false
gh run watch   # then read the "terraform plan (no-apply gate)" step
```

Routine code deploys should show **no infra changes**. Unexpected destroys/replaces → stop.

## 4. Deploy

```zsh
gh workflow run deploy.yml --ref main -f environment=do-prod -f image_tag=$SHA -f run_apply=true
gh run watch
```

What the run does, in order: `terraform apply` → export outputs (PG/S3/registry/firewall) →
render the box `.env` from secrets + outputs → open a port-22 firewall window for the runner →
rsync artifacts + scp `.env` → registry login → `compose pull && up -d` → `compose restart n8n`
(required: n8n-import writes workflows/credentials straight to the DB; a live n8n serves stale
webhook routes without the restart) → `health-verify.sh` (TLS 200s on apex / `id.` / `n8n.`) →
close the firewall window (always, even on failure).

## 5. Verify

- The workflow's health-verify step is the machine check.
- Human check: log in at `https://function-bucket.com`, and confirm containers run the new tag
  if you want provenance: `ssh root@<box> "docker ps --format '{{.Names}}\t{{.Image}}'"`.

## Rollback

Deploy the previous SHA — images are immutable per commit:

```zsh
gh workflow run deploy.yml --ref main -f environment=do-prod -f image_tag=<previous-sha> -f run_apply=true
```

## Gotchas (each learned the hard way — plan 0560 log)

- `image_tag` is the **full SHA**, not the 12-char short form the laptop scripts use.
- Env-only changes (`.env.prod.tpl`) still need a deploy run to re-render the box `.env`; the
  same image tag is fine. Code changes need step 2 first.
- Anything the build/deploy needs must be **committed** — CI clones fresh (`.gitignore` bit us
  twice: the codegen output and `.env.prod.tpl` itself).
- Outbound SMTP 25/465/587 is blocked by DO at the account level — Resend runs on **2465**.
- The laptop fallback (`pnpm do-env-build`, no CI) remains the primitive: `infra/README.md`.
