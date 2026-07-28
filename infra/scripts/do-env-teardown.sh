#!/usr/bin/env bash
set -euo pipefail

# do-env-teardown — destroy the DigitalOcean production environment (`pnpm do-env-teardown`).
#
# USER-RUN ONLY — the assistant never executes this. IRREVERSIBLY DESTROYS:
#   droplet · managed PG cluster (ALL DATA) · Spaces assets bucket · DOCR registry (all images) ·
#   DNS zone + records · VPC/firewalls/reserved IP
#
# Left untouched: the Terraform state bucket (fnb-tfstate-do — out of band), registrar NS
# delegation, ~/.config/fnb/prod-secrets.env. ZITADEL_MASTERKEY / N8N_ENCRYPTION_KEY may be
# REUSED on a rebuild — their immutability binds them to a data lifetime, and teardown ends it.
#
# A non-empty assets bucket blocks `terraform destroy`; PURGE_BUCKET=1 empties it first.

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TF_DIR="$ROOT/infra/terraform/environments/do-prod"
SECRETS_FILE="${FNB_PROD_SECRETS:-$HOME/.config/fnb/prod-secrets.env}"

command -v jq >/dev/null || { echo "missing required tool: jq" >&2; exit 1; }
[ -f "$SECRETS_FILE" ] || { echo "secrets file not found: $SECRETS_FILE" >&2; exit 1; }
# shellcheck disable=SC1090
source "$SECRETS_FILE"
: "${DIGITALOCEAN_TOKEN:?not set in $SECRETS_FILE}"
: "${SPACES_ACCESS_KEY_ID:?not set in $SECRETS_FILE}"
: "${SPACES_SECRET_ACCESS_KEY:?not set in $SECRETS_FILE}"
export DIGITALOCEAN_TOKEN SPACES_ACCESS_KEY_ID SPACES_SECRET_ACCESS_KEY
export AWS_ACCESS_KEY_ID="$SPACES_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$SPACES_SECRET_ACCESS_KEY"

if [ -z "${TERRAFORM_BIN:-}" ]; then
  if [ -x "$HOME/.local/bin/terraform-1.10.5" ]; then TERRAFORM_BIN="$HOME/.local/bin/terraform-1.10.5"
  else TERRAFORM_BIN="terraform"; fi
fi

echo "!!! This DESTROYS the do-prod environment: droplet, DATABASE (all data), assets bucket,"
echo "!!! registry + images, DNS zone. There is no undo."
read -r -p "Type 'destroy do-prod' to continue: " confirm
[ "$confirm" = "destroy do-prod" ] || { echo "aborted (no changes made)"; exit 1; }

# Versioned-purge sequence kept in lockstep with do-db-rebuild.sh step 5 — change one, change both.
if [ "${PURGE_BUCKET:-0}" = "1" ]; then
  bucket="$("$TERRAFORM_BIN" -chdir="$TF_DIR" output -json 2>/dev/null | jq -r '.s3_bucket.value // empty')"
  endpoint="$("$TERRAFORM_BIN" -chdir="$TF_DIR" output -json 2>/dev/null | jq -r '.s3_endpoint.value // empty')"
  if [ -n "$bucket" ] && [ -n "$endpoint" ]; then
    command -v aws >/dev/null || { echo "PURGE_BUCKET=1 needs the aws CLI" >&2; exit 1; }
    echo "==> emptying s3://${bucket} (versioned objects included)"
    aws --endpoint-url "$endpoint" s3 rm "s3://${bucket}" --recursive || true
    # versioned buckets keep delete markers/old versions; remove them so destroy succeeds
    aws --endpoint-url "$endpoint" s3api list-object-versions --bucket "$bucket" \
      --query '[Versions[].{Key:Key,VersionId:VersionId},DeleteMarkers[].{Key:Key,VersionId:VersionId}][][]' \
      --output json 2>/dev/null | jq -c '.[]? // empty' | while read -r obj; do
        aws --endpoint-url "$endpoint" s3api delete-object --bucket "$bucket" \
          --key "$(jq -r .Key <<<"$obj")" --version-id "$(jq -r .VersionId <<<"$obj")" >/dev/null
      done
  fi
fi

echo "==> terraform destroy (do-prod)"
"$TERRAFORM_BIN" -chdir="$TF_DIR" init -input=false >/dev/null
"$TERRAFORM_BIN" -chdir="$TF_DIR" destroy -input=false -var-file=do-prod.tfvars

echo "==> do-prod destroyed. State bucket, NS delegation, and the secrets file remain."
