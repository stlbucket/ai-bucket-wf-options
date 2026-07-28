# Tag auto-deploy — `v*` tag on main → prod, no manual dispatch (D15–D18)

## Status
Implemented 2026-07-27 — pending live verification (the user-run items in the task list).

Parent index: `README.md` (Phase 10). Companion operator doc to update on implementation:
`deploy.README.md` (repo root) + `infra/README.md` runbook.

---

## Purpose

Close the last manual step in the release pipeline. Today (`deploy.README.md`):

1. `git tag v0.x.y && git push origin v0.x.y` → `build-images.yml` auto-builds + pushes the
   images (full-SHA tag) — **already automatic**
2. `gh workflow run deploy.yml ... -f image_tag=$SHA -f run_apply=true` — **manual, by design**
   (the plan-preview gate)

After this change, a `v*` tag on a commit that is on `main` deploys to do-prod end-to-end with
zero clicks: build → ancestry guard → deploy (terraform **outputs only**, no apply) → gated
db-migrate → app cutover → n8n restart → health-verify. Manual dispatch of `deploy.yml` remains
fully available (infra applies, plan previews, rollbacks).

The release front door is **`pnpm do-pre-deploy`** (TD7, user-run only): guards → pre-flight
gates (build + frozen lockfile) → semver bump computed from the latest `v*` tag → version
true-up across every workspace `package.json` → commit + lightweight tag → prints the one
`git push --atomic` command that sets the whole pipeline off.

---

## Locked decisions (with the why)

| # | Decision | Why |
|---|---|---|
| TD1 | **Chain deploy via `workflow_call`** — `deploy.yml` gains an `on: workflow_call` trigger; `build-images.yml` calls it as a downstream job (`needs`, `secrets: inherit`). Not `workflow_run`, not a merged single file | No cross-workflow race (deploy starts only after images exist), no duplicated deploy logic, `deploy.yml` stays independently dispatchable, and `inputs.*` gates keep working because `workflow_call` shares the `inputs` context |
| TD2 | **The tag path never runs `terraform apply`** — it reads `terraform output -json` only (the read-only posture of `do-db-rebuild.sh`) | A code tag can never surprise-apply pending infra drift; infra changes stay deliberate via manual dispatch. Recovers most of the safety the manual plan-preview gate provided (user decision 2026-07-27) |
| TD3 | **`run_apply` (boolean) → `mode` (choice): `deploy-only` (default) \| `apply-and-deploy` \| `plan-only`** | Three modes now exist and a boolean can't express "deploy without apply". `deploy-only` as the dispatch default makes bare dispatches safe and makes rollback ergonomic (previous SHA, no apply). Old semantics map: `run_apply=true` → `apply-and-deploy`, `run_apply=false` → `plan-only` |
| TD4 | **On-main ancestry guard before auto-deploy** — a `guard` job between `build` and the deploy call: `git merge-base --is-ancestor $GITHUB_SHA origin/main` or skip deploy | `build-images.yml` fires on a `v*` tag on *any* commit; builds are harmless (immutable SHA-tagged images) but only main may auto-deploy. Manual `build-images.yml` dispatches never chain into a deploy at all (`github.event_name == 'push'` gate) |
| TD5 | **Explicit db-migrate gate in `deploy.sh`** — after artifact rsync + registry login, run `compose up --exit-code-from db-migrate db-migrate` **before** `up -d` of the app services | A failed migration aborts the deploy while old code still runs against the old schema. Today `up -d` runs db-migrate implicitly with no exit-code check (only n8n gates on it) — new code could come up against an un-migrated schema. Same invocation `do-db-rebuild.sh` already uses (proven on the box). Benefits CI **and** laptop (`do-env-build`) paths alike (user decision 2026-07-27) |
| TD6 | **Deploy serialization is enforced at the caller** for the tag path | Workflow-level `concurrency` in a *called* reusable workflow does not apply to the caller's run — the group `deploy-${{ inputs.environment }}` must also exist on the calling job (or job-level in the called job). Verify at implementation time |
| TD7 | **`pnpm do-pre-deploy` is the release front door** (user-run only — it runs git): guards (on `main`, clean tree, not behind `origin/main`; ahead is allowed), pre-flight gates (`pnpm build` — skippable `SKIP_BUILD=1` — and `pnpm install --frozen-lockfile`), semver bump from the latest `v*` tag (`patch` default; `minor`/`major` arg), version true-up in root + all workspace `package.json`s, y/N confirm, commit `vX.Y.Z` + **lightweight** tag, then print `git push --atomic origin main vX.Y.Z` | One command computes and stamps a consistent release; the local build/lockfile gates catch failures in minutes instead of a wasted ~12-min CI image build on a bad tag. Lightweight tag deliberately — `github.sha` on annotated-tag pushes is ambiguous (tag object vs commit), and the existing manual flow already uses lightweight tags. Ahead-of-origin is allowed because unpushed commits are the natural pre-release state and ride the same atomic push (user decisions 2026-07-27) |

---

## Current state (what already exists — do not rebuild)

- `.github/workflows/build-images.yml` — `on: push tags ['v*']` + `workflow_dispatch`; matrix
  `[do-prod]` (aws-prod parked, plan 0560 item 7); builds all images with
  `IMAGE_TAG: ${{ github.sha }}` (full 40-char SHA) via `infra/scripts/build-images.sh`.
- `.github/workflows/deploy.yml` — `workflow_dispatch` only; inputs `environment` /
  `image_tag` / `run_apply`; steps: terraform init → apply (or plan-only) → export tf outputs
  (masked) → render `.env` → temporary ssh firewall window → `deploy.sh` → `health-verify.sh`
  → close window (`always()`). Secrets are wired; the pipeline has run live.
- `infra/scripts/deploy.sh` — rsyncs `infra/{compose,docker}`, `docker/`, `db/`, `n8n/`,
  brand assets + scp `.env`; registry login; `compose pull && up -d --remove-orphans`;
  `compose restart n8n` (webhook re-registration guard).
- DB migration forward already happens on every deploy: `deploy.sh` ships the current `db/`
  tree and the `db-migrate` one-shot re-runs on `up -d` (sqitch, forward-only, idempotent,
  `SEED_DATA=empty`) — what's missing is only the exit-code gate (TD5).

---

## Changes

### 1. `.github/workflows/deploy.yml`

- Add `on: workflow_call` with inputs `environment` (string, required), `image_tag` (string,
  required), `mode` (string, default `deploy-only`).
- Replace the dispatch input `run_apply` (boolean) with `mode` (choice:
  `deploy-only` | `apply-and-deploy` | `plan-only`; default `deploy-only`) — TD3.
- Re-gate the steps on `mode`:
  - `terraform apply` → `inputs.mode == 'apply-and-deploy'`
  - `terraform plan` (preview) → `inputs.mode == 'plan-only'`
  - export tf outputs, render `.env`, ssh window, deploy, health-verify →
    `inputs.mode != 'plan-only'` (the export step is `terraform output -json` — works without
    an apply; `init` already runs unconditionally)
  - the do-prod credential/doctl steps keep their `environment == 'do-prod'` conditions
- `environment: ${{ inputs.environment }}` (GH environment gating) and the sensitive-output
  masking are unchanged and work under `workflow_call`.
- Concurrency (TD6): keep the workflow-level group for dispatch runs AND add the same group
  where it binds for the called path (job-level `concurrency: deploy-${{ inputs.environment }}`
  on the deploy job, or on the caller job in `build-images.yml`) — verify which binds during
  implementation; the invariant is: **never two concurrent deploys to the same environment**.

### 2. `.github/workflows/build-images.yml`

Two new jobs after `build` (both `if: github.event_name == 'push'` — tag pushes only; manual
build dispatches never chain, TD4):

```yaml
guard:            # TD4 — only commits on main may auto-deploy
  needs: build
  # checkout with enough history (fetch-depth: 0 or a fetched origin/main), then:
  #   git merge-base --is-ancestor "$GITHUB_SHA" origin/main
  # not-on-main → fail this job with a clear message (images stay pushed; no deploy)

deploy:
  needs: guard
  uses: ./.github/workflows/deploy.yml
  with:
    environment: do-prod        # aws-prod parked — extend with the matrix when it stands up
    image_tag: ${{ github.sha }}   # same value the build job tagged with — always consistent
    mode: deploy-only           # TD2 — never applies terraform
  secrets: inherit
```

### 3. `infra/scripts/deploy.sh` (TD5)

After registry login, replace the bare cutover:

```bash
# before:
ssh_box "$COMPOSE pull"
ssh_box "$COMPOSE up -d --remove-orphans"

# after:
ssh_box "$COMPOSE pull"
# Gate: run the migration one-shot to completion (pg-bootstrap dep runs first; idempotent).
# A non-zero exit aborts the deploy here — old images keep running against the old schema.
ssh_box "$COMPOSE up --exit-code-from db-migrate db-migrate"
ssh_box "$COMPOSE up -d --remove-orphans"
```

The `restart n8n` guard after `up -d` is unchanged. Note `db-migrate` is `build:`-based on the
box (repo-root context shipped by the rsync) — `compose pull` skips it; the `up` builds it,
exactly as `do-db-rebuild.sh` already does.

### 4. `infra/scripts/do-pre-deploy.sh` + root script (TD7 — new)

`pnpm do-pre-deploy [patch|minor|major]` (default `patch`). **USER-RUN ONLY** header like its
siblings (it runs git — the assistant never executes it). Flow:

1. **Guards** (all before any mutation): `git fetch origin --tags`; current branch is `main`;
   working tree clean (`git status --porcelain` empty); local `main` not behind `origin/main`
   (`git rev-list --count HEAD..origin/main` = 0 — ahead is fine, the commits ride the push).
2. **Version**: latest `v*` tag by `git tag -l 'v*' --sort=-v:refname | head -1` (default
   `v0.0.0` when none), bump per the arg → `NEW_VERSION`.
3. **Confirm**: print `v<current> → v<next> (<bump>)` + the file set to be committed; `y/N`
   prompt; abort on anything but `y` (before the slow gates, so a wrong bump costs nothing).
4. **Pre-flight gates**: `pnpm install --frozen-lockfile` (stale lockfile fails here, not in
   the CI image build) then `pnpm build` (the repo gate; `SKIP_BUILD=1` skips for docs-only
   releases). Any failure aborts before any file is touched.
5. **True-up**: set `"version": "<next>"` (no `v` prefix) in the root `package.json` + every
   `apps/*/package.json` + `packages/*/package.json` (a `node -e` JSON rewrite — 2-space
   indent + trailing newline, matching prettier; adds the field where missing).
6. **Commit + tag**: `git add` only the touched `package.json` files; commit `v<next>`;
   **lightweight** `git tag v<next>` on that commit.
7. **Hand-off print**: the exact finisher and what happens next:
   `git push --atomic origin main v<next>` → build-images → guard → deploy → health-verify.

### 5. Docs (same change set)

- `deploy.README.md` — rewrite the flow: tag-on-main is now zero-click; manual dispatch section
  moves to "infra changes, previews, rollbacks, non-main ships" with the new `mode` values
  (rollback becomes `-f mode=deploy-only -f image_tag=<previous-sha>`); keep the gotchas.
- `infra/README.md` — runbook: note the auto path + that `deploy.sh` now hard-gates on
  db-migrate.

---

## What does NOT change

- `pnpm do-env-build` / `do-env-teardown` / `do-db-rebuild` — untouched (do-env-build inherits
  the TD5 gate via `deploy.sh`, a strict improvement). The laptop *deploy* fallback remains
  `SKIP_APPLY=1 pnpm do-env-build` ("scripts are the primitive") — `do-pre-deploy` is the
  release stamp, not a deploy path.
- Workspace `version` fields are cosmetic to the build (deps use `workspace:`/`catalog:`;
  pnpm-lock.yaml does not record importer versions) — the true-up is traceability, not a
  dependency change, and never dirties the lockfile.
- Image tagging: CI full SHA, laptop 12-char short SHA — each path self-consistent (known
  gotcha, documented in `deploy.README.md`).
- aws-prod stays parked; all new gates carry the environment through so re-adding it is the
  same matrix/option edit as plan 0560 item 7.

---

## Implementation Task List

- [x] `deploy.yml`: `run_apply` → `mode` (3 choices, default `deploy-only`); add
      `workflow_call` trigger; re-gate steps; concurrency at the caller job per TD6 — 2026-07-27
- [x] `build-images.yml`: `guard` (main-ancestry) + `deploy` (workflow_call) jobs, tag-push
      only — 2026-07-27
- [x] `deploy.sh`: exit-code-gated `db-migrate` one-shot before `up -d` (TD5) — 2026-07-27
- [x] `infra/scripts/do-pre-deploy.sh` + root `package.json` `do-pre-deploy` entry (TD7) — 2026-07-27
- [x] Docs: `deploy.README.md` + `infra/README.md` updated to the new flow + `mode` values — 2026-07-27
- [ ] Verify (user-run — assistant never pushes/tags): (a) manual dispatch `mode=plan-only`
      still previews with no deploy; (b) manual `mode=apply-and-deploy` still works (regression);
      (c) tag a trivial change on main → observe build → guard → auto-deploy → health-verify
      green, containers on the new SHA; (d) tag a non-main commit → build succeeds, guard
      fails, no deploy

## Considered & rejected

- **`workflow_run` chaining** — deploy triggers on build-images completion; rejected: racy
  filtering (tag refs surface as `head_branch`), a second event context to reason about, and
  the run detaches from the tag in the Actions UI. `workflow_call` keeps one run, one context.
- **Merging deploy into build-images.yml** — loses independent dispatch of deploys
  (env-only re-renders, rollbacks) and duplicates the GH-environment gating.
- **Auto-apply on tags (original D7 posture)** — rejected per TD2: a code tag must not be able
  to apply pending infra drift.
- **A new `pnpm do-env-deploy` laptop script** — the session's starting idea; superseded:
  the CI tag path is the primary, and `SKIP_APPLY=1 pnpm do-env-build` already is the laptop
  equivalent (now migrate-gated via TD5 for free).
