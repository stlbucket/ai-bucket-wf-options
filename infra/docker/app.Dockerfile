# Production image for the routed Nuxt apps (auth, home, tenant, msg, game, graphql-api, storage).
# Selected per app: --build-arg APP=<slug> --build-arg BASE_URL=/<slug>  (home-app: no BASE_URL).
#
# NUXT_APP_BASE_URL is baked at BUILD time — Nuxt bakes app.baseURL into asset URLs, so the runtime
# value MUST equal the built value. This is the highest-risk part of the prod pipeline:
# .claude/specs/deployment/production-runtime.md §3.1 + §10. The dev bind-mount hides it.
#
# Nuxt builds to a self-contained .output/ (Nitro bundles the exact deps it needs), so the runtime
# image is just Node + .output — no node_modules, no pnpm, no workspace. The dev .dockerignore keeps
# node_modules/.output/.nuxt out of the build context.

# ---- builder: install the workspace once, build the selected app (turbo builds ^build deps first) ----
FROM node:22-alpine AS builder
# pnpm pinned to the repo's packageManager field (package.json)
RUN corepack enable && corepack prepare pnpm@10.17.0 --activate
WORKDIR /app

# Manifests + lockfile + root tsconfig (packages/*/tsconfig.json extend ../../tsconfig.json) first,
# so `pnpm install` layer-caches across the 8 app builds.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json tsconfig.json ./
COPY packages ./packages
COPY apps ./apps
RUN pnpm install --frozen-lockfile

# Per-app build with the base URL baked in. `turbo run build --filter` respects the root build
# task's `dependsOn: ^build`, so the compiled packages (fnb-types, db-access, graphql-client-api,
# auth-server, auth-ui) build before the app.
ARG APP
ARG BASE_URL=""
ENV NUXT_APP_BASE_URL=${BASE_URL}
RUN pnpm exec turbo run build --filter=@function-bucket/fnb-${APP}

# ---- runtime: ship ONLY the selected app's .output ----
FROM node:22-alpine AS runtime
ARG APP
WORKDIR /app
ENV NODE_ENV=production NUXT_HOST=0.0.0.0 NUXT_PORT=3000
COPY --from=builder /app/apps/${APP}/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
