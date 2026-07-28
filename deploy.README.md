# Pushing a new build to prod (do-prod)

Quick operator steps for shipping the current code to `function-bucket.com` via GitHub Actions.
This is the short version — the full runbook (secrets checklist, laptop fallback, first-boot
expectations, teardown) is `infra/README.md`; the reasoning lives in `.claude/specs/deployment/`
(tag auto-deploy: `tag-auto-deploy.md`, D15–D18).

**The pipeline in one line:** `pnpm do-pre-deploy` stamps the release (version true-up + commit +
`v*` tag), your `git push` triggers `build-images.yml` (8 images, full-SHA tag), a guard confirms
the commit is on `main`, and `deploy.yml` is called automatically (`mode=deploy-only` — terraform
outputs only, never apply): render the box `.env`, ship artifacts over a temporary ssh window,
**exit-code-gated `db-migrate`**, `compose up -d`, restart n8n, health-verify TLS.

aws-prod is **parked** (terraform is authored but never provisioned) — the workflows only
offer/deploy `do-prod` until it's re-added (plan 0560 item 7).

## 0. One-time prerequisites (already done for this repo)

- 22 repo-level GH Actions secrets (`infra/README.md` §Secrets checklist + `DIGITALOCEAN_ACCESS_TOKEN`,
  `SPACES_ACCESS_KEY_ID/SECRET_ACCESS_KEY`, `DOCR_REGISTRY`, `BOX_SSH_PRIVATE_KEY`).
  (+3 `TWILIO_*` secrets when the parked twilio-production-sms cutover resumes — plan 0580.)
- The `gh` CLI authenticated (`gh auth login`) — only needed for watching runs / manual dispatch.

## The routine release (zero clicks after the push)

Merge to `main`, then:

```zsh
pnpm do-pre-deploy            # patch bump; or: pnpm do-pre-deploy minor|major
```

It guards (on main, clean tree, not behind origin — unpushed commits are fine and ride along),
computes the next version from the latest `v*` tag, asks y/N, gates on
`pnpm install --frozen-lockfile` + `pnpm build` (`SKIP_BUILD=1` skips the build for docs-only
ships), trues up every workspace `package.json` version, commits and lightweight-tags `vX.Y.Z`.
Then run the command it prints:

```zsh
git push --atomic origin main vX.Y.Z
gh run watch
```

What happens next, in order: `build-images.yml` builds + pushes the 8 images (~12 min, tag =
full 40-char commit SHA) → `guard` verifies the tagged commit is on `origin/main` (not on main →
images stay pushed, **no deploy**) → `deploy.yml` runs with `mode=deploy-only`: read terraform
outputs (no apply) → render the box `.env` → open a port-22 firewall window for the runner →
rsync artifacts + scp `.env` → registry login → `compose pull` → **`db-migrate` one-shot with
its exit code checked — a failed migration aborts here, old code keeps running** → `compose up
-d` → `compose restart n8n` (required: n8n-import writes workflows/credentials straight to the
DB; a live n8n serves stale webhook routes without the restart) → `health-verify.sh` (TLS 200s
on apex / `id.` / `n8n.`) → close the firewall window (always, even on failure).

## Manual dispatch (infra changes, previews, rollbacks, non-main ships)

`deploy.yml` stays fully dispatchable with a `mode` input:

| `mode` | What it does | When |
|---|---|---|
| `deploy-only` (default) | terraform outputs only → deploy | rollbacks, re-deploys, env re-renders |
| `apply-and-deploy` | `terraform apply` first → deploy | shipping infra changes |
| `plan-only` | `terraform plan` preview, **nothing deploys** | eyeballing infra drift before an apply |

```zsh
# Preview the terraform diff (recommended before any apply-and-deploy):
SHA=$(gh run list --workflow=build-images.yml --limit 1 --json headSha --jq '.[0].headSha')
gh workflow run deploy.yml --ref main -f environment=do-prod -f image_tag=$SHA -f mode=plan-only
gh run watch   # then read the "terraform plan (preview gate — no deploy)" step

# Apply infra changes + deploy:
gh workflow run deploy.yml --ref main -f environment=do-prod -f image_tag=$SHA -f mode=apply-and-deploy

# Build from a non-main branch (never auto-deploys), then deploy it deliberately:
gh workflow run build-images.yml --ref my-branch -f environment=do-prod
gh workflow run deploy.yml --ref main -f environment=do-prod -f image_tag=<that-sha> -f mode=deploy-only
```

## Verify

- The workflow's health-verify step is the machine check.
- Human check: log in at `https://function-bucket.com`, and confirm containers run the new tag
  if you want provenance: `ssh root@<box> "docker ps --format '{{.Names}}\t{{.Image}}'"`.

## Rollback

Deploy the previous SHA — images are immutable per commit, no apply needed:

```zsh
gh workflow run deploy.yml --ref main -f environment=do-prod -f image_tag=<previous-sha> -f mode=deploy-only
```

## Gotchas (each learned the hard way — plan 0560 log)

- `image_tag` is the **full SHA**, not the 12-char short form the laptop scripts use.
- `do-pre-deploy` makes **lightweight** tags on purpose — `github.sha` on annotated-tag pushes
  is ambiguous (tag object vs commit), and both the image tag and the main-ancestry guard key
  off `github.sha`. Tag manually? Use plain `git tag vX.Y.Z`, not `-a`.
- Env-only changes (`.env.prod.tpl`) still need a deploy run to re-render the box `.env`; the
  same image tag is fine (`mode=deploy-only`). Code changes need a new build first.
- Anything the build/deploy needs must be **committed** — CI clones fresh (`.gitignore` bit us
  twice: the codegen output and `.env.prod.tpl` itself).
- Outbound SMTP 25/465/587 is blocked by DO at the account level — Resend runs on **2465**.
- The laptop fallback (`pnpm do-env-build`, no CI) remains the primitive: `infra/README.md`.
  It inherits the db-migrate gate via `deploy.sh`.
