#!/usr/bin/env bash
set -euo pipefail

# Deploy the prod stack to the box: copy artifacts, log the box into the registry, pull + up -d.
# The primitive behind deploy.yml — a human can run the exact same deploy from a laptop (spec §4).
# Runs from the repo root (or anywhere; paths are resolved from this script's location).
#
# Required env:
#   ENVIRONMENT   do-prod | aws-prod          (selects the registry-login method)
#   BOX_HOST      the box's public IP / hostname (reserved IP / EIP)
#   REGISTRY      registry host (DOCR: registry.digitalocean.com/<name> | ECR: <acct>.dkr.ecr.<region>.amazonaws.com)
#   IMAGE_TAG     the git-SHA tag built by build-images.sh
#   ENV_FILE      path to the rendered root-only .env (from render-env.mjs)
# Registry-login creds (one set, by cloud):
#   do-prod:   DIGITALOCEAN_TOKEN   (doubles as DOCR docker user+password)
#   aws-prod:  AWS creds in the environment + AWS_REGION (aws ecr get-login-password)
# Optional:
#   BOX_USER      ssh user (default: root for do-prod, ubuntu for aws-prod)
#   REMOTE_DIR    remote stack dir (default: /opt/fnb)
#   SSH_OPTS      extra ssh/scp options

: "${ENVIRONMENT:?}" ; : "${BOX_HOST:?}" ; : "${REGISTRY:?}" ; : "${IMAGE_TAG:?}" ; : "${ENV_FILE:?}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REMOTE_DIR="${REMOTE_DIR:-/opt/fnb}"
SSH_OPTS="${SSH_OPTS:-}"

case "$ENVIRONMENT" in
  do-prod)  BOX_USER="${BOX_USER:-root}" ;;
  aws-prod) BOX_USER="${BOX_USER:-ubuntu}" ;;
  *) echo "unknown ENVIRONMENT: $ENVIRONMENT (expected do-prod|aws-prod)" >&2; exit 1 ;;
esac
TARGET="${BOX_USER}@${BOX_HOST}"
# shellcheck disable=SC2086
ssh_box() { ssh $SSH_OPTS "$TARGET" "$@"; }

echo "==> [$ENVIRONMENT] preparing $REMOTE_DIR on $TARGET"
ssh_box "sudo mkdir -p $REMOTE_DIR && sudo chown \$(id -u):\$(id -g) $REMOTE_DIR"

echo "==> copying artifacts (compose + Caddyfile + db/ + n8n/ + .env)"
# The prod compose expects, relative to itself: ../docker/{Caddyfile,pg-bootstrap.sh}, ../../db,
# ../../n8n, ../../docker/{migrate.Dockerfile,migrate-entrypoint.sh,zitadel/seed.mjs}. Ship the
# repo subtrees it reads so paths resolve on the box under $REMOTE_DIR.
# shellcheck disable=SC2086
rsync -az --delete $SSH_OPTS \
  "$ROOT/infra/compose" "$ROOT/infra/docker" \
  "$ROOT/docker" "$ROOT/db" "$ROOT/n8n" \
  "$TARGET:$REMOTE_DIR/"
# shellcheck disable=SC2086
scp $SSH_OPTS "$ENV_FILE" "$TARGET:$REMOTE_DIR/infra/compose/.env"
ssh_box "chmod 600 $REMOTE_DIR/infra/compose/.env"

echo "==> logging the box into the registry"
case "$ENVIRONMENT" in
  do-prod)
    : "${DIGITALOCEAN_TOKEN:?}"
    printf '%s' "$DIGITALOCEAN_TOKEN" | ssh_box "docker login registry.digitalocean.com -u '$DIGITALOCEAN_TOKEN' --password-stdin"
    ;;
  aws-prod)
    : "${AWS_REGION:?}"
    aws ecr get-login-password --region "$AWS_REGION" | ssh_box "docker login $REGISTRY -u AWS --password-stdin"
    ;;
esac

echo "==> compose pull && up -d"
COMPOSE="docker compose -f $REMOTE_DIR/infra/compose/docker-compose.prod.yml --env-file $REMOTE_DIR/infra/compose/.env"
ssh_box "$COMPOSE pull"
ssh_box "$COMPOSE up -d --remove-orphans"

echo "==> deployed $ENVIRONMENT @ $IMAGE_TAG. Run health-verify.sh next."
