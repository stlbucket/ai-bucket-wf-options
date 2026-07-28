# Plan: Prod DB rebuild script — `do-db-rebuild` (fnb-only data reset, DO)

> **Execution Directive:** Implement this plan via `/fnb-stack-implementor <this-file>`.
> The authoritative spec is `.claude/specs/deployment/prod-db-rebuild.md` (decisions DR1–DR7)
> + `.claude/specs/deployment/README.md` D14 / Phase 9 — this plan sequences it and does not
> restate it (R21). **The script itself is USER-RUN ONLY (DR6)** — the assistant never executes
> `do-db-rebuild`, `do-env-build`, or `do-env-teardown`, never runs git, and never
> rebuilds/restarts any environment (memory `feedback_rebuild_ask_user`); Phase 4 verification
> is user-run with read-only assistant checks.

**Severity: MED** (operational tooling; destructive by design but user-gated) · Workstream:
infra/deployment · Planned: 2026-07-27 · Spec status: Draft, no `[FILL IN]`s; OQ1 deferred
non-blocking (verified read-only in Phase 4).

## Context

Dev has `pnpm db-rebuild` (drop + recreate + sqitch). Prod (`do-prod`) has only scorched earth
(`do-env-teardown` + `do-env-build`). This adds the middle tool: a user-run script that resets
the **`fnb` DB only** — drop `WITH (FORCE)`, recreate owned by `app_pg_user`, re-run the
`pg-bootstrap`/`db-migrate` one-shots (SEED_DATA=empty), always purge the Spaces assets bucket,
restart the stack, re-run health-verify + bootstrap-identities. ZITADEL, `n8n_engine`,
cluster roles, and all Terraform infra survive; terraform is read (`output -json`) but never
applied/destroyed.

Key facts verified while speccing (2026-07-27):
- `createHumanUser` (auth-app `server/utils/zitadel-admin.ts:142`) is find-or-create —
  "already exists" → `{ ok: true, created: false }` — so re-POSTing `/auth/api/setup/initialize`
  after the wipe cleanly re-creates the anchor tenant + site-admin profile against the
  surviving ZITADEL user (soft gate `anchorExists()` passes on a fresh DB).
- `pg-bootstrap.sh` is idempotent (guarded CREATEs, never alters passwords) and re-applies
  PostGIS to the app DB — safe to re-run against the recreated `fnb`.
- The n8n owner-setup call 404-no-ops when the owner exists (`do-env-build.sh:145`) —
  `n8n_engine` survives, so it no-ops on every rebuild.
- Compose invocation + `/opt/fnb` layout come from `deploy.sh` (`REMOTE_DIR`, `--env-file`);
  the versioned bucket purge comes from `do-env-teardown.sh:40-55`.
- fnb-connected services to stop: `auth-app home-app tenant-app msg-app game-app
  graphql-api-app storage-app n8n` (compose names verified in
  `infra/compose/docker-compose.prod.yml`).

---

## Phase 1 — Extract shared `bootstrap-identities.sh` (DR7)

- [x] Create `infra/scripts/bootstrap-identities.sh` from `do-env-build.sh` step 6
      (lines ~105–152): the `SITE_ADMIN_*`/`SITE_TENANT_NAME`/`SETUP_TOKEN`/`N8N_ADMIN_PASSWORD`
      `:?` guards, the two curl/jq POSTs (`/auth/api/setup/initialize` 200/409;
      `n8n.<domain>/rest/owner/setup` 2xx/404-or-"already" no-op), fail-loud otherwise.
      Contract: expects `DOMAIN` + the secret vars in the environment (caller sources the
      secrets file); no secrets-file parsing of its own.
- [x] Rewire `do-env-build.sh` step 6 to invoke it — **behavior unchanged** (same output lines,
      same failure modes). Header comment notes the second caller.

## Phase 2 — `infra/scripts/do-db-rebuild.sh`

- [x] Preamble à la siblings: `set -euo pipefail`; USER-RUN-ONLY + blast-radius header comment;
      tool checks (`jq ssh aws`); source `${FNB_PROD_SECRETS:-~/.config/fnb/prod-secrets.env}`;
      `DIGITALOCEAN_TOKEN`/`SPACES_*` guards; `TERRAFORM_BIN` resolution (≥ 1.6).
- [x] Read-only tf outputs (`do-prod`): `reserved_ip`, `pg_host/port/admin_user/admin_password/
      admin_db`, `app_pg_user`, `s3_bucket`, `s3_endpoint`, `domain`; empty-output guard.
      **No `terraform apply`/`destroy` anywhere in this script.**
- [x] Typed confirmation: print blast radius (all fnb data + full bucket purge; ZITADEL + n8n
      survive), require literal `rebuild do-prod fnb`, abort otherwise with no changes.
- [x] `BACKUP=1` (default 0): on the box, `docker run --rm --network fnb-network
      -v /opt/fnb/backups:/backups postgres:16-alpine pg_dump -Fc` (admin creds,
      `sslmode=require`) → `/opt/fnb/backups/fnb-<UTC-ts>.dump`; print path + `pg_restore`
      hint; **abort the whole run on non-zero before any destructive step**.
- [x] Stop fnb-connected services (list above) via the `deploy.sh`-style compose invocation.
- [x] Drop + recreate on the box (psql via `postgres:16-alpine` on `fnb-network`, admin →
      maintenance DB): `DROP DATABASE <db> WITH (FORCE);` then
      `CREATE DATABASE <db> OWNER <app_pg_user>;` — DB name from the box `.env` `POSTGRES_DB`
      (or tf output), never hardcoded (dev `db-rebuild.ts` rule).
- [x] One-shots: `compose up db-migrate` (pulls `pg-bootstrap` via `depends_on`), **foreground,
      exit codes checked** — a failed migrate aborts before the bucket purge.
- [x] Unconditional bucket purge (DR3): reuse the teardown versioned sweep (`s3 rm --recursive`
      + `list-object-versions` delete loop) against `s3_endpoint`/`s3_bucket`. Keep the two
      scripts drift-free — shared helper or a deliberate, commented duplicate (implementor's
      call; note the twin in both).
- [x] Restart: `compose up -d --remove-orphans` + `compose restart n8n` (stale-webhook guard,
      same as `deploy.sh:86`).
- [x] Verify + re-bootstrap: `DOMAIN=<domain> health-verify.sh` then
      `bootstrap-identities.sh` (Phase 1).

## Phase 3 — Registration + docs

- [x] Root `package.json`: `"do-db-rebuild": "bash infra/scripts/do-db-rebuild.sh"` (beside
      the other two `do-*` scripts).
- [x] `infra/README.md`: script in the Layout tree + a "DB rebuild" runbook entry (blast
      radius, `BACKUP=1`, user-run-only, what survives).
- [x] Spec sync: check off Phase 9 boxes in `.claude/specs/deployment/README.md` as they land.

## Phase 4 — Verification

Read-only (assistant):
- [x] `bash -n` both new/changed scripts (+ `shellcheck` if installed).
- [x] Diff-review `do-env-build.sh` step 6 → identical behavior through the new shared script.
- [x] **OQ1**: read `n8n/workflows/invite-user.json` — does its ZITADEL create-user step
      tolerate an already-existing user (find-or-create) so orphaned pre-rebuild users can be
      re-invited? Record the answer in `prod-db-rebuild.md` (check OQ1 off, or spawn a new
      `identified/` item for the workflow code allowance).

User-run (live do-prod; assistant only reviews the pasted output):
- [ ] `pnpm do-db-rebuild` completes end-to-end; then `terraform plan` shows **no drift** on
      `digitalocean_database_db`; site admin re-login works; an upload scans+promotes; a game
      plays. Re-run `do-env-build` afterwards → all no-ops (regression check on Phase 1).

## Execution notes (2026-07-27)

- Phases 1–3 + read-only Phase 4 done. `shellcheck` not installed locally — `bash -n` on all
  three scripts + a stubbed-docker dry run of the remote drop/recreate heredoc instead
  (password with spaces/`$` survives quoting; correct SQL emitted).
- **Bug caught in review:** the remote heredocs originally `source`d the box `.env` — fatal,
  since compose-env-file syntax allows unquoted spaces (`DEPLOY_PACKAGES=fnb-auth fnb-app …`).
  Replaced with a per-key `envget()` (sed, whole rest of line after the first `=`).
- `app_pg_user` **is** `doadmin` today (`modules/digitalocean/outputs.tf` — scoped-role
  downgrade tracked in `superuser-database-url.plan.md`), so `CREATE DATABASE … OWNER
  $APP_PG_USER` is exact parity with first boot and stays correct after the downgrade.
- **OQ1 resolved — no code allowance**: `invite-user.json`'s "Invite Via ZITADEL" node already
  branches on 409/"already exists" → user search by email → `password_reset` link (email #2).
  Spec updated (OQ1 checked, consequence #1 reworded).
- `DIGITALOCEAN_TOKEN` deliberately not required by the script — `terraform output` is
  state-only (Spaces backend creds suffice); no provider call, no registry work.
- **First live run failed (2026-07-27)** at sqitch `fnb-auth:00000000010210` —
  `role "authenticator" already exists`. Root cause: cluster-level roles survive `DROP
  DATABASE`; that deploy script's `CREATE ROLE authenticator` was the only unguarded role
  creation in the chain (`n8n_worker` guarded since inception; entrypoint guards the
  anon/authenticated/service_role trio). Fixed with the same `DO $$ IF NOT EXISTS` guard,
  **in-place** — a sqitch rework cannot fix this class of bug (the frozen `@tag` copy of the
  original script still runs unguarded on every fresh deploy). Also fixes the identical latent
  bug in dev `pnpm db-rebuild`. The failed run's half-reverted fnb DB needs no manual repair —
  the rebuild's `DROP DATABASE … WITH (FORCE)` clears it on the next run. Swept all deploy
  scripts for other cluster-level statements: none remain.
- **Second live run failed identically (2026-07-27)** — the error's line number (`…10210….sql:6`)
  revealed the box ran the STALE pre-fix script: db-migrate bind-mounts `/opt/fnb/db`, shipped
  only by `deploy.sh`, and the rebuild never re-synced it. Fix: do-db-rebuild now rsyncs the
  repo `db/` tree to the box (step 2a, same flags as deploy.sh) before running the one-shots —
  a rebuild deploys the repo's current migrations by design. `rsync` added to required tools.
- Adjacent tooling added on user request (2026-07-27, same session): `pnpm do-db-psql`
  (`infra/scripts/do-db-psql.sh`) — interactive psql into prod fnb via the box (`ssh -t`,
  creds from the box .env via `envget`, `DB=` override validated `[A-Za-z0-9_]*`). Dry-tested
  with stubbed ssh/terraform/docker: default + `DB=zitadel` + injection-rejection all pass.
