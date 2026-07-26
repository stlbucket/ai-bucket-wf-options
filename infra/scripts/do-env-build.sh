#!/usr/bin/env bash
set -euo pipefail

# do-env-build — one-command DigitalOcean production build + deploy (`pnpm do-env-build`).
# Chains the runbook primitives (infra/README.md § Runbook — do-prod):
#
#   terraform apply → doctl registry login → build-images.sh → render-env.mjs → deploy.sh
#     → health-verify.sh → bootstrap-identities (site admin + n8n owner; §9.1, idempotent)
#
# USER-RUN ONLY — calls git, docker, terraform apply, and ssh; the assistant never executes this.
# Idempotent: terraform no-ops when infra is unchanged; images rebuild layer-cached; deploy is
# `compose pull && up -d`. Safe to re-run after a partial failure.
#
# Inputs:
#   ~/.config/fnb/prod-secrets.env   all secrets (override path: FNB_PROD_SECRETS=...)
#   IMAGE_TAG                        image tag to build/deploy (default: current git SHA, short=12)
# Stage toggles (set to 1):
#   SKIP_APPLY    reuse existing infra (still reads terraform outputs)
#   SKIP_BUILD    deploy already-pushed images (pair with an explicit IMAGE_TAG)
#   AUTO_APPROVE  pass -auto-approve to terraform apply (CI-style; default is interactive)
#
# The image build is memory-hungry (plan 0010 OOM finding): give Docker Desktop 8 GB+ or run
# SKIP_BUILD=1 here and build on a bigger machine / CI.

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TF_DIR="$ROOT/infra/terraform/environments/do-prod"
SECRETS_FILE="${FNB_PROD_SECRETS:-$HOME/.config/fnb/prod-secrets.env}"

# ── prerequisites ────────────────────────────────────────────────────────────
for bin in doctl docker node jq ssh rsync; do
  command -v "$bin" >/dev/null || { echo "missing required tool: $bin" >&2; exit 1; }
done
[ -f "$SECRETS_FILE" ] || { echo "secrets file not found: $SECRETS_FILE" >&2; exit 1; }
# shellcheck disable=SC1090
source "$SECRETS_FILE"
: "${DIGITALOCEAN_TOKEN:?not set in $SECRETS_FILE}"
: "${SPACES_ACCESS_KEY_ID:?not set in $SECRETS_FILE}"
: "${SPACES_SECRET_ACCESS_KEY:?not set in $SECRETS_FILE}"
export DIGITALOCEAN_TOKEN SPACES_ACCESS_KEY_ID SPACES_SECRET_ACCESS_KEY
# Spaces key doubles as the S3-compatible state-backend credential.
export AWS_ACCESS_KEY_ID="$SPACES_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$SPACES_SECRET_ACCESS_KEY"

# Terraform >= 1.6 required (Spaces endpoints{} backend). Prefer the pinned local install.
if [ -z "${TERRAFORM_BIN:-}" ]; then
  if [ -x "$HOME/.local/bin/terraform-1.10.5" ]; then TERRAFORM_BIN="$HOME/.local/bin/terraform-1.10.5"
  else TERRAFORM_BIN="terraform"; fi
fi
"$TERRAFORM_BIN" version -json | jq -e '.terraform_version | split(".") | (.[0]|tonumber) > 1 or ((.[0]|tonumber) == 1 and (.[1]|tonumber) >= 6)' >/dev/null \
  || { echo "terraform >= 1.6 required (found: $("$TERRAFORM_BIN" version | head -1)); set TERRAFORM_BIN=" >&2; exit 1; }

IMAGE_TAG="${IMAGE_TAG:-$(git -C "$ROOT" rev-parse --short=12 HEAD)}"

# ── 1. provision ─────────────────────────────────────────────────────────────
if [ "${SKIP_APPLY:-0}" != "1" ]; then
  echo "==> terraform apply (do-prod)"
  "$TERRAFORM_BIN" -chdir="$TF_DIR" init -input=false >/dev/null
  apply_args=(-input=false -var-file=do-prod.tfvars)
  [ "${AUTO_APPROVE:-0}" = "1" ] && apply_args+=(-auto-approve)
  "$TERRAFORM_BIN" -chdir="$TF_DIR" apply "${apply_args[@]}"
else
  echo "==> SKIP_APPLY=1 — reusing existing infra"
fi

# ── 2. terraform outputs → deploy env (the render-env.mjs contract) ──────────
echo "==> reading terraform outputs"
tf_json="$("$TERRAFORM_BIN" -chdir="$TF_DIR" output -json)"
tf_out() { jq -r --arg k "$1" '.[$k].value // empty' <<<"$tf_json"; }
export REGISTRY="$(tf_out registry_endpoint)"
export DOMAIN="$(tf_out domain)"
export MANAGED_PG_HOST="$(tf_out pg_host)"
export MANAGED_PG_PORT="$(tf_out pg_port)"
export MANAGED_PG_ADMIN_USER="$(tf_out pg_admin_user)"
export MANAGED_PG_ADMIN_PASSWORD="$(tf_out pg_admin_password)"
export MANAGED_PG_ADMIN_DB="$(tf_out pg_admin_db)"
export APP_PG_USER="$(tf_out app_pg_user)"
export APP_PG_PASSWORD="$(tf_out app_pg_password)"
export S3_ENDPOINT="$(tf_out s3_endpoint)"
export S3_PUBLIC_BASE_URL="$(tf_out s3_public_base_url)"
export S3_REGION="$(tf_out s3_region)"
export S3_BUCKET="$(tf_out s3_bucket)"
BOX_HOST="$(tf_out reserved_ip)"
for v in REGISTRY DOMAIN MANAGED_PG_HOST BOX_HOST; do
  [ -n "${!v}" ] || { echo "terraform output for $v is empty — was apply successful?" >&2; exit 1; }
done
export IMAGE_TAG

# ── 3. images ────────────────────────────────────────────────────────────────
if [ "${SKIP_BUILD:-0}" != "1" ]; then
  echo "==> building + pushing images @ ${IMAGE_TAG}"
  doctl registry login
  "$ROOT/infra/scripts/build-images.sh"
else
  echo "==> SKIP_BUILD=1 — deploying pre-built images @ ${IMAGE_TAG}"
fi

# ── 4. render the box .env ───────────────────────────────────────────────────
env_file="$(mktemp -t fnb-do-prod-env)"
trap 'rm -f "$env_file"' EXIT
node "$ROOT/infra/env/render-env.mjs" "$ROOT/infra/env/.env.prod.tpl" "$env_file"

# ── 5. deploy + verify ───────────────────────────────────────────────────────
ENVIRONMENT=do-prod BOX_HOST="$BOX_HOST" ENV_FILE="$env_file" "$ROOT/infra/scripts/deploy.sh"
DOMAIN="$DOMAIN" "$ROOT/infra/scripts/health-verify.sh"

# ── 6. bootstrap identities (spec production-runtime.md §9.1; idempotent) ─────
# Site admin (anchor tenant + app-admin-super via /auth/api/setup/initialize) and the n8n
# instance owner. Both calls are no-ops once the identity exists, so re-runs are safe.
: "${SITE_ADMIN_EMAIL:?not set in $SECRETS_FILE}"
: "${SITE_ADMIN_FIRST_NAME:?not set in $SECRETS_FILE}"
: "${SITE_ADMIN_LAST_NAME:?not set in $SECRETS_FILE}"
: "${SITE_ADMIN_PHONE:?not set in $SECRETS_FILE}"
: "${SITE_ADMIN_PASSWORD:?not set in $SECRETS_FILE (ZITADEL prod policy: >=8 chars, upper+lower+number+symbol)}"
: "${SITE_TENANT_NAME:?not set in $SECRETS_FILE (the anchor tenant name, e.g. Anchor Tenant)}"
: "${SETUP_TOKEN:?not set in $SECRETS_FILE (gates /auth/api/setup/initialize)}"
: "${N8N_ADMIN_PASSWORD:?not set in $SECRETS_FILE (n8n policy: >=8 chars, 1 number, 1 capital)}"

echo "==> bootstrap identities: site admin (${SITE_ADMIN_EMAIL})"
setup_payload="$(jq -n \
  --arg setupToken "$SETUP_TOKEN" --arg tenantName "$SITE_TENANT_NAME" \
  --arg email "$SITE_ADMIN_EMAIL" --arg password "$SITE_ADMIN_PASSWORD" \
  --arg firstName "$SITE_ADMIN_FIRST_NAME" --arg lastName "$SITE_ADMIN_LAST_NAME" \
  --arg phone "$SITE_ADMIN_PHONE" \
  '{setupToken:$setupToken,tenantName:$tenantName,email:$email,password:$password,firstName:$firstName,lastName:$lastName,phone:$phone}')"
setup_res="$(curl -sS -o /tmp/fnb-setup-res.json -w '%{http_code}' \
  -X POST "https://${DOMAIN}/auth/api/setup/initialize" \
  -H 'content-type: application/json' -d "$setup_payload")"
if [ "$setup_res" = "200" ]; then
  echo "    site admin created (anchor tenant '${SITE_TENANT_NAME}')"
elif [ "$setup_res" = "409" ]; then
  echo "    setup already complete — no-op"
else
  echo "site-admin bootstrap failed (HTTP $setup_res): $(cat /tmp/fnb-setup-res.json)" >&2; exit 1
fi

echo "==> bootstrap identities: n8n owner (${SITE_ADMIN_EMAIL})"
n8n_payload="$(jq -n \
  --arg email "$SITE_ADMIN_EMAIL" --arg firstName "$SITE_ADMIN_FIRST_NAME" \
  --arg lastName "$SITE_ADMIN_LAST_NAME" --arg password "$N8N_ADMIN_PASSWORD" \
  '{email:$email,firstName:$firstName,lastName:$lastName,password:$password}')"
n8n_res="$(curl -sS -o /tmp/fnb-n8n-owner-res.json -w '%{http_code}' \
  -X POST "https://n8n.${DOMAIN}/rest/owner/setup" \
  -H 'content-type: application/json' -d "$n8n_payload")"
if [ "${n8n_res#2}" != "$n8n_res" ]; then   # 2xx
  echo "    n8n owner created"
elif [ "$n8n_res" = "404" ] || { [ "${n8n_res#4}" != "$n8n_res" ] && grep -qi "already" /tmp/fnb-n8n-owner-res.json; }; then
  # Once an owner exists n8n DE-REGISTERS /rest/owner/setup — the re-run sees a bare 404
  # ("Cannot POST"), not a 400 "already setup". Both mean the same no-op.
  echo "    n8n owner already set up — no-op"
else
  echo "n8n owner bootstrap failed (HTTP $n8n_res): $(cat /tmp/fnb-n8n-owner-res.json)" >&2; exit 1
fi
rm -f /tmp/fnb-setup-res.json /tmp/fnb-n8n-owner-res.json

echo "==> do-prod is live @ ${IMAGE_TAG} — https://${DOMAIN}"
echo "    app:  https://${DOMAIN}  (site admin: ${SITE_ADMIN_EMAIL} via ZITADEL login)"
echo "    n8n:  https://n8n.${DOMAIN}  (owner: ${SITE_ADMIN_EMAIL})"
