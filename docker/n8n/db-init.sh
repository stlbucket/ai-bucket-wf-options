#!/bin/sh
# n8n-db-init one-shot: create the n8n_engine database + owner login role in the existing
# postgis cluster (spec: .claude/specs/n8n-parallel-engine/infrastructure.md). Idempotent on
# every boot — strictly more robust than a fresh-volume-only /docker-entrypoint-initdb.d
# script. sqitch and PostGraphile never see n8n_engine; the n8n_worker role in
# function_bucket is NOT created here (it belongs to the db/fnb-n8n sqitch package).
set -e

: "${N8N_ENGINE_DB_PASSWORD:?N8N_ENGINE_DB_PASSWORD is required (set it in .env)}"

psql -v ON_ERROR_STOP=1 <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'n8n_engine') THEN
    CREATE ROLE n8n_engine LOGIN;
  END IF;
END $$;
SQL

# ALTER outside DO so the password arrives via a psql var (no interpolation inside $$ bodies).
# Fed via stdin, NOT -c: psql only substitutes :'var' in stdin/-f input, never in -c strings.
echo "ALTER ROLE n8n_engine PASSWORD :'pw';" | \
  psql -v ON_ERROR_STOP=1 -v pw="$N8N_ENGINE_DB_PASSWORD"

# CREATE DATABASE cannot run inside DO — guard with an existence probe
if ! psql -tAc "SELECT 1 FROM pg_database WHERE datname = 'n8n_engine'" | grep -q 1; then
  psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE n8n_engine OWNER n8n_engine"
fi

echo "n8n_engine database ready"
