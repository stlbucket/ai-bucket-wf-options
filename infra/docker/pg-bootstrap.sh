#!/bin/sh
# Managed-Postgres bootstrap (spec production-runtime.md §7): create the zitadel + n8n_engine
# databases + owner login roles + PostGIS on the app DB. Idempotent one-shot, run against the
# managed cluster's ADMIN connection BEFORE db-migrate / zitadel / n8n start. Replaces the dev
# container init scripts (docker/db-init/10-create-zitadel-db.sh + docker/n8n/db-init.sh), which
# don't exist on managed PG (no /docker-entrypoint-initdb.d hook; admin is not a true superuser).
#
# Cloud-agnostic AND safe on DO, where Terraform also creates these DBs/roles natively: every CREATE
# is guarded, and we NEVER ALTER an existing role's password (the managed/TF-set password wins). On
# AWS this one-shot IS the whole bootstrap (spec env-aws §2 / OQ5). psql reads PG* from env; the
# ADMIN connection is the managed default/maintenance DB (PGDATABASE); PostGIS runs against APP_DB.
set -eu

: "${PGHOST:?PGHOST (managed cluster host)}"
: "${PGPORT:?PGPORT (managed cluster port)}"
: "${PGUSER:?PGUSER (managed admin, e.g. doadmin / the RDS master user)}"
: "${PGPASSWORD:?PGPASSWORD (managed admin password)}"
: "${PGDATABASE:?PGDATABASE (admin/maintenance db to connect to, e.g. defaultdb / postgres)}"
: "${APP_DB:?APP_DB (the app database, e.g. fnb)}"
: "${ZITADEL_DB_PASSWORD:?}"
: "${N8N_ENGINE_DB_PASSWORD:?}"
# Managed PG requires TLS.
export PGSSLMODE="${PGSSLMODE:-require}"

echo "==> pg-bootstrap: waiting for managed Postgres (TCP+TLS)…"
for i in $(seq 1 30); do
  if psql -tAc 'select 1' >/dev/null 2>&1; then echo "    up"; break; fi
  [ "$i" -eq 30 ] && { echo "    not reachable after 60s" >&2; exit 1; }
  sleep 2
done

ensure_role() {   # $1 role, $2 password — create only if missing; never touch an existing password
  role="$1"; pw="$2"
  if ! psql -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$role'" | grep -q 1; then
    # :'var' interpolation only works via stdin/-f, never -c
    echo "CREATE ROLE $role LOGIN PASSWORD :'pw';" | psql -v ON_ERROR_STOP=1 -v pw="$pw"
    echo "    role '$role' created"
  else
    echo "    role '$role' already exists (leaving password as-is)"
  fi
}

ensure_db() {     # $1 db, $2 owner — CREATE DATABASE can't run in a txn/DO, guard with a probe
  db="$1"; owner="$2"
  if ! psql -tAc "SELECT 1 FROM pg_database WHERE datname = '$db'" | grep -q 1; then
    psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE $db OWNER $owner"
    echo "    database '$db' created (owner $owner)"
  else
    echo "    database '$db' already exists"
  fi
}

echo "==> pg-bootstrap: roles"
ensure_role zitadel    "$ZITADEL_DB_PASSWORD"
ensure_role n8n_engine "$N8N_ENGINE_DB_PASSWORD"

echo "==> pg-bootstrap: databases"
ensure_db zitadel    zitadel
ensure_db n8n_engine n8n_engine

echo "==> pg-bootstrap: PostGIS on the app DB ($APP_DB)"
PGDATABASE="$APP_DB" psql -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS postgis"

echo "==> pg-bootstrap: done"
