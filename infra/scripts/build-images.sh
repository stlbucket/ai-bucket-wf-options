#!/usr/bin/env bash
set -euo pipefail

# Build + push the 8 production app images, git-SHA tagged. Registry-agnostic:
#   REGISTRY = registry.digitalocean.com/<name>   (DOCR)
#            | <acct>.dkr.ecr.<region>.amazonaws.com  (ECR)
# CI (build-images.yml) passes IMAGE_TAG=$GITHUB_SHA; locally it falls back to the current git SHA.
# Log in to the registry FIRST (doctl registry login / aws ecr get-login-password | docker login).
#
# This script (run by CI or a human) calls git + docker; the assistant never executes those itself.

: "${REGISTRY:?REGISTRY is required (DOCR: registry.digitalocean.com/<name> | ECR: <acct>.dkr.ecr.<region>.amazonaws.com)}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short=12 HEAD)}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"     # repo root == docker build context
APP_DOCKERFILE="$ROOT/infra/docker/app.Dockerfile"
AGENT_DOCKERFILE="$ROOT/infra/docker/agent.Dockerfile"

# app dir -> Caddy base URL. home-app is the '/' catch-all (no base URL); agent-app is headless
# (built separately below). These MUST match docker/Caddyfile and the dev docker-compose per-app
# NUXT_APP_BASE_URL — the built value has to equal the runtime value.
base_url_for() {
  case "$1" in
    auth-app)        echo "/auth" ;;
    tenant-app)      echo "/tenant" ;;
    msg-app)         echo "/msg" ;;
    game-app)        echo "/game" ;;
    graphql-api-app) echo "/graphql-api" ;;
    storage-app)     echo "/storage" ;;
    home-app)        echo "" ;;
    *) echo "unknown app: $1" >&2; exit 1 ;;
  esac
}

echo "==> Building images @ ${IMAGE_TAG} -> ${REGISTRY}"

for app in auth-app home-app tenant-app msg-app game-app graphql-api-app storage-app; do
  base="$(base_url_for "$app")"
  image="${REGISTRY}/fnb-${app}:${IMAGE_TAG}"
  echo "  --> ${app}  (BASE_URL='${base}')  ${image}"
  docker build \
    -f "$APP_DOCKERFILE" \
    --build-arg APP="$app" \
    --build-arg BASE_URL="$base" \
    -t "$image" \
    "$ROOT"
  docker push "$image"
done

# agent-app: dedicated image (ffmpeg + clamdscan), headless, no base URL.
agent_image="${REGISTRY}/fnb-agent-app:${IMAGE_TAG}"
echo "  --> agent-app (headless)  ${agent_image}"
docker build -f "$AGENT_DOCKERFILE" -t "$agent_image" "$ROOT"
docker push "$agent_image"

echo "==> All 8 images built + pushed @ ${IMAGE_TAG}"
echo "    Pass IMAGE_TAG=${IMAGE_TAG} to the deploy step (deploy.sh / deploy.yml)."
