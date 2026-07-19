#!/usr/bin/env bash
set -euo pipefail

# No fallbacks — these must come from .env via docker-compose. Fail loudly if unset.
DB_URL="${DB_URL:?DB_URL is required (set it in .env)}"
PG_URL="${PG_URL:?PG_URL is required (set it in .env)}"
: "${DEPLOY_PACKAGES:?DEPLOY_PACKAGES is required (set it in .env)}"
# fnb-agent's policies change creates the agent_worker login role with this password
# (psql var :'agent_worker_password' — passed to every package deploy; unused vars are harmless).
: "${AGENT_WORKER_PG_PASSWORD:?AGENT_WORKER_PG_PASSWORD is required (set it in .env)}"
# fnb-n8n's policies change creates the n8n_worker login role the same way.
: "${N8N_WORKER_PG_PASSWORD:?N8N_WORKER_PG_PASSWORD is required (set it in .env)}"

# Belt-and-braces on top of the compose healthcheck: on a fresh volume postgres restarts once
# after initdb, so wait until a real TCP connection works before doing anything.
echo "==> Waiting for postgres (TCP)..."
for i in $(seq 1 30); do
  if psql "$PG_URL" -c 'select 1' >/dev/null 2>&1; then
    echo "    postgres is up"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "    postgres not reachable after 60s" >&2
    exit 1
  fi
  sleep 2
done

echo "==> Creating required roles..."
for role in anon authenticated service_role; do
  psql "$PG_URL" -c \
    "DO \$\$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$role') THEN
         CREATE ROLE $role;
       END IF;
     END \$\$;"
  echo "    role '$role' ensured"
done

echo "==> Running sqitch migrations..."
for pkg in $DEPLOY_PACKAGES; do
  echo "  --> deploying $pkg"
  sqitch deploy --chdir "/db/$pkg" --set agent_worker_password="$AGENT_WORKER_PG_PASSWORD" --set n8n_worker_password="$N8N_WORKER_PG_PASSWORD" "$DB_URL"
done

echo "==> All migrations complete."

echo "==> Running seed..."
psql "$PG_URL" -f /db/seed.sql
echo "==> Seed complete."
# echo "==> Adding seed workflows..."
# psql "$PG_URL" -f apps/graphql-api-app/server/lib/worker-task-handlers/wf-exerciser/load-workflow-exerciser.sql
# echo "==> Seed workflows complete."
exit 0
