# ══════════════════════════════════════════════════════════════════════════════
# fnb PRODUCTION env template — rendered to the box `.env` by render-env.mjs.
#
# render-env.mjs substitutes every placeholder from the deploy environment (Terraform outputs + the
# secret store) and FAILS LOUD if any is missing — the dev `${VAR:?}` contract, moved to render
# time (spec terraform-and-cicd.md §3). Derived URLs are COMPOSED here from ${DOMAIN} so DOMAIN is
# the only topology input. Lines with no ${...} are constants and pass through verbatim.
#
# The rendered .env is written root-only (chmod 600) to the box and is NEVER committed.
# ══════════════════════════════════════════════════════════════════════════════

# ─── Images (build step / registry) ──────────────────────────────────────────
REGISTRY=${REGISTRY}
IMAGE_TAG=${IMAGE_TAG}

# ─── Public topology (Caddy) ──────────────────────────────────────────────────
DOMAIN=${DOMAIN}
ACME_EMAIL=${ACME_EMAIL}
APP_ORIGIN=https://${DOMAIN}

# ─── Managed Postgres (Terraform outputs) ────────────────────────────────────
MANAGED_PG_HOST=${MANAGED_PG_HOST}
MANAGED_PG_PORT=${MANAGED_PG_PORT}
MANAGED_PG_ADMIN_USER=${MANAGED_PG_ADMIN_USER}
MANAGED_PG_ADMIN_PASSWORD=${MANAGED_PG_ADMIN_PASSWORD}
MANAGED_PG_ADMIN_DB=${MANAGED_PG_ADMIN_DB}
POSTGRES_DB=fnb
# App-role connection (scoped role — see superuser-database-url.plan.md; TLS required on managed PG).
# uselibpqcompat: node-postgres verifies certs under plain sslmode=require (libpq does not) and the
# managed-PG CA is not in the box trust store → SELF_SIGNED_CERT_IN_CHAIN. libpq-compat "require"
# = encrypt without verification (same posture as n8n's SSL_REJECT_UNAUTHORIZED=false). Hardening
# to verify-full with the mounted DO CA is tracked in plan 0570 (managed-pg-verify-full-tls —
# needs a deploy window). psql/sqitch (PG_URL/DB_URL) are
# real libpq — plain sslmode=require is already correct there.
DATABASE_URL=postgresql://${APP_PG_USER}:${APP_PG_PASSWORD}@${MANAGED_PG_HOST}:${MANAGED_PG_PORT}/fnb?uselibpqcompat=true&sslmode=require
PG_URL=postgresql://${APP_PG_USER}:${APP_PG_PASSWORD}@${MANAGED_PG_HOST}:${MANAGED_PG_PORT}/fnb?sslmode=require
DB_URL=db:pg://${APP_PG_USER}:${APP_PG_PASSWORD}@${MANAGED_PG_HOST}:${MANAGED_PG_PORT}/fnb?sslmode=require
# Ordered sqitch deploy list (constant — mirrors .env.example).
DEPLOY_PACKAGES=fnb-auth fnb-app fnb-n8n fnb-notify fnb-res fnb-msg fnb-todo fnb-poll fnb-loc fnb-storage fnb-location-datasets fnb-airports fnb-game
# PG login-role passwords (secret store). zitadel/n8n_engine created by pg-bootstrap; the
# n8n_worker role created by sqitch inside db-migrate.
ZITADEL_DB_PASSWORD=${ZITADEL_DB_PASSWORD}
N8N_ENGINE_DB_PASSWORD=${N8N_ENGINE_DB_PASSWORD}
N8N_WORKER_PG_PASSWORD=${N8N_WORKER_PG_PASSWORD}

# ─── Public URLs (browser-reachable, through Caddy on https) ──────────────────
NUXT_PUBLIC_AUTH_APP_URL=https://${DOMAIN}/auth
NUXT_PUBLIC_GRAPHQL_API_URL=https://${DOMAIN}/graphql-api/api/graphql
NUXT_PUBLIC_MSG_APP_URL=https://${DOMAIN}/msg
NUXT_PUBLIC_UPLOAD_URL=https://${DOMAIN}/storage/api/upload

# ─── Internal URLs (container network, server-to-server — unchanged from dev) ─
NUXT_AUTH_APP_INTERNAL_URL=http://auth-app:3000/auth
NUXT_MSG_APP_INTERNAL_URL=http://msg-app:3000/msg
N8N_INTERNAL_URL=http://n8n:5678
NUXT_ZITADEL_INTERNAL_URL=http://zitadel:8080

# ─── Object storage (managed — Spaces / S3; Terraform outputs + secret store) ─
S3_ENDPOINT=${S3_ENDPOINT}
S3_PUBLIC_BASE_URL=${S3_PUBLIC_BASE_URL}
S3_REGION=${S3_REGION}
S3_BUCKET=${S3_BUCKET}
S3_ACCESS_KEY=${S3_ACCESS_KEY}
S3_SECRET_KEY=${S3_SECRET_KEY}
S3_FORCE_PATH_STYLE=false

# ─── ClamAV (constant) ────────────────────────────────────────────────────────
CLAMAV_HOST=clamav
CLAMAV_PORT=3310

# ─── Asset-scan tunables (n8n asset-scan + reaper workflows; constants) ──────
ASSET_SCAN_MAX_WF_ATTEMPTS=3
ASSET_SCAN_STUCK_MINUTES=15
ASSET_SCAN_REAPER_CRON=*/15 * * * *

# ─── n8n workflow engine (sole engine, R22 — own https subdomain) ────────────
N8N_EXTERNALDOMAIN=n8n.${DOMAIN}
N8N_WEBHOOK_URL=https://n8n.${DOMAIN}/
NUXT_PUBLIC_N8N_EDITOR_URL=https://n8n.${DOMAIN}
N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
N8N_WEBHOOK_SECRET=${N8N_WEBHOOK_SECRET}
# anthropic-api-key n8n credential (game-event AI)
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
TZ=UTC

# ─── Notifications (spec D4: prod email = Resend, via its SMTP interface) ─────
# The fnb-smtp n8n credential renders from these. SMS stays log-sink (dispatch is
# Phase 5+ — Twilio vars land here when the send-notification sms branch does).
# Port 2465 (Resend's implicit-TLS fallback), NOT 465: DO blocks outbound 25/465/587 at the
# account level (verified from the box 2026-07-26); 2465/2587 are open. Same TLS mode as 465.
NOTIFY_SMTP_HOST=smtp.resend.com
NOTIFY_SMTP_PORT=2465
NOTIFY_SMTP_USER=resend
NOTIFY_SMTP_PASSWORD=${RESEND_API_KEY}
NOTIFY_SMTP_SECURE=true
NOTIFY_SMTP_DISABLE_STARTTLS=false

# ─── Session sealing ──────────────────────────────────────────────────────────
NUXT_SESSION_SECRET=${NUXT_SESSION_SECRET}

# ─── First-run setup gate (spec production-runtime.md §9.1) ───────────────────
# Gates /auth/api/setup/initialize in EVERY environment. do-env-build's
# bootstrap-identities step presents this token to create the site admin; the
# SITE_ADMIN_* / N8N_ADMIN_PASSWORD values themselves stay laptop-side in
# ~/.config/fnb/prod-secrets.env and are never rendered onto the box.
SETUP_TOKEN=${SETUP_TOKEN}

# ─── ZITADEL (identity provider — prod-hardened, own https subdomain) ─────────
ZITADEL_MASTERKEY=${ZITADEL_MASTERKEY}
ZITADEL_EXTERNALDOMAIN=id.${DOMAIN}
NUXT_ZITADEL_ISSUER=https://id.${DOMAIN}
NUXT_ZITADEL_SEED_FILE=/zitadel-seed/fnb-web-app.json
# Prod console admin (seeded by FirstInstance; the prod seed skips dev users). Secret store.
ZITADEL_ADMIN_USERNAME=${ZITADEL_ADMIN_USERNAME}
ZITADEL_ADMIN_EMAIL=${ZITADEL_ADMIN_EMAIL}
ZITADEL_ADMIN_PASSWORD=${ZITADEL_ADMIN_PASSWORD}

# ─── Third-party ──────────────────────────────────────────────────────────────
MAPBOX_ACCESS_TOKEN=${MAPBOX_ACCESS_TOKEN}

# ─── Sentry (error/perf monitoring — project `fnb`) ──────────────────────────
# Public DSN (safe to commit; it ships to the browser). Consumed at RUNTIME by
# every app container (NUXT_PUBLIC_SENTRY_DSN + SENTRY_DSN both read this). Empty
# disables the SDK. NOTE: production source-map upload is a BUILD-time concern —
# set SENTRY_AUTH_TOKEN (an org auth token) in the image-build/CI environment so
# @sentry/nuxt can upload maps; it is NOT needed here at runtime.
SENTRY_DSN=https://969ccc37e695de913a793da4cae4c0dc@o4511774543839232.ingest.us.sentry.io/4511774666457088
