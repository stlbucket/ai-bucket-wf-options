#!/usr/bin/env bash
set -euo pipefail

# Post-deploy health probes (spec §9 step 5). Gates deploy success. Polls each endpoint until it
# returns an acceptable status or the retry budget is exhausted. Run after deploy.sh.
#
# Required env:
#   DOMAIN   the apex domain (id.<domain> + n8n.<domain> derive from it)
# Optional:
#   RETRIES  attempts per endpoint (default 30)
#   SLEEP    seconds between attempts (default 10)  — first-boot (zitadel seed, clamav sigs) is slow

: "${DOMAIN:?}"
RETRIES="${RETRIES:-30}"
SLEEP="${SLEEP:-10}"

# name  url  acceptable-status-regex
probe() {
  local name="$1" url="$2" ok="$3" i code
  for i in $(seq 1 "$RETRIES"); do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$url" || echo 000)"
    if printf '%s' "$code" | grep -qE "$ok"; then
      echo "  ✓ $name ($url) -> $code"
      return 0
    fi
    echo "    $name ($url) -> $code (attempt $i/$RETRIES)"
    sleep "$SLEEP"
  done
  echo "  ✗ $name ($url) never became healthy" >&2
  return 1
}

echo "==> health-verify: https://$DOMAIN"
fail=0
probe "home (catch-all)"  "https://$DOMAIN/"                  '^(200|30.)$' || fail=1
probe "auth-app"          "https://$DOMAIN/auth"              '^(200|30.)$' || fail=1
# graphql-api: a GET to the endpoint returns 200/400/405 (not a connection error) once it's serving.
probe "graphql-api"       "https://$DOMAIN/graphql-api"       '^(200|400|404|405)$' || fail=1
probe "zitadel (id.)"     "https://id.$DOMAIN/debug/healthz"  '^200$' || fail=1
probe "n8n (n8n.)"        "https://n8n.$DOMAIN/healthz"       '^200$' || fail=1

if [ "$fail" -ne 0 ]; then
  echo "==> health-verify FAILED" >&2
  exit 1
fi
echo "==> health-verify PASSED"
