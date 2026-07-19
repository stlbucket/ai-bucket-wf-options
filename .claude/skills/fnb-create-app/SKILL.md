---
name: fnb-create-app
description: >
  Scaffolds a new Nuxt 4 app within the fnb monorepo. Use this skill when the user wants to
  add a new app under apps/ — it creates the full skeleton: package.json, nuxt.config.ts,
  tsconfig.json, server boilerplate, Docker service, and nginx location block.
  Triggers include: "create a new app", "scaffold loc-app", "add a new app to the monorepo",
  or any request to bootstrap a fresh Nuxt app inside fnb. WebSocket support is optional.
---

# fnb Create App

You scaffold new Nuxt 4 applications within the fnb monorepo. You create the minimal
boilerplate needed to get an app running — the scaffold that specs describe features inside of.

---

## Required Inputs

Before writing any files, confirm these three values with the user:

1. **App slug** — short lowercase name, e.g. `loc` → creates `apps/loc-app/`, package name
   `@function-bucket/fnb-loc-app`
2. **nginx path prefix** — the URL path nginx will route to this app, e.g. `/loc`
3. **WebSocket support?** — yes/no. If yes, **extend `@function-bucket/fnb-msg-layer`** (it already
   provides `pg-notify-bridge.ts`, `getWsUpgradeClaims.ts`, the `_ws` route, and the `withClaims`
   incremental-read endpoint) and enable `nitro.experimental.websocket: true`. Only hand-roll WS
   server files if you deliberately need a non-msg channel.

The app extends `@function-bucket/fnb-tenant-layer` (default) or `@function-bucket/fnb-msg-layer`
(WebSocket) unless the user specifies otherwise. Extending a layer means the app **inherits the
auth middleware** (`applyEventClaims` → `event.context.claims`) — a new app does not define its own.

---

## Files to Create

All paths relative to the monorepo root. Replace `<slug>` with the app slug throughout.

### `apps/<slug>-app/package.json`

```json
{
  "name": "@function-bucket/fnb-<slug>-app",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "nuxt build",
    "dev": "nuxt dev",
    "preview": "nuxt preview",
    "postinstall": "nuxt prepare",
    "lint": "eslint .",
    "typecheck": "nuxt typecheck"
  },
  "dependencies": {
    "@iconify-json/lucide": "catalog:",
    "@iconify-json/simple-icons": "catalog:",
    "@nuxt/ui": "catalog:",
    "@function-bucket/fnb-tenant-layer": "workspace:*",
    "@function-bucket/fnb-graphql-client-api": "workspace:*",
    "@function-bucket/fnb-types": "workspace:*",
    "@urql/vue": "catalog:",
    "@vueuse/core": "catalog:",
    "nuxt": "catalog:"
  },
  "devDependencies": {
    "@nuxt/eslint": "catalog:",
    "eslint": "catalog:",
    "typescript": "catalog:",
    "vue-tsc": "catalog:"
  },
  "packageManager": "pnpm@10.33.0"
}
```

Copy the `packageManager` value from an existing app — it moves with pnpm upgrades. Data access
is **GraphQL** (urql → PostGraphile); there is no `db-types`/`pg`/`createDb`. Declare `@nuxt/ui`
directly (pnpm doesn't hoist it — `import type { TableColumn } from '@nuxt/ui'` fails
otherwise). The two `@iconify-json/*` collections are **required in every app** — without them
`i-lucide-*` icons render blank in Docker. `@vueuse/core` and `@urql/vue` are required in every
app (auth-layer's `vite.optimizeDeps.include` resolves from the app context — global-rules R24).
`"catalog:"` deps resolve via the default catalog in `pnpm-workspace.yaml`; new shared deps get
a catalog entry first (`.claude/specs/workspace-dependency-integrity-pattern.md`). Gate with
`pnpm dep-audit`.

If WebSocket support (rare — prefer extending `@function-bucket/fnb-msg-layer`, which already
provides the WS infra): extend msg-layer instead of tenant-layer, and add `"@function-bucket/fnb-db-access": "workspace:*"`,
`"pg": "catalog:"`, `"@types/pg": "catalog:"`, `"consola": "^3.4.2"`, `"h3": "catalog:"`,
`"nitropack": "^2.13.3"` to dependencies.

### `apps/<slug>-app/nuxt.config.ts`

```typescript
export default defineNuxtConfig({
  extends: ['@function-bucket/fnb-tenant-layer'],

  modules: ['@nuxt/eslint'],

  devtools: { enabled: true },

  runtimeConfig: {
    // '' sentinels — real values come from NUXT_PUBLIC_* runtime env (docker-compose ${VAR:?}).
    // Do not put defaults here: host `pnpm build` evaluates this config without the dev env.
    public: {
      authAppUrl: '',
      graphqlApiUrl: '',
    },
  },

  compatibilityDate: '2025-01-15',

  vite: {
    server: {
      // Only configure HMR when the browser-facing port is provided (dev via compose); host
      // `pnpm build` has no VITE_HMR_CLIENT_PORT and must not hard-require it.
      ...(process.env.VITE_HMR_CLIENT_PORT
        ? { hmr: { clientPort: parseInt(process.env.VITE_HMR_CLIENT_PORT) } }
        : {}),
    },
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs',
      },
    },
  },
})
```

If WebSocket support: add `nitro: { experimental: { websocket: true } }`.

If the app needs to call another internal app (e.g. msg-app), add more `''` sentinels to
runtimeConfig (e.g. `msgAppInternalUrl` at the top level, `msgAppUrl` under `public`) and supply
the real values through the compose service's environment.

### `apps/<slug>-app/tsconfig.json`

```json
{
  "files": [],
  "references": [
    { "path": "./.nuxt/tsconfig.app.json" },
    { "path": "./.nuxt/tsconfig.server.json" },
    { "path": "./.nuxt/tsconfig.shared.json" },
    { "path": "./.nuxt/tsconfig.node.json" }
  ]
}
```

### `apps/<slug>-app/app/plugins/urql.client.ts` (required — GraphQL client)

Every feature app needs the urql client so composables resolve. Copy from an existing app:

```typescript
import urql, { Client, cacheExchange, fetchExchange, mapExchange } from '@urql/vue'

export default defineNuxtPlugin((nuxtApp) => {
  const { public: pub } = useRuntimeConfig()
  const client = new Client({
    url: pub.graphqlApiUrl,
    preferGetMethod: false,              // PostGraphile rejects GET with 405
    exchanges: [
      cacheExchange,
      mapExchange({ onError(error) { console.error('[urql]', error) } }),
      fetchExchange,
    ],
  })
  nuxtApp.vueApp.use(urql, client)
  return { provide: { urqlClient: client } } // reachable outside setup (useAuth().refreshClaims)
})
```

### No `server/` directory for a default app

A tenant-layer app has **no `server/` dir**. Data access is GraphQL (composables re-exported from
`@function-bucket/fnb-graphql-client-api`); the per-request auth middleware
(`applyEventClaims` → `event.context.claims`) is **inherited from tenant-layer**. Do not scaffold
`server/plugins/db.ts`, `server/middleware/auth.ts`, or `getEventClaims.ts` — `createDb`/db-types/Kysely
no longer exist.

### WebSocket-only: extend `@function-bucket/fnb-msg-layer`

The WebSocket infrastructure lives in msg-layer and is inherited by extending it: `pg-notify-bridge.ts`,
the `_ws/topics/[id]/messages` route, `getWsUpgradeClaims.ts`, and the `withClaims` incremental-read
endpoint (`.../messages/[msgId].get.ts`). A new WS app normally just sets
`extends: ['@function-bucket/fnb-msg-layer']` and adds nothing server-side.

If you must hand-roll WS auth outside msg-layer, mirror the current
`packages/msg-layer/server/utils/getWsUpgradeClaims.ts` — it takes **only `headers`** and calls
`profileClaimsForUser(userId)` from `@function-bucket/fnb-db-access` (raw pg, its own pool — no
Kysely, no `db` parameter):

```typescript
import { profileClaimsForUser } from '@function-bucket/fnb-db-access'
// parse the `session` cookie from headers → userId
export async function getWsUpgradeClaims(headers: Headers) {
  // ...extract userId from the `session` cookie...
  if (!userId) return { user: undefined, claims: undefined }
  try {
    const claims = await profileClaimsForUser(userId)
    return claims ? { user: { id: userId }, claims } : { user: undefined, claims: undefined }
  } catch {
    return { user: undefined, claims: undefined } // DB error on upgrade → treat as unauthenticated
  }
}
```
For the pg-notify bridge, prefer inheriting msg-layer's; only copy
`packages/msg-layer/server/plugins/pg-notify-bridge.ts` verbatim if building a standalone WS app
(it is generic — channel/peer management is table-agnostic).

---

## Files to Update

### `docker-compose.yml`

**1. Add a named volume** in the `volumes:` top-level section:
```yaml
  node_modules_<slug>_app:
```

**2. Add a mount** to the `pnpm-install` service volumes list:
```yaml
      - node_modules_<slug>_app:/app/apps/<slug>-app/node_modules
```

**3. Add a new service** (copy the `home-app` service block as the template; adjust name,
filter, env, and volume):
```yaml
  <slug>-app:
    build:
      context: .
      dockerfile: apps/auth-app/Dockerfile
    networks:
      - fnb-network
    depends_on:
      pnpm-install:
        condition: service_completed_successfully
      db-migrate:
        condition: service_completed_successfully
      packages-watch:
        condition: service_healthy
    environment:
      NODE_ENV: "${NODE_ENV:?}"
      NUXT_HOST: "0.0.0.0"
      NUXT_PORT: "3000"
      NUXT_APP_BASE_URL: "/<slug>"
      NUXT_PUBLIC_AUTH_APP_URL: "${NUXT_PUBLIC_AUTH_APP_URL:?}"
      NUXT_PUBLIC_GRAPHQL_API_URL: "${NUXT_PUBLIC_GRAPHQL_API_URL:?}"
      NUXT_AUTH_APP_INTERNAL_URL: "${NUXT_AUTH_APP_INTERNAL_URL:?}"
      NUXT_SESSION_SECRET: "${NUXT_SESSION_SECRET:?}"
      DATABASE_URL: "${DATABASE_URL:?}"
      VITE_HMR_CLIENT_PORT: "${VITE_HMR_CLIENT_PORT:?}"
    volumes:
      - .:/app
      - node_modules_root:/app/node_modules
      - node_modules_<slug>_app:/app/apps/<slug>-app/node_modules
    working_dir: /app
    command: ["sh", "-c", "pnpm --filter @function-bucket/fnb-<slug>-app exec nuxt dev --host 0.0.0.0 --port 3000"]
```

**4. Add the new service to the `nginx` depends_on list.**

### `docker/nginx.conf`

Add a location block **before** the catch-all `location /` block:
```nginx
    location /<slug> {
        proxy_pass http://<slug>-app:3000;
    }
```

---

## No server is the norm

Default (tenant-layer) apps read data via GraphQL composables and have **no `server/` directory** —
this is the common case, not an exception. The only apps with a `server/` are the auth root of trust
(`auth-app`), the PostGraphile server (`graphql-api-app`), and the WebSocket infra (`msg-layer`).
`DATABASE_URL` in the docker service block is harmless but unused by a plain GraphQL feature app.

---

## After Scaffolding

Run `pnpm install` from the monorepo root so pnpm resolves the new workspace package, then
`pnpm build` as the gate (repo-wide `pnpm lint` is known-broken). **Do not** bring the Docker
environment up or down yourself — new per-app deps and the new compose service need a full
down/up cycle, and env restarts are the user's call: stop and ask them, then verify read-only.

This skill ends at the running skeleton. Features inside the app (pages, composables, GraphQL
operations, DB work) → skill `fnb-stack-implementor`, spec-first per `fnb-stack-spec`.
