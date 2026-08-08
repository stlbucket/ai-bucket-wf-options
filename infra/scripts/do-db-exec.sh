#!/usr/bin/env bash
set -euo pipefail

# do-db-exec — run one or more SQL scripts (or an inline -c snippet) against the do-prod fnb DB
# (`pnpm do-db-exec <file.sql> [more.sql ...]` | `pnpm do-db-exec -c "<sql>"`). The non-interactive
# sibling of `pnpm do-db-psql`; the prod hot-fix primitive for applying a single change WITHOUT the
# destructive `pnpm do-db-rebuild`. USER-RUN ONLY — the assistant never executes this (it mutates
# prod as the managed ADMIN user and needs prod secrets).
#
# WHY THIS EXISTS (in-place-sqitch caveat): dev is rebuild-only, so DB changes are made by editing
# the ALREADY-DEPLOYED sqitch change files in place. A normal prod deploy (tag → deploy.yml →
# db-migrate runs `sqitch deploy`) only applies NEW changes — it will NOT re-run an edited change
# that is already marked deployed. So an in-place edit reaches prod only via (a) `pnpm do-db-rebuild`
# (fresh sqitch deploy — DESTROYS all app data) or (b) this script, replaying the corrected SQL
# against the live DB with no data loss.
#
# !!! DO NOT REPLAY A WHOLE HISTORICAL DEPLOY FILE against a fully-migrated DB. A deploy file was
# written for the schema state AT ITS position in the sqitch order; LATER changes may have removed
# objects it references (e.g. 00000000010242 still selects `auth.user`, which 00000000010280 drops),
# so a wholesale replay fails partway with "relation ... does not exist". Instead write a SURGICAL,
# idempotent hot-fix that carries ONLY your delta and references only objects that still exist — see
# db/hotfixes/ for the pattern (e.g. db/hotfixes/2026-08-07_u10_invite_user_profile_fields.sql).
#
# !!! OVERLOAD GOTCHA (function signature changes): `CREATE OR REPLACE FUNCTION` only replaces a
# function of the SAME argument signature. If your edit CHANGED the signature, the hot-fix must DROP
# the old signature first (drop function if exists app_fn.foo(<old-args>);) or a call matching both
# the old and new raises "function ... is not unique". Same-signature replacements need no drop.
#
# Connects FROM the box (postgres:16-alpine on fnb-network, over ssh) because the managed cluster's
# firewall admits only the droplet. The SQL is streamed over ssh stdin → `docker run -i … psql -f -`,
# so nothing is written to the box. `ON_ERROR_STOP=1`: the first error aborts and the non-zero exit
# propagates back through ssh. Credentials come from the box's root-only .env (envget) — no secret
# crosses ssh argv. You run as the managed ADMIN user (doadmin — app_pg_user parity): full rights,
# no RLS. Each file is a separate psql session (its own transaction handling), run in argv order;
# a failure stops the run.
#
# Inputs:
#   <file.sql> …                     one or more repo SQL files, run in order (piped via stdin)
#   -c "<sql>"                       run an inline SQL string instead of files
#   DB=<name>                        target database (default: POSTGRES_DB from the box .env = fnb;
#                                    e.g. DB=zitadel, DB=n8n_engine)
#   YES=1                            skip the confirmation prompt (CI / scripted use)
#   ~/.config/fnb/prod-secrets.env   Spaces key for the terraform state backend
#                                    (override path: FNB_PROD_SECRETS=...)
#   TERRAFORM_BIN / SSH_OPTS / REMOTE_DIR   same conventions as the other do-* scripts

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TF_DIR="$ROOT/infra/terraform/environments/do-prod"
SECRETS_FILE="${FNB_PROD_SECRETS:-$HOME/.config/fnb/prod-secrets.env}"
REMOTE_DIR="${REMOTE_DIR:-/opt/fnb}"
SSH_OPTS="${SSH_OPTS:-}"

DB_NAME="${DB:-}"
[[ "$DB_NAME" =~ ^[A-Za-z0-9_]*$ ]] || { echo "invalid DB name: $DB_NAME" >&2; exit 1; }

# ── parse args: either `-c "<sql>"` (inline) or a list of .sql file paths ─────
INLINE_SQL=""
FILES=()
if [ "${1:-}" = "-c" ]; then
  [ $# -eq 2 ] || { echo "usage: pnpm do-db-exec -c \"<sql>\"" >&2; exit 1; }
  INLINE_SQL="$2"
else
  [ $# -ge 1 ] || {
    echo "usage: pnpm do-db-exec <file.sql> [more.sql ...]   |   pnpm do-db-exec -c \"<sql>\"" >&2
    exit 1
  }
  for f in "$@"; do
    [ -f "$f" ] || { echo "not a file: $f" >&2; exit 1; }
    [ -r "$f" ] || { echo "not readable: $f" >&2; exit 1; }
    FILES+=("$f")
  done
fi

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
tf_json="$("$TERRAFORM_BIN" -chdir="$TF_DIR" output -json)"
BOX_HOST="$(jq -r '.reserved_ip.value // empty' <<<"$tf_json")"
DOMAIN="$(jq -r '.domain.value // empty' <<<"$tf_json")"
[ -n "$BOX_HOST" ] || { echo "terraform output for reserved_ip is empty — is do-prod provisioned?" >&2; exit 1; }

# ── confirmation (this mutates prod as admin) ────────────────────────────────
echo ""
echo "!!! do-db-exec runs SQL against the do-prod fnb DB (${DOMAIN:-do-prod}) as the managed ADMIN"
echo "!!! user (no RLS). This is a live, un-sandboxed write. There is no automatic backup."
if [ -n "$INLINE_SQL" ]; then
  echo "    database: ${DB_NAME:-fnb (box default)}"
  echo "    inline  : $INLINE_SQL"
else
  echo "    database: ${DB_NAME:-fnb (box default)}"
  echo "    files   : ${FILES[*]}"
fi
if [ "${YES:-0}" != "1" ]; then
  read -r -p "Proceed? [y/N] " confirm
  case "$confirm" in y|Y) ;; *) echo "aborted (no changes made)"; exit 1 ;; esac
fi

# ── remote psql (reads the SQL from stdin) ───────────────────────────────────
# The remote script is single-quoted on the box so every \$ / \" transmits literally and expands
# THERE. The .env is compose-env-file syntax (unquoted spaces) — never `source` it; envget extracts
# a single key (rest of line after the first '='). DB_NAME is validated above. `docker run -i` (no
# tty) keeps stdin open for `psql -f -`; ssh forwards our stdin to it.
run_remote_psql() {
  # shellcheck disable=SC2086
  ssh $SSH_OPTS "root@${BOX_HOST}" "FNB_EXEC_DB='$DB_NAME' bash -c '
    set -euo pipefail
    envget() { sed -n \"s/^\$1=//p\" $REMOTE_DIR/infra/compose/.env | head -1; }
    db=\"\${FNB_EXEC_DB:-}\"; [ -n \"\$db\" ] || db=\"\$(envget POSTGRES_DB)\"
    [ -n \"\$db\" ] || { echo \"POSTGRES_DB missing from box .env\" >&2; exit 1; }
    exec docker run --rm -i --network fnb-network \
      -e PGHOST=\"\$(envget MANAGED_PG_HOST)\" -e PGPORT=\"\$(envget MANAGED_PG_PORT)\" \
      -e PGUSER=\"\$(envget MANAGED_PG_ADMIN_USER)\" -e PGPASSWORD=\"\$(envget MANAGED_PG_ADMIN_PASSWORD)\" \
      -e PGDATABASE=\"\$db\" -e PGSSLMODE=require \
      postgres:16-alpine psql -v ON_ERROR_STOP=1 -f -
  '"
}

if [ -n "$INLINE_SQL" ]; then
  echo "==> executing inline SQL on ${BOX_HOST} (db: ${DB_NAME:-\$POSTGRES_DB})"
  printf '%s\n' "$INLINE_SQL" | run_remote_psql
else
  for f in "${FILES[@]}"; do
    echo "==> executing $f on ${BOX_HOST} (db: ${DB_NAME:-\$POSTGRES_DB})"
    run_remote_psql < "$f" || { echo "!!! failed on $f — stopping" >&2; exit 1; }
  done
fi

echo "==> do-db-exec complete"
