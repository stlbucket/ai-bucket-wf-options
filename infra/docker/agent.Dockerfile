# Production image for the headless agent-app (Claude Agent SDK workflow engine — R22).
# Headless: no Caddy route, no NUXT_APP_BASE_URL (reached only at http://agent-app:3000).
# Runtime adds ffmpeg (asset-scan thumbnailing) + clamav-clamdscan (streaming scans against the
# clamav service) on top of the .output copy — porting apps/agent-app/Dockerfile. Both binaries run
# as child processes INSIDE tool handlers only (server/lib/agent-tools/); the model has no exec tool.
#
# KEPT FOR NOW — agent-app + ClamAV removal is a later separate effort
# (.claude/specs/deployment/README.md D9 / production-runtime.md §10).

# ---- builder: same workspace build as app.Dockerfile, fixed to agent-app, no base URL ----
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.17.0 --activate
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json tsconfig.json ./
COPY packages ./packages
COPY apps ./apps
RUN pnpm install --frozen-lockfile
RUN pnpm exec turbo run build --filter=@function-bucket/fnb-agent-app

# ---- runtime: .output + the scan-tool system binaries ----
FROM node:22-alpine AS runtime
# ffmpeg + clamdscan (Alpine's clamav-clamdscan package == the spec's Debian `clamav-clients`)
RUN apk add --no-cache ffmpeg clamav-clamdscan
COPY apps/agent-app/clamd-remote.conf /etc/clamav/clamd-remote.conf
WORKDIR /app
ENV NODE_ENV=production NUXT_HOST=0.0.0.0 NUXT_PORT=3000
COPY --from=builder /app/apps/agent-app/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
