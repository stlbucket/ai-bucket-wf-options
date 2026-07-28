#!/usr/bin/env bash
set -euo pipefail

# do-db-rebuild — reset the do-prod fnb DATABASE to a clean, bootstrapped state
# (`pnpm do-db-rebuild`). Spec: .claude/specs/deployment/prod-db-rebuild.md (DR1–DR7).
#
# USER-RUN ONLY — the assistant never executes this. The prod counterpart of dev `pnpm db-rebuild`:
#
#   typed confirm → [BACKUP=1 pg_dump] → sync db/ to the box → stop fnb-connected services
#     → DROP DATABASE fnb WITH (FORCE) + recreate → pg-bootstrap + db-migrate one-shots
#     → purge assets bucket (ALWAYS) → up -d + restart n8n → health-verify → bootstrap-identities
#
# DESTROYS: every row in the fnb DB (tenants, profiles, licenses, messages, locations, polls,
#   todos, games, tickets, URN registry, storage.asset metadata, notify + n8n.workflow_run logs)
#   AND every object in the Spaces assets bucket (a fresh DB must not sit next to orphans).
# SURVIVES: droplet, images, the managed PG cluster, the zitadel + n8n_engine DBs (all ZITADEL
#   identities, n8n workflows/credentials/owner), cluster-level roles, DNS/TLS, Terraform state.
#   Terraform is READ (output -json) but never applied or destroyed.
# CONSEQUENCES (spec §Consequences): non-site-admin ZITADEL users are orphaned (no app.profile —
#   re-invite them); live sessions die gracefully (claims fetch fails → login); the fnb-side
#   n8n.workflow_run log restarts empty while n8n's own execution history survives.
#
# Inputs:
#   ~/.config/fnb/prod-secrets.env   secrets (override path: FNB_PROD_SECRETS=...)
#   BACKUP=1                         pg_dump -Fc to /opt/fnb/backups/ on the box BEFORE dropping;
#                                    a failed dump aborts the whole run (default: no backup —
#                                    the typed confirmation is the only guard)
#   TERRAFORM_BIN / SSH_OPTS         same conventions as do-env-build / do-env-teardown

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TF_DIR="$ROOT/infra/terraform/environments/do-prod"
SECRETS_FILE="${FNB_PROD_SECRETS:-$HOME/.config/fnb/prod-secrets.env}"
REMOTE_DIR="/opt/fnb"
SSH_OPTS="${SSH_OPTS:-}"
BACKUP="${BACKUP:-0}"

# Every prod service that connects to the fnb DB (the 7 apps + n8n, whose workflow executions
# connect as n8n_worker). zitadel/clamav/caddy never touch fnb and stay up throughout.
FNB_SERVICES="auth-app home-app tenant-app msg-app game-app graphql-api-app storage-app n8n"

# ── prerequisites ────────────────────────────────────────────────────────────
for bin in jq ssh rsync aws; do
  command -v "$bin" >/dev/null || { echo "missing required tool: $bin" >&2; exit 1; }
done
[ -f "$SECRETS_FILE" ] || { echo "secrets file not found: $SECRETS_FILE" >&2; exit 1; }
# shellcheck disable=SC1090
source "$SECRETS_FILE"
# Spaces key = terraform state backend + bucket purge. DIGITALOCEAN_TOKEN is NOT needed —
# `terraform output` reads state only; no provider call, no registry work.
: "${SPACES_ACCESS_KEY_ID:?not set in $SECRETS_FILE}"
: "${SPACES_SECRET_ACCESS_KEY:?not set in $SECRETS_FILE}"
export AWS_ACCESS_KEY_ID="$SPACES_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$SPACES_SECRET_ACCESS_KEY"

if [ -z "${TERRAFORM_BIN:-}" ]; then
  if [ -x "$HOME/.local/bin/terraform-1.10.5" ]; then TERRAFORM_BIN="$HOME/.local/bin/terraform-1.10.5"
  else TERRAFORM_BIN="terraform"; fi
fi
"$TERRAFORM_BIN" version -json | jq -e '.terraform_version | split(".") | (.[0]|tonumber) > 1 or ((.[0]|tonumber) == 1 and (.[1]|tonumber) >= 6)' >/dev/null \
  || { echo "terraform >= 1.6 required (found: $("$TERRAFORM_BIN" version | head -1)); set TERRAFORM_BIN=" >&2; exit 1; }

# ── terraform outputs (READ-ONLY — no apply, no destroy, anywhere) ───────────
echo "==> reading terraform outputs (do-prod)"
"$TERRAFORM_BIN" -chdir="$TF_DIR" init -input=false >/dev/null
tf_json="$("$TERRAFORM_BIN" -chdir="$TF_DIR" output -json)"
tf_out() { jq -r --arg k "$1" '.[$k].value // empty' <<<"$tf_json"; }
BOX_HOST="$(tf_out reserved_ip)"
DOMAIN="$(tf_out domain)"
APP_PG_USER="$(tf_out app_pg_user)"
S3_BUCKET="$(tf_out s3_bucket)"
S3_ENDPOINT="$(tf_out s3_endpoint)"
for v in BOX_HOST DOMAIN APP_PG_USER S3_BUCKET S3_ENDPOINT; do
  [ -n "${!v}" ] || { echo "terraform output for $v is empty — is do-prod provisioned?" >&2; exit 1; }
done

TARGET="root@${BOX_HOST}"
# shellcheck disable=SC2086
ssh_box() { ssh $SSH_OPTS "$TARGET" "$@"; }
COMPOSE="docker compose -f $REMOTE_DIR/infra/compose/docker-compose.prod.yml --env-file $REMOTE_DIR/infra/compose/.env"

# ── typed confirmation ───────────────────────────────────────────────────────
echo "!!! This REBUILDS the do-prod fnb DATABASE (${DOMAIN}): every row of app data is destroyed"
echo "!!! and the assets bucket (${S3_BUCKET}) is EMPTIED. ZITADEL identities, n8n workflows,"
echo "!!! and all infrastructure survive. There is no undo (run with BACKUP=1 for a pg_dump first)."
[ "$BACKUP" = "1" ] && echo "    BACKUP=1 — a pg_dump will be taken before anything is dropped."
read -r -p "Type 'rebuild do-prod fnb' to continue: " confirm
[ "$confirm" = "rebuild do-prod fnb" ] || { echo "aborted (no changes made)"; exit 1; }

# ── 1. optional backup (BACKUP=1) — abort the run if the dump fails ──────────
if [ "$BACKUP" = "1" ]; then
  echo "==> pg_dump of fnb → $REMOTE_DIR/backups/ (on the box)"
  # Managed-PG creds come from the box's own root-only .env — no secret crosses ssh argv.
  # The .env is compose-env-file syntax (unquoted spaces, e.g. DEPLOY_PACKAGES) — NEVER `source`
  # it in bash; extract single keys (whole rest of line after the first '=').
  ssh_box bash -s <<EOF
set -euo pipefail
envget() { sed -n "s/^\$1=//p" $REMOTE_DIR/infra/compose/.env | head -1; }
mkdir -p $REMOTE_DIR/backups
ts="\$(date -u +%Y%m%dT%H%M%SZ)"
docker run --rm --network fnb-network \\
  -e PGHOST="\$(envget MANAGED_PG_HOST)" -e PGPORT="\$(envget MANAGED_PG_PORT)" \\
  -e PGUSER="\$(envget MANAGED_PG_ADMIN_USER)" -e PGPASSWORD="\$(envget MANAGED_PG_ADMIN_PASSWORD)" \\
  -e PGSSLMODE=require \\
  -v $REMOTE_DIR/backups:/backups \\
  postgres:16-alpine pg_dump -Fc -d "\$(envget POSTGRES_DB)" -f "/backups/fnb-\$ts.dump"
echo "    backup written: $REMOTE_DIR/backups/fnb-\$ts.dump"
EOF
  echo "    restore hint: pg_restore -d <db-url> --clean --if-exists $REMOTE_DIR/backups/fnb-<ts>.dump"
fi

# ── 2a. sync the db/ tree to the box ─────────────────────────────────────────
# db-migrate bind-mounts $REMOTE_DIR/db (see docker-compose.prod.yml) — normally shipped by
# deploy.sh, but a rebuild must run the REPO'S CURRENT migrations, not whatever the last deploy
# left behind (first live run failed on a stale script). Same rsync flags as deploy.sh. Note:
# migrate-entrypoint.sh / migrate.Dockerfile changes still need a deploy (baked into the image).
echo "==> syncing db/ migrations to the box"
rsync -az --delete -e "ssh $SSH_OPTS" "$ROOT/db" "$TARGET:$REMOTE_DIR/"

# ── 2b. stop the fnb-connected services (drain app connection pools) ─────────
echo "==> stopping fnb-connected services (caddy/zitadel/clamav stay up; app routes 502 meanwhile)"
ssh_box "$COMPOSE stop $FNB_SERVICES"

# ── 3. drop + recreate the fnb DB ────────────────────────────────────────────
# psql runs on the box (postgres:16-alpine on fnb-network) — the managed cluster's firewall only
# admits the droplet. DB name from the box .env (POSTGRES_DB), never hardcoded. WITH (FORCE)
# terminates any straggler backends (PG >= 13). Owner = the terraform app user so sqitch can
# CREATE SCHEMA (today app_pg_user IS doadmin — see modules/digitalocean/outputs.tf; the OWNER
# clause keeps this correct when the scoped-role downgrade lands).
echo "==> dropping + recreating the fnb DB"
ssh_box "APP_PG_USER='$APP_PG_USER' bash -s" <<EOF
set -euo pipefail
envget() { sed -n "s/^\$1=//p" $REMOTE_DIR/infra/compose/.env | head -1; }
db="\$(envget POSTGRES_DB)"
[ -n "\$db" ] || { echo "POSTGRES_DB missing from box .env" >&2; exit 1; }
docker run --rm --network fnb-network \\
  -e PGHOST="\$(envget MANAGED_PG_HOST)" -e PGPORT="\$(envget MANAGED_PG_PORT)" \\
  -e PGUSER="\$(envget MANAGED_PG_ADMIN_USER)" -e PGPASSWORD="\$(envget MANAGED_PG_ADMIN_PASSWORD)" \\
  -e PGDATABASE="\$(envget MANAGED_PG_ADMIN_DB)" -e PGSSLMODE=require \\
  postgres:16-alpine psql -v ON_ERROR_STOP=1 \\
    -c "DROP DATABASE IF EXISTS \$db WITH (FORCE);" \\
    -c "CREATE DATABASE \$db OWNER \$APP_PG_USER;"
EOF

# ── 4. re-run the one-shots: pg-bootstrap (PostGIS) → db-migrate (13 pkgs, SEED_DATA=empty) ──
# --exit-code-from waits in the foreground and propagates db-migrate's exit code; its depends_on
# runs pg-bootstrap to completion first (idempotent: guarded CREATEs, re-applies PostGIS).
# A failed migrate aborts here — BEFORE the bucket purge.
echo "==> re-running pg-bootstrap + db-migrate"
ssh_box "$COMPOSE up --exit-code-from db-migrate db-migrate"

# ── 5. purge the assets bucket (ALWAYS — spec DR3) ───────────────────────────
# storage.asset rows were the only references to these objects; after the wipe every object is
# an orphan. Versioned-purge sequence kept in lockstep with do-env-teardown.sh (its PURGE_BUCKET
# branch) — change one, change both.
echo "==> emptying s3://${S3_BUCKET} (versioned objects included)"
aws --endpoint-url "$S3_ENDPOINT" s3 rm "s3://${S3_BUCKET}" --recursive || true
aws --endpoint-url "$S3_ENDPOINT" s3api list-object-versions --bucket "$S3_BUCKET" \
  --query '[Versions[].{Key:Key,VersionId:VersionId},DeleteMarkers[].{Key:Key,VersionId:VersionId}][][]' \
  --output json 2>/dev/null | jq -c '.[]? // empty' | while read -r obj; do
    aws --endpoint-url "$S3_ENDPOINT" s3api delete-object --bucket "$S3_BUCKET" \
      --key "$(jq -r .Key <<<"$obj")" --version-id "$(jq -r .VersionId <<<"$obj")" >/dev/null
  done

# ── 6. restart the stack ─────────────────────────────────────────────────────
# up -d re-runs the remaining one-shots too (zitadel-seed no-ops, n8n-import re-imports); the n8n
# restart re-registers webhook routes after the import — same guard as deploy.sh.
echo "==> restarting the stack"
ssh_box "$COMPOSE up -d --remove-orphans"
ssh_box "$COMPOSE restart n8n"

# ── 7. verify + re-bootstrap identities ──────────────────────────────────────
DOMAIN="$DOMAIN" "$ROOT/infra/scripts/health-verify.sh"

# Site admin: the anchor is gone, so /auth/api/setup/initialize re-creates the anchor tenant +
# profile against the SURVIVING ZITADEL user (createHumanUser is find-or-create). n8n owner:
# survives in n8n_engine → 404 no-op.
: "${SITE_ADMIN_EMAIL:?not set in $SECRETS_FILE}"
: "${SITE_ADMIN_FIRST_NAME:?not set in $SECRETS_FILE}"
: "${SITE_ADMIN_LAST_NAME:?not set in $SECRETS_FILE}"
: "${SITE_ADMIN_PHONE:?not set in $SECRETS_FILE}"
: "${SITE_ADMIN_PASSWORD:?not set in $SECRETS_FILE (ZITADEL prod policy: >=8 chars, upper+lower+number+symbol)}"
: "${SITE_TENANT_NAME:?not set in $SECRETS_FILE (the anchor tenant name, e.g. Anchor Tenant)}"
: "${SETUP_TOKEN:?not set in $SECRETS_FILE (gates /auth/api/setup/initialize)}"
: "${N8N_ADMIN_PASSWORD:?not set in $SECRETS_FILE (n8n policy: >=8 chars, 1 number, 1 capital)}"
export DOMAIN SITE_ADMIN_EMAIL SITE_ADMIN_FIRST_NAME SITE_ADMIN_LAST_NAME SITE_ADMIN_PHONE \
  SITE_ADMIN_PASSWORD SITE_TENANT_NAME SETUP_TOKEN N8N_ADMIN_PASSWORD
"$ROOT/infra/scripts/bootstrap-identities.sh"

echo "==> fnb DB rebuilt on do-prod — https://${DOMAIN}"
echo "    site admin: ${SITE_ADMIN_EMAIL} (ZITADEL login). Pre-rebuild invited users are orphaned"
echo "    in ZITADEL (no app.profile) — re-invite them from the app."
