# Production DB rebuild — `do-db-rebuild` (DigitalOcean)

## Status
Implemented 2026-07-27 (plan 0590) — `infra/scripts/do-db-rebuild.sh` + shared
`bootstrap-identities.sh`; OQ1 resolved. **Live do-prod verification pending** (user-run —
see the plan's Phase 4). Infrastructure spec (no pages, no GraphQL) — a design file in the
`deployment/` tree, like the other files here.

---

## Purpose

A **user-run** script that drops and recreates the **`fnb` application database** in the
DigitalOcean production environment and rebuilds it to a clean, bootstrapped state — the prod
counterpart of dev's `pnpm db-rebuild`, wrapped in the same operational posture as
`do-env-build` / `do-env-teardown` (secrets file, terraform outputs, typed confirmation,
laptop-run, ssh to the box).

Everything short of the data is preserved: the droplet, images, managed PG **cluster**, the
`zitadel` and `n8n_engine` databases, DNS, TLS state, and the Terraform state all survive. This
is a *data* reset, not an environment rebuild — `terraform destroy` never runs.

**Blast radius (what a run destroys):**
- Every row in the `fnb` DB — tenants, profiles, licenses/subscriptions, messages, locations,
  polls, todos, games, support tickets, the URN registry, `storage.asset` metadata, the
  `notify.notification` send log, and the `n8n.workflow_run` log.
- **Every object in the Spaces assets bucket** (always purged — decision D16: a fresh DB with
  no `storage.asset` rows must not sit next to a bucket of orphaned objects).

**What survives:** ZITADEL identities (all users, the OIDC app config), the n8n engine DB
(workflow definitions, credentials, execution history, the instance owner), cluster-level PG
roles (`zitadel`, `n8n_engine`, `n8n_worker`, `authenticator`, `anon`/`authenticated`/
`service_role`, the app user), and all infrastructure.

**Invariant this creates (found in the first live run, 2026-07-27):** because cluster-level
roles survive the DB drop, **every sqitch role creation must be idempotent** — the deploy
re-runs into a cluster where the roles already exist. `n8n_worker` always was (fnb-n8n
policies, "same lesson as agent_worker"); the migrate entrypoint guards `anon`/`authenticated`/
`service_role`; `authenticator` (fnb-auth `00000000010210_auth_roles_and_grants.sql`) was the
one unguarded straggler — first live rebuild failed on `role "authenticator" already exists`,
fixed with the same `DO $$ IF NOT EXISTS` guard (in-place edit, not a sqitch rework: rework
freezes the original script as the `@tag` copy, which fresh deploys still run first — it
cannot fix a fresh-deploy-only defect). This also fixes the identical latent bug in dev
`pnpm db-rebuild` (dev's container keeps roles across a DB drop; only `env-rebuild`
destroys the volume, which is why first boot never hit it).

---

## Locked decisions (with the why)

| # | Decision | Why |
|---|---|---|
| DR1 | **Scope = the `fnb` DB only** — `zitadel` and `n8n_engine` are never touched | Least destructive rebuild that still resets all app data; sidesteps the `ZITADEL_MASTERKEY` / `N8N_ENCRYPTION_KEY` immutability question entirely (their data lifetimes continue); n8n workflows/credentials/owner need no re-bootstrap |
| DR2 | **Backup is opt-in via `BACKUP=1`** (default: no backup, typed confirmation is the guard) | Matches the `do-env-teardown` posture — prod data is treated as rebuildable; when a safety net is wanted, one flag produces a `pg_dump -Fc` on the box before any DROP, and the script aborts if the dump fails |
| DR3 | **The assets bucket is always purged** | `storage.asset` rows are the only reference to bucket objects; after a DB wipe every object is an orphan. Purging unconditionally keeps DB and bucket consistent — no flag to forget |
| DR4 | **DigitalOcean only (`do-db-rebuild`)** — a sibling of `do-env-build` / `do-env-teardown` | `aws-prod` is not live; an AWS variant is a later, separate script when it is |
| DR5 | **Laptop-run, executes DB work on the box over ssh** (psql via a `postgres:16-alpine` container on `fnb-network`) | The managed PG cluster's trusted-sources firewall admits the droplet/VPC, not the operator's laptop; the box already has the network path and the rendered `.env`. Mirrors how `pg-bootstrap` connects |
| DR6 | **USER-RUN ONLY** — the assistant never executes it | Same rule as `do-env-build`/`do-env-teardown`, and CLAUDE.md's "never rebuild/restart the env yourself" |
| DR7 | **`bootstrap-identities` is factored out of `do-env-build.sh` into a shared script** both callers use | The rebuild must re-create the anchor tenant + site-admin profile; duplicating ~50 lines of curl/jq invites drift. `createHumanUser` is already find-or-create ("already exists" → ok), so re-running it against the surviving ZITADEL user is a verified no-op |

---

## The script — `infra/scripts/do-db-rebuild.sh` (`pnpm do-db-rebuild`)

### Inputs

| Input | Source | Notes |
|---|---|---|
| Secrets | `~/.config/fnb/prod-secrets.env` (override: `FNB_PROD_SECRETS`) | Needs `DIGITALOCEAN_TOKEN`, `SPACES_ACCESS_KEY_ID/SECRET` (tf state backend + bucket purge), and the `SITE_ADMIN_*` / `SITE_TENANT_NAME` / `SETUP_TOKEN` / `N8N_ADMIN_PASSWORD` block (bootstrap-identities) |
| Terraform outputs | `terraform -chdir=infra/terraform/environments/do-prod output -json` | `reserved_ip` (box), `pg_host/port/admin_user/admin_password/admin_db`, `app_pg_user`, `s3_bucket`, `s3_endpoint`, `domain`. **Read-only** — no `apply`, no `destroy` |
| `BACKUP=1` | env flag (default `0`) | pg_dump before dropping (DR2) |
| `TERRAFORM_BIN`, `SSH_OPTS` | env (optional) | Same conventions as the sibling scripts |

Required tools: `jq`, `ssh`, `aws` (bucket purge is unconditional), terraform ≥ 1.6.

### Flow

```
source secrets → tf outputs (read-only) → typed confirm
  → [BACKUP=1: pg_dump on the box — abort on failure]
  → rsync db/ to the box (db-migrate bind-mounts it — a rebuild runs the REPO'S CURRENT
    migrations, not the last deploy's; found in live run #2. Entrypoint/Dockerfile changes
    still need a deploy — they're baked into the db-migrate image)
  → compose stop the fnb-connected services
  → DROP DATABASE fnb WITH (FORCE); CREATE DATABASE fnb OWNER <app_pg_user>
  → re-run one-shots: pg-bootstrap (PostGIS) → db-migrate (13 sqitch packages, SEED_DATA=empty)
  → purge the Spaces assets bucket (always)
  → compose up -d --remove-orphans (full stack) → compose restart n8n
  → health-verify.sh
  → bootstrap-identities (site admin re-created in fnb; ZITADEL + n8n calls no-op)
```

Step detail:

1. **Typed confirmation** — mirrors `do-env-teardown`: print the blast radius (app data + the
   assets bucket; ZITADEL/n8n survive), then require the literal string **`rebuild do-prod fnb`**.
   Anything else aborts with no changes.

2. **Optional backup (`BACKUP=1`)** — on the box, via
   `docker run --rm --network fnb-network -v /opt/fnb/backups:/backups postgres:16-alpine pg_dump -Fc`
   against the managed cluster (`sslmode=require`, admin credentials), writing
   `/opt/fnb/backups/fnb-<UTC timestamp>.dump`. Print the path and a one-line `pg_restore` hint.
   A non-zero dump exit **aborts the rebuild before any destructive step**.

3. **Stop the fnb-connected services** so the app connection pools drain:
   `auth-app home-app tenant-app msg-app game-app graphql-api-app storage-app n8n`
   (n8n included — workflow executions connect to `fnb` as `n8n_worker`). `zitadel`, `clamav`,
   and `caddy` stay up — none of them touch `fnb`, and Caddy keeps serving TLS (requests to
   stopped apps 502 for the duration; acceptable for a data-wipe operation).
   Compose invocation is the `deploy.sh` one:
   `docker compose -f /opt/fnb/infra/compose/docker-compose.prod.yml --env-file /opt/fnb/infra/compose/.env …`

4. **Drop + recreate** — on the box, psql via `postgres:16-alpine` on `fnb-network` as the
   managed admin (`doadmin`) connected to the maintenance DB (`defaultdb`):
   ```sql
   DROP DATABASE fnb WITH (FORCE);          -- PG ≥ 13: terminates any straggler backends
   CREATE DATABASE fnb OWNER <app_pg_user>; -- owner = the terraform-created app user, so sqitch can CREATE SCHEMA
   ```
   The DB name comes from the box `.env` (`POSTGRES_DB`) / tf outputs — not hardcoded, same rule
   as dev `db-rebuild.ts`.

5. **Re-run the one-shots** — `docker compose up db-migrate` (its `depends_on` runs
   `pg-bootstrap` to completion first). `pg-bootstrap` is idempotent: roles/DBs already exist,
   and it re-applies `CREATE EXTENSION IF NOT EXISTS postgis` to the fresh `fnb`. `db-migrate`
   deploys all 13 sqitch packages with `SEED_DATA=empty` (prod never seeds the dev fixture) and
   re-creates the in-DB `n8n_worker` grants (role survives at cluster level;
   `N8N_WORKER_PG_PASSWORD` comes from the box `.env`). Fail loudly on a non-zero exit —
   **the script must wait for the one-shots and check their exit codes**, not fire-and-forget.

6. **Purge the assets bucket** — unconditional (DR3). Reuse `do-env-teardown`'s versioned-purge
   sequence (`aws s3 rm --recursive` + delete-markers/version sweep via `s3api
   list-object-versions`) against `s3_endpoint`/`s3_bucket`. Factor it into a shared helper or
   duplicate deliberately — implementor's call, but teardown and rebuild must not drift apart.

7. **Restart the stack** — `compose up -d --remove-orphans`, then `compose restart n8n` (same
   stale-webhook-route guard as `deploy.sh` — cheap and safe; state of record is the DB).

8. **Verify + re-bootstrap** — `DOMAIN=<domain> health-verify.sh`, then the shared
   `bootstrap-identities` step (DR7):
   - `POST /auth/api/setup/initialize` — the anchor is gone, so the soft gate passes;
     `createHumanUser` finds the surviving ZITADEL user ("already exists" → `{ok, created:false}`);
     `initialize_anchor` re-creates the anchor tenant + site-admin profile in the fresh DB.
   - `POST https://n8n.<domain>/rest/owner/setup` — owner survives in `n8n_engine` → the
     endpoint is de-registered → 404 → handled no-op. Kept for symmetry with `do-env-build`.

### Registration

- Root `package.json`: `"do-db-rebuild": "bash infra/scripts/do-db-rebuild.sh"` (next to
  `do-env-build` / `do-env-teardown`).
- `infra/README.md`: add the script to the Layout tree + a short "DB rebuild" runbook entry
  (blast radius, `BACKUP=1`, user-run-only).

---

## Consequences to document in the script header (operator-facing)

1. **Non-site-admin ZITADEL users are orphaned.** They still exist in ZITADEL but their
   `app.profile` rows (and invitations) are gone — they cannot meaningfully log in and must be
   re-invited. The `invite-user` workflow handles this: its conflict branch re-invites an
   existing ZITADEL user via a `password_reset` link (OQ1, resolved below).
2. **Live sessions die gracefully.** Session cookies reference profiles that no longer exist;
   the claims fetch fails and users land back at login. localStorage claim mirrors go stale the
   same way. No action needed.
3. **The `n8n.workflow_run` log is wiped** (it lives in `fnb`); n8n's own execution history in
   `n8n_engine` survives. The two histories will disagree about the past — expected.
4. **Terraform drift is nil by design**: the recreated DB has the same name (`fnb`) and DO's
   API tracks cluster DBs by name, so `digitalocean_database_db` reads back clean. Verified as
   an implementation task (task list, Phase 9).

---

## Open Questions

- [x] **OQ1 — re-inviting orphaned users** — **resolved 2026-07-27, no code allowance needed.**
      The `invite-user` workflow's "Invite Via ZITADEL" code node (`n8n/workflows/invite-user.json`)
      explicitly handles the conflict case: on 409/"already exists" it searches the user by
      email and mints a `password_reset` link (the re-invite / email #2 path, confirmed
      2026-07-22 in the workflow itself). Orphaned pre-rebuild users are re-invitable as-is.

## Considered & rejected

- **Full data re-init (drop zitadel + n8n_engine too)** — rejected for the default: it forces
  identity + n8n owner/credential re-bootstrap and touches the immutable-key story for no gain
  when the goal is "reset app data". `do-env-teardown` + `do-env-build` already covers the
  scorched-earth case.
- **Scope-widening flag (`REBUILD_SCOPE=fnb|fnb+n8n|all`)** — rejected with the above: one
  script, one blast radius, one typed confirmation string. Optionality on destructive scope is
  a foot-gun.
- **Mandatory backup** — rejected (DR2): the environment's posture is
  rebuildable-from-scratch; a forced dump slows the common case. `BACKUP=1` is the safety net.
- **Leaving the bucket / opt-in purge** — rejected (DR3): orphaned objects are invisible cost
  and a consistency lie; the bucket is always purged with the data that referenced it.
- **Running psql from the laptop against managed PG** — rejected (DR5): requires opening the
  cluster's trusted-sources firewall to the operator's IP; the box path already exists.
- **Cloud-agnostic `ENVIRONMENT=do-prod|aws-prod` script now** — rejected (DR4): aws-prod
  isn't live; speculative generality against an untested target.
