# Plan: Managed-PG TLS `verify-full` with the mounted DO CA

> **Execution Directive:** Work this plan via `/fnb-stack-implementor <this-file>`, **in a deploy
> window** — every touchpoint below changes how prod containers connect to the managed cluster and
> can only be proven by a real `deploy.sh` + `health-verify.sh` run (user-run). Do not land these
> edits piecemeal outside a window; a partial flip breaks every service's DB connection at the
> next `compose up`.

**Severity: MED** · Workstream: security/infra · Planned: 2026-07-26 · Spun out of plan 0560 item 6

## Context

do-prod connects to DO Managed PG **encrypted but unverified**:

- Apps (node-postgres): `DATABASE_URL=…?uselibpqcompat=true&sslmode=require` — libpq-compat
  "require" = encrypt without cert verification (`infra/env/.env.prod.tpl` comment).
- n8n engine + worker: `DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED=false` /
  `N8N_WORKER_PG_ALLOW_UNAUTHORIZED_CERTS=true` (`infra/compose/docker-compose.prod.yml`).
- ZITADEL: `…_SSL_MODE: require` (user + admin connections).
- sqitch/psql (`PG_URL`/`DB_URL`, pg-bootstrap): real libpq `sslmode=require` — encrypted, no CA
  pinning.

The fix is one artifact + N consumers: fetch the cluster CA from DO, ship it to the box, mount it
read-only into every PG-connecting container, and flip each connection to verify(-full).

## Task list

### 1. Terraform — export the cluster CA (DO module)
- [ ] `infra/terraform/modules/digitalocean/main.tf`: add
      `data "digitalocean_database_ca" "pg" { cluster_id = digitalocean_database_cluster.pg.id }`.
- [ ] `modules/digitalocean/outputs.tf`: `output "pg_ca_cert" { value = data.digitalocean_database_ca.pg.certificate, sensitive = true }`
      (sensitive only to keep it out of human-readable plan noise — it is not a secret).
- [ ] `environments/do-prod/outputs.tf`: pass-through output.
- [ ] Provider 2.96.0 (lock file) supports the data source; no constraint bump needed.

### 2. Ship the CA to the box
- [ ] `infra/scripts/do-env-build.sh` + `.github/workflows/deploy.yml`: after apply, write
      `terraform output -raw pg_ca_cert > <tmp>/pg-ca.crt` and hand it to deploy.sh (new
      optional `PG_CA_FILE` env, mirroring `ENV_FILE`).
- [ ] `infra/scripts/deploy.sh`: scp `PG_CA_FILE` → `$REMOTE_DIR/infra/compose/pg-ca.crt`
      (world-readable is fine — it's a public CA cert, and n8n runs as uid 1000).

### 3. Compose — mount + flip each consumer (`infra/compose/docker-compose.prod.yml`)
All mounts: `./pg-ca.crt:/certs/pg-ca.crt:ro` (path relative to the compose file).
- [ ] **7 app services** (auth/home/tenant/msg/game/graphql-api/storage): mount; `DATABASE_URL`
      (in `.env.prod.tpl`) → `…?uselibpqcompat=true&sslmode=verify-full&sslrootcert=/certs/pg-ca.crt`
      (node-postgres honors sslrootcert under libpq-compat).
- [ ] **db-migrate**: mount; `PG_URL`/`DB_URL` → `sslmode=verify-full&sslrootcert=/certs/pg-ca.crt`.
- [ ] **pg-bootstrap**: mount; add `PGSSLMODE: verify-full`, `PGSSLROOTCERT: /certs/pg-ca.crt`.
- [ ] **zitadel**: mount; `ZITADEL_DATABASE_POSTGRES_USER_SSL_MODE: verify-full` +
      `…_USER_SSL_ROOTCERT: /certs/pg-ca.crt`, same for `…_ADMIN_SSL_*`. **Confirm exact env key
      spelling (`ROOTCERT` vs `ROOT_CERT`) via skill `zitadel-expert`** before the window.
- [ ] **n8n + n8n-import**: mount; `DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED: "true"` + the CA env
      (**confirm `DB_POSTGRESDB_SSL_CA` semantics — file path vs PEM contents — via skill
      `n8n-cli`/docs**); worker credential: `N8N_WORKER_PG_ALLOW_UNAUTHORIZED_CERTS: "false"` —
      check `n8n/scripts/render-credentials.mjs` + the postgres credential template for CA
      support (if the credential can't take a CA, `ssl: require` + engine-level CA is the
      fallback posture; document whichever lands).
- [ ] `.env.prod.tpl`: update the `uselibpqcompat` comment block (it documents the encrypt-only
      posture and points here).

### 4. Verify (the deploy window)
- [ ] `pnpm do-env-build` (or deploy.yml) — USER-RUN.
- [ ] All one-shots green (pg-bootstrap, db-migrate, zitadel-seed, n8n-import); apps healthy;
      login end-to-end; one n8n execution (any scheduled workflow) green.
- [ ] Negative check: hostname verification is real — the URLs use the cluster's
      **private-network hostname**; confirm it appears in the cert SAN (DO issues certs covering
      both public and private hostnames — if not, `verify-ca` is the correct posture, not
      `verify-full`; record the outcome here).

### 5. aws-prod (later — env never provisioned)
- [ ] RDS equivalent: download the regional RDS CA bundle (rds-ca-rsa2048-g1) in the aws module
      (or bake into cloud-init), same mount + URL flip. Do together with the first aws-prod stand-up
      (plan 0560 item 7).

## Rollback
Revert the `.env`/compose changes and `compose up -d` — the encrypt-only URLs keep working
regardless of whether the CA file is present.

## Out of scope
- App-role downgrade off `doadmin` — plan `0040__security__superuser-database-url`.
- Dev compose (local PG, no TLS) — unchanged.
