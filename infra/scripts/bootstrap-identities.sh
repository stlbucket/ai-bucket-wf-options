#!/usr/bin/env bash
set -euo pipefail

# bootstrap-identities — idempotent first-run identity bootstrap (spec production-runtime.md §9.1).
# Extracted from do-env-build.sh step 6 so do-db-rebuild.sh can re-run it after an fnb DB reset
# (spec prod-db-rebuild.md DR7). Two callers: do-env-build.sh (step 6), do-db-rebuild.sh (final step).
#
#   Site admin: POST https://<DOMAIN>/auth/api/setup/initialize   (200 created / 409 = no-op)
#   n8n owner:  POST https://n8n.<DOMAIN>/rest/owner/setup        (2xx created / 404 or "already" = no-op)
#
# Both calls are safe to re-run. After an fnb-only rebuild the site-admin call re-creates the
# anchor tenant + profile against the SURVIVING ZITADEL user (createHumanUser is find-or-create),
# and the n8n owner call no-ops (owner lives in the untouched n8n_engine DB).
#
# Contract: the caller sources the secrets file first — this script only reads the environment:
#   DOMAIN                                       target environment's apex domain
#   SITE_ADMIN_EMAIL/_FIRST_NAME/_LAST_NAME/_PHONE  site admin identity
#   SITE_ADMIN_PASSWORD                          ZITADEL prod policy: >=8 chars, upper+lower+number+symbol
#   SITE_TENANT_NAME                             anchor tenant name
#   SETUP_TOKEN                                  gates /auth/api/setup/initialize
#   N8N_ADMIN_PASSWORD                           n8n policy: >=8 chars, 1 number, 1 capital

command -v jq >/dev/null || { echo "missing required tool: jq" >&2; exit 1; }

: "${DOMAIN:?}"
: "${SITE_ADMIN_EMAIL:?}"
: "${SITE_ADMIN_FIRST_NAME:?}"
: "${SITE_ADMIN_LAST_NAME:?}"
: "${SITE_ADMIN_PHONE:?}"
: "${SITE_ADMIN_PASSWORD:?ZITADEL prod policy: >=8 chars, upper+lower+number+symbol}"
: "${SITE_TENANT_NAME:?the anchor tenant name, e.g. Anchor Tenant}"
: "${SETUP_TOKEN:?gates /auth/api/setup/initialize}"
: "${N8N_ADMIN_PASSWORD:?n8n policy: >=8 chars, 1 number, 1 capital}"

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
