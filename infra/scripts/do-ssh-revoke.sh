#!/usr/bin/env bash
set -euo pipefail

# do-ssh-revoke — remove selected networks from the do-prod SSH allowlist (`pnpm do-ssh-revoke`).
#
# Lists the admin_ssh_cidrs entries from do-prod.tfvars numbered, asks which to remove, rewrites
# the tfvars, then runs a terraform apply TARGETED at the cloud firewall only
# (module.digitalocean.digitalocean_firewall.web) — no other infrastructure is touched.
# Counterpart: do-ssh-allow.sh.
#
# Removing the network you are currently on locks you out of SSH (the site stays up; the DO web
# console + do-ssh-allow.sh from an allowed network get you back in) — the script warns first.
# Emptying the list entirely requires its own typed confirmation.
#
# Inputs:
#   ~/.config/fnb/prod-secrets.env   secrets (override path: FNB_PROD_SECRETS=...)
#   TERRAFORM_BIN                    same convention as do-db-rebuild.sh

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TF_DIR="$ROOT/infra/terraform/environments/do-prod"
TFVARS="$TF_DIR/do-prod.tfvars"
SECRETS_FILE="${FNB_PROD_SECRETS:-$HOME/.config/fnb/prod-secrets.env}"
FIREWALL_TARGET="module.digitalocean.digitalocean_firewall.web"

# ── prerequisites ────────────────────────────────────────────────────────────
for bin in jq curl; do
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

# ── read the current allowlist ───────────────────────────────────────────────
line="$(grep -E '^admin_ssh_cidrs[[:space:]]*=' "$TFVARS")" \
  || { echo "admin_ssh_cidrs line not found in $TFVARS" >&2; exit 1; }
inner="${line#*[}"; inner="${inner%]*}"
cidrs=()
IFS=',' read -ra raw <<<"$inner"
for c in "${raw[@]}"; do c="${c//[\" ]/}"; [ -n "$c" ] && cidrs+=("$c"); done
[ "${#cidrs[@]}" -gt 0 ] || { echo "admin_ssh_cidrs is already empty — nothing to revoke"; exit 0; }

MY_IP="$(curl -fsS --max-time 10 https://api.ipify.org || true)"
echo "SSH allowlist (your current public IP: ${MY_IP:-unknown}):"
for i in "${!cidrs[@]}"; do
  marker=""
  [ -n "$MY_IP" ] && [ "${cidrs[$i]}" = "${MY_IP}/32" ] && marker="   <-- your current network"
  printf '  %d) %s%s\n' "$((i + 1))" "${cidrs[$i]}" "$marker"
done

# ── select entries to remove ─────────────────────────────────────────────────
read -r -p "Numbers to remove (space-separated, or 'q' to abort): " selection
[ -n "$selection" ] && [ "$selection" != "q" ] || { echo "aborted (no changes made)"; exit 1; }

declare -a remove_idx=()
for n in $selection; do
  [[ "$n" =~ ^[0-9]+$ ]] && [ "$n" -ge 1 ] && [ "$n" -le "${#cidrs[@]}" ] \
    || { echo "invalid selection: $n" >&2; exit 1; }
  remove_idx+=("$((n - 1))")
done
[ "${#remove_idx[@]}" -gt 0 ] || { echo "aborted (nothing selected)"; exit 1; }

keep=() removed=()
for i in "${!cidrs[@]}"; do
  drop=0
  for r in "${remove_idx[@]}"; do [ "$i" = "$r" ] && drop=1; done
  if [ "$drop" = "1" ]; then removed+=("${cidrs[$i]}"); else keep+=("${cidrs[$i]}"); fi
done
echo "==> removing: ${removed[*]}"
echo "==> remaining: ${keep[*]:-(none)}"

if [ -n "$MY_IP" ]; then
  for r in "${removed[@]}"; do
    if [ "$r" = "${MY_IP}/32" ]; then
      echo "!!! $r is the network you are on RIGHT NOW — SSH from here stops working after apply."
    fi
  done
fi
if [ "${#keep[@]}" -eq 0 ]; then
  echo "!!! This empties the allowlist: NOBODY can SSH to the box (deploys/rebuilds included)"
  echo "!!! until do-ssh-allow re-adds a network. The site itself stays up."
  read -r -p "Type 'remove all ssh access' to continue: " confirm
  [ "$confirm" = "remove all ssh access" ] || { echo "aborted (no changes made)"; exit 1; }
fi

# ── rewrite the tfvars ───────────────────────────────────────────────────────
quoted=""
for c in "${keep[@]:-}"; do [ -n "$c" ] && quoted+="${quoted:+, }\"$c\""; done
new_line="admin_ssh_cidrs = [$quoted]"
tmp="$(mktemp)"
awk -v repl="$new_line" '/^admin_ssh_cidrs[[:space:]]*=/{print repl; next}{print}' "$TFVARS" >"$tmp"
mv "$tmp" "$TFVARS"
echo "==> updated $TFVARS"

# ── apply the firewall only ──────────────────────────────────────────────────
# -target scopes the plan to the firewall resource; terraform's own yes/no prompt is the guard.
echo "==> terraform apply (firewall only) — expect 'Plan: 0 to add, 1 to change, 0 to destroy'"
"$TERRAFORM_BIN" -chdir="$TF_DIR" init -input=false >/dev/null
"$TERRAFORM_BIN" -chdir="$TF_DIR" apply -var-file="$(basename "$TFVARS")" -target="$FIREWALL_TARGET"

echo "==> done — SSH allowlist is now: ${keep[*]:-(empty)}"
