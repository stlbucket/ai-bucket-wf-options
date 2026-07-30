#!/usr/bin/env bash
set -euo pipefail

# do-ssh-allow — add a network to the do-prod SSH allowlist (`pnpm do-ssh-allow [cidr]`).
#
# The cloud firewall (modules/digitalocean/main.tf) admits port 22 only from admin_ssh_cidrs —
# working from a new network (home ISP rotates your IP, different wifi, hotspot) shows up as
# `ssh: connect ... Operation timed out` from deploy/rebuild scripts. This script:
#
#   detect your public IP (or take a CIDR arg) → ensure it's in admin_ssh_cidrs in do-prod.tfvars
#     → terraform apply TARGETED at the firewall only → verify port 22 answers
#
# Only module.digitalocean.digitalocean_firewall.web is ever applied — droplet, DB, DNS, bucket
# and any unapplied drift elsewhere are untouched. Counterpart: do-ssh-revoke.sh.
#
# Inputs:
#   $1 (optional)                    CIDR to allow, e.g. 203.0.113.7/32 or 172.56.0.0/16
#                                    (default: <your current public IP>/32; with no arg the
#                                    script exits early if SSH already works from here)
#   ~/.config/fnb/prod-secrets.env   secrets (override path: FNB_PROD_SECRETS=...)
#   TERRAFORM_BIN / SSH_OPTS         same conventions as do-db-rebuild.sh

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TF_DIR="$ROOT/infra/terraform/environments/do-prod"
TFVARS="$TF_DIR/do-prod.tfvars"
SECRETS_FILE="${FNB_PROD_SECRETS:-$HOME/.config/fnb/prod-secrets.env}"
FIREWALL_TARGET="module.digitalocean.digitalocean_firewall.web"

# ── prerequisites ────────────────────────────────────────────────────────────
for bin in jq curl nc; do
  command -v "$bin" >/dev/null || { echo "missing required tool: $bin" >&2; exit 1; }
done
[ -f "$SECRETS_FILE" ] || { echo "secrets file not found: $SECRETS_FILE" >&2; exit 1; }
# shellcheck disable=SC1090
source "$SECRETS_FILE"
: "${SPACES_ACCESS_KEY_ID:?not set in $SECRETS_FILE}"
: "${SPACES_SECRET_ACCESS_KEY:?not set in $SECRETS_FILE}"
: "${DIGITALOCEAN_TOKEN:?not set in $SECRETS_FILE (terraform apply needs the DO provider)}"
export AWS_ACCESS_KEY_ID="$SPACES_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$SPACES_SECRET_ACCESS_KEY"
export DIGITALOCEAN_TOKEN

if [ -z "${TERRAFORM_BIN:-}" ]; then
  if [ -x "$HOME/.local/bin/terraform-1.10.5" ]; then TERRAFORM_BIN="$HOME/.local/bin/terraform-1.10.5"
  else TERRAFORM_BIN="terraform"; fi
fi
"$TERRAFORM_BIN" version -json | jq -e '.terraform_version | split(".") | (.[0]|tonumber) > 1 or ((.[0]|tonumber) == 1 and (.[1]|tonumber) >= 6)' >/dev/null \
  || { echo "terraform >= 1.6 required (found: $("$TERRAFORM_BIN" version | head -1)); set TERRAFORM_BIN=" >&2; exit 1; }

# ── resolve the CIDR to allow ────────────────────────────────────────────────
EXPLICIT_CIDR="${1:-}"
if [ -n "$EXPLICIT_CIDR" ]; then
  CIDR="$EXPLICIT_CIDR"
else
  MY_IP="$(curl -fsS --max-time 10 https://api.ipify.org)"
  CIDR="${MY_IP}/32"
  echo "==> your current public IP: $MY_IP"
fi
[[ "$CIDR" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}/([0-9]|[12][0-9]|3[0-2])$ ]] \
  || { echo "not a valid IPv4 CIDR: $CIDR" >&2; exit 1; }

# ── read the current allowlist from do-prod.tfvars ───────────────────────────
line="$(grep -E '^admin_ssh_cidrs[[:space:]]*=' "$TFVARS")" \
  || { echo "admin_ssh_cidrs line not found in $TFVARS" >&2; exit 1; }
inner="${line#*[}"; inner="${inner%]*}"
cidrs=()
IFS=',' read -ra raw <<<"$inner"
for c in "${raw[@]}"; do c="${c//[\" ]/}"; [ -n "$c" ] && cidrs+=("$c"); done
# NOTE: empty-array expansions use ${arr[@]:-} — macOS ships bash 3.2, where "${arr[@]}" on an
# empty array trips set -u.
echo "==> current allowlist: ${cidrs[*]:-(empty)}"

# ── box host (terraform output, read-only) ───────────────────────────────────
"$TERRAFORM_BIN" -chdir="$TF_DIR" init -input=false >/dev/null
BOX_HOST="$("$TERRAFORM_BIN" -chdir="$TF_DIR" output -json | jq -r '.reserved_ip.value // empty')"
[ -n "$BOX_HOST" ] || { echo "terraform output reserved_ip is empty — is do-prod provisioned?" >&2; exit 1; }

# No-arg mode is "make SSH work from here" — if it already does (this /32, or a wider range
# like the hotspot /16, already admits you), there is nothing to change.
if [ -z "$EXPLICIT_CIDR" ] && nc -z -G 5 "$BOX_HOST" 22 2>/dev/null; then
  echo "==> SSH to $BOX_HOST already works from this network — nothing to do"
  echo "    (pass a CIDR explicitly to add one anyway: pnpm do-ssh-allow <cidr>)"
  exit 0
fi

# ── ensure the CIDR is in the tfvars list ────────────────────────────────────
present=0
for c in "${cidrs[@]:-}"; do [ "$c" = "$CIDR" ] && present=1; done
if [ "$present" = "1" ]; then
  echo "==> $CIDR already in do-prod.tfvars — applying in case the firewall is behind the file"
else
  cidrs+=("$CIDR")
  quoted=""
  for c in "${cidrs[@]}"; do quoted+="${quoted:+, }\"$c\""; done
  new_line="admin_ssh_cidrs = [$quoted]"
  tmp="$(mktemp)"
  awk -v repl="$new_line" '/^admin_ssh_cidrs[[:space:]]*=/{print repl; next}{print}' "$TFVARS" >"$tmp"
  mv "$tmp" "$TFVARS"
  echo "==> added $CIDR to $TFVARS"
fi

# ── apply the firewall only ──────────────────────────────────────────────────
# -target scopes the plan to the firewall resource; terraform's own yes/no prompt is the guard.
echo "==> terraform apply (firewall only) — expect 'Plan: 0 to add, 1 to change, 0 to destroy'"
"$TERRAFORM_BIN" -chdir="$TF_DIR" apply -var-file="$(basename "$TFVARS")" -target="$FIREWALL_TARGET"

# ── verify ───────────────────────────────────────────────────────────────────
if nc -z -G 5 "$BOX_HOST" 22 2>/dev/null; then
  echo "==> verified: SSH port 22 on $BOX_HOST is reachable from this network"
else
  echo "!!! port 22 on $BOX_HOST still not reachable from here" >&2
  echo "    (expected if you added a CIDR for a different network than the one you're on;" >&2
  echo "    otherwise wait a few seconds and retry: nc -z $BOX_HOST 22)" >&2
fi
