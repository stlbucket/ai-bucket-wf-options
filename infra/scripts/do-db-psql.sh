#!/usr/bin/env bash
set -euo pipefail

# do-db-psql — interactive psql into the do-prod fnb DB (`pnpm do-db-psql`), the prod sibling of
# dev `pnpm db-psql`. USER-RUN ONLY — the assistant never executes this.
#
# Connects from the BOX (postgres:16-alpine on fnb-network, ssh -t for the TTY) — the managed
# cluster's firewall only admits the droplet. Credentials come from the box's root-only .env,
# so no secret crosses ssh argv. You connect as the managed ADMIN user (doadmin — app_pg_user
# parity, see modules/digitalocean/outputs.tf): full rights, no RLS. Type carefully.
#
# Inputs:
#   ~/.config/fnb/prod-secrets.env   Spaces key for the terraform state backend
#                                    (override path: FNB_PROD_SECRETS=...)
#   DB=<name>                        target database (default: POSTGRES_DB from the box .env,
#                                    i.e. fnb; e.g. DB=zitadel, DB=n8n_engine, DB=defaultdb)
#   TERRAFORM_BIN / SSH_OPTS         same conventions as the other do-* scripts

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TF_DIR="$ROOT/infra/terraform/environments/do-prod"
SECRETS_FILE="${FNB_PROD_SECRETS:-$HOME/.config/fnb/prod-secrets.env}"
REMOTE_DIR="${REMOTE_DIR:-/opt/fnb}"
SSH_OPTS="${SSH_OPTS:-}"

DB_NAME="${DB:-}"
[[ "$DB_NAME" =~ ^[A-Za-z0-9_]*$ ]] || { echo "invalid DB name: $DB_NAME" >&2; exit 1; }

for bin in jq ssh; do
  command -v "$bin" >/dev/null || { echo "missing required tool: $bin" >&2; exit 1; }
done
[ -f "$SECRETS_FILE" ] || { echo "secrets file not found: $SECRETS_FILE" >&2; exit 1; }
# shellcheck disable=SC1090
source "$SECRETS_FILE"
# Spaces key = terraform state backend only. DIGITALOCEAN_TOKEN is NOT needed (`output` is state-only).
: "${SPACES_ACCESS_KEY_ID:?not set in $SECRETS_FILE}"
: "${SPACES_SECRET_ACCESS_KEY:?not set in $SECRETS_FILE}"
export AWS_ACCESS_KEY_ID="$SPACES_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$SPACES_SECRET_ACCESS_KEY"

if [ -z "${TERRAFORM_BIN:-}" ]; then
  if [ -x "$HOME/.local/bin/terraform-1.10.5" ]; then TERRAFORM_BIN="$HOME/.local/bin/terraform-1.10.5"
  else TERRAFORM_BIN="terraform"; fi
fi

echo "==> reading terraform outputs (do-prod)"
"$TERRAFORM_BIN" -chdir="$TF_DIR" init -input=false >/dev/null
BOX_HOST="$("$TERRAFORM_BIN" -chdir="$TF_DIR" output -json | jq -r '.reserved_ip.value // empty')"
[ -n "$BOX_HOST" ] || { echo "terraform output for reserved_ip is empty — is do-prod provisioned?" >&2; exit 1; }

# The remote script is single-quoted on the box, so every \$ / \" below transmits literally and
# expands THERE. The .env is compose-env-file syntax (unquoted spaces) — never `source` it in
# bash; envget extracts single keys (whole rest of line after the first '='). DB_NAME is
# validated above ([A-Za-z0-9_]*), safe to inline.
echo "==> psql on ${BOX_HOST} (db: ${DB_NAME:-\$POSTGRES_DB from box .env}) — \\q to exit"
# shellcheck disable=SC2086
exec ssh -t $SSH_OPTS "root@${BOX_HOST}" "FNB_PSQL_DB='$DB_NAME' bash -c '
  set -euo pipefail
  envget() { sed -n \"s/^\$1=//p\" $REMOTE_DIR/infra/compose/.env | head -1; }
  db=\"\${FNB_PSQL_DB:-}\"; [ -n \"\$db\" ] || db=\"\$(envget POSTGRES_DB)\"
  [ -n \"\$db\" ] || { echo \"POSTGRES_DB missing from box .env\" >&2; exit 1; }
  exec docker run --rm -it --network fnb-network \
    -e PGHOST=\"\$(envget MANAGED_PG_HOST)\" -e PGPORT=\"\$(envget MANAGED_PG_PORT)\" \
    -e PGUSER=\"\$(envget MANAGED_PG_ADMIN_USER)\" -e PGPASSWORD=\"\$(envget MANAGED_PG_ADMIN_PASSWORD)\" \
    -e PGDATABASE=\"\$db\" -e PGSSLMODE=require \
    postgres:16-alpine psql
'"
