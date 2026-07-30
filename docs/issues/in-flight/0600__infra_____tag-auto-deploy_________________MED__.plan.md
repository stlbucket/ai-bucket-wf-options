# Plan: Tag auto-deploy — `v*` tag on main → do-prod, zero clicks

> **Execution Directive:** Implement this plan via `/fnb-stack-implementor <this-file>`.
> The authoritative spec is `docs/specs/deployment/tag-auto-deploy.md` (decisions TD1–TD6)
> + `docs/specs/deployment/README.md` D15–D17 / Phase 10 — this plan sequences it and does
> not restate it (R21). **The assistant never runs git, never tags, never dispatches workflows,
> and never deploys** — Phase 5 verification is user-run with read-only assistant checks.

**Severity: MED** (release tooling; removes a manual gate deliberately, with guards) ·
Workstream: infra/deployment · Planned: 2026-07-27 · Spec status: Draft, no `[FILL IN]`s.

## Context

Today (`deploy.README.md`): a `v*` tag auto-builds images (`build-images.yml`, full-SHA tag),
but the deploy is a manual `deploy.yml` dispatch. This change chains deploy after the tag build
via `workflow_call` (TD1), restricted to commits on `main` (TD4), never applying terraform on
the auto path (TD2 — outputs only), with an exit-code-gated `db-migrate` before app cutover in
`deploy.sh` (TD5 — benefits CI and laptop paths). Manual dispatch stays for infra applies,
plan previews, rollbacks, and non-main ships.

Key facts verified while speccing (2026-07-27):
- `build-images.yml` fires `on: push: tags: ['v*']` and builds with
  `IMAGE_TAG: ${{ github.sha }}` (line 78) — deploy must pass the identical value.
- `deploy.yml` steps are all gated on `inputs.run_apply` (lines 63–167); the export-outputs
  step (lines 73–97) is pure `terraform output -json` — it works without an apply (`init`
  already runs unconditionally at line 62).
- Workflow-level `concurrency` in a *called* reusable workflow does not govern the caller's
  run, but concurrency **groups are repo-scoped** — a job-level group on the caller that
  matches `deploy-do-prod` serializes tag deploys against dispatch deploys (TD6).
- The gated migrate invocation `compose up --exit-code-from db-migrate db-migrate` is already
  proven on the box by `do-db-rebuild.sh:148`; `db-migrate` is `build:`-based
  (`docker-compose.prod.yml:49-71`), so `compose pull` skips it and `up` builds it.
- `deploy.sh` cutover today: `pull` → `up -d` → `restart n8n` (lines 77–86); the rsync of the
  current `db/` tree (line 53-55) already precedes it.
- aws-prod is parked (plan 0560 item 7) — every new gate carries `environment` through so
  re-adding it is the same matrix/option edit.

---

## Phase 1 — `deploy.yml`: `mode` input + `workflow_call` trigger

- [x] Replace dispatch input `run_apply` (boolean, lines 18–22) with `mode`
      (`type: choice`, options `deploy-only | apply-and-deploy | plan-only`, default
      `deploy-only`). Old semantics map: `run_apply=true` → `apply-and-deploy`,
      `run_apply=false` → `plan-only`.
- [x] Add `on: workflow_call` with inputs `environment` (string, required), `image_tag`
      (string, required), `mode` (string, default `deploy-only`) — same `inputs.*` context, so
      existing expressions keep working. Callers pass `secrets: inherit`.
- [x] Re-gate steps: apply (line 63) → `inputs.mode == 'apply-and-deploy'`; plan preview
      (line 68) → `inputs.mode == 'plan-only'`; export outputs / render `.env` / doctl setup /
      open-ssh / deploy / health-verify (lines 73–167) → `inputs.mode != 'plan-only'`
      (compound conditions keep their `environment == 'do-prod'` halves). Close-ssh
      (`always()`, line 169) unchanged.
- [x] Concurrency (TD6): keep the workflow-level group `deploy-${{ inputs.environment }}`
      (binds dispatch runs); the caller-side group lands in Phase 2.
- [x] Update the two header comments (lines 1–3) — no longer "always manual".

## Phase 2 — `build-images.yml`: guard + chained deploy (tag pushes only)

- [x] `guard` job (`if: github.event_name == 'push'`): `actions/checkout` with
      `fetch-depth: 0`, then `git merge-base --is-ancestor "$GITHUB_SHA" origin/main` —
      fail with a clear message when the tagged commit is not on main (images stay pushed;
      no deploy). TD4.
- [x] `deploy` job (`if: github.event_name == 'push'`, `needs: [build, guard]`):
      `uses: ./.github/workflows/deploy.yml` with `environment: do-prod`,
      `image_tag: ${{ github.sha }}`, `mode: deploy-only` (TD2), `secrets: inherit`; job-level
      `concurrency: { group: deploy-do-prod, cancel-in-progress: false }` (TD6 — repo-scoped
      group matches the dispatch workflow's group).
- [x] Manual `workflow_dispatch` builds must not chain (both jobs event-gated) — verify the
      existing dispatch skip-gate logic (lines 34–43) is untouched.

## Phase 3 — `deploy.sh`: exit-code-gated db-migrate before cutover (TD5)

- [x] Between `$COMPOSE pull` and `$COMPOSE up -d --remove-orphans` (lines 79–80), insert
      `ssh_box "$COMPOSE up --exit-code-from db-migrate db-migrate"` with a comment stating
      the invariant: a failed migration aborts here, old images keep running against the old
      schema. `restart n8n` guard (line 86) unchanged.
- [x] Note in the header comment that `do-env-build`/CI both inherit the gate.

## Phase 3b — `infra/scripts/do-pre-deploy.sh` + root script entry (TD7/D18)

- [x] Script (USER-RUN ONLY header — it runs git; assistant never executes it), flow per spec
      §4: fetch → guards (on `main`, clean tree, not behind origin; ahead OK) → version from
      latest `v*` tag (`patch` default, `minor|major` arg) → y/N confirm (`v<cur> → v<next>`)
      → `pnpm install --frozen-lockfile` → `pnpm build` (`SKIP_BUILD=1` skips) → true-up
      root + `apps/*` + `packages/*` `package.json` versions (node JSON rewrite, 2-space +
      trailing newline) → `git add <touched> && git commit -m v<next> && git tag v<next>`
      (lightweight) → print `git push --atomic origin main v<next>` + expected pipeline.
- [x] Root `package.json`: `"do-pre-deploy": "bash infra/scripts/do-pre-deploy.sh"`.
- [x] Verified fact: 18 workspace manifests (7 apps + 11 packages), 11 with a `version` field
      (`0.0.1`), root has none — the rewrite adds the field where missing; lockfile does not
      record importer versions, so the true-up never dirties it.

## Phase 4 — Docs

- [x] `deploy.README.md`: lead with the zero-click flow (tag on main → build → guard →
      deploy); move dispatch to "infra changes, previews, rollbacks, non-main ships" with the
      new `mode` values; rollback becomes `-f mode=deploy-only -f image_tag=<previous-sha>`;
      update the "pipeline in one line" and any `run_apply` mention; keep the gotchas.
- [x] `infra/README.md` runbook: note the auto path and that `deploy.sh` now hard-gates on
      db-migrate.
- [x] `docs/specs/deployment/README.md` + `tag-auto-deploy.md`: tick Phase 10 boxes /
      status lines as work lands.

## Phase 5 — Verification

- [x] Assistant (read-only): `bash -n` on `deploy.sh` + `do-pre-deploy.sh`; `actionlint` on
      both workflows if available (else careful YAML review); confirm no other caller of
      `deploy.yml` or consumer of `run_apply` exists (grep). No git-reading commands — the
      version-calc path is user-verified.
- [ ] User-run: (a) dispatch `mode=plan-only` → plan prints, nothing deploys; (b) dispatch
      `mode=apply-and-deploy` regression; (c) `pnpm do-pre-deploy` on main → confirm bump +
      true-up commit + tag → `git push --atomic origin main v<next>` → build → guard →
      auto-deploy → health-verify green, containers on the new SHA; (d) tag a non-main commit
      → build succeeds, guard fails, no deploy.
