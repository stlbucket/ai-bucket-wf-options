---
name: graphql-api-app-server-pattern
description: How PostGraphile 5 is wired into Nitro (h3) — graphile.config.ts, pgl/serv, mutation hooks, auth middleware, and WebSocket subscriptions.
metadata:
  type: reference
---

## Status
Implemented — reverse-engineered from the existing codebase.

---

## Overview

PostGraphile 5 runs as a Nitro server plugin, mounted directly onto h3 via `grafserv`. It does not run as a standalone process. All HTTP and WebSocket traffic hits Nuxt Nitro first, passes through auth middleware, then reaches PostGraphile.

---

## File Responsibilities

### `server/graphile.config.ts`

The single source of truth for the PostGraphile configuration. Exports a `GraphileConfig.Preset`.

**Plugins:**
```ts
plugins: [TagsFilePlugin, ...mutationHooks]
```
- `TagsFilePlugin` — reads `postgraphile.tags.json5` for table/column smart-tag overrides
- `mutationHooks` — array of `makeWrapPlansPlugin` instances (see mutation hooks section)

**Extends:**
```ts
extends: [
  PostGraphileAmberPreset,           // base PostGraphile 5 preset
  PgSimplifyInflectionPreset,        // simplifies generated type/field names
  makeV4Preset({
    simpleCollections: 'both',       // exposes both connection and list variants
    disableDefaultMutations: true,   // no auto CRUD; all mutations are custom functions
    dynamicJson: true                // JSON columns returned as JS objects, not strings
  })
]
```

**Schemas exposed:**
```ts
schemas: ['app', 'app_api', 'msg', 'msg_api', 'loc', 'loc_api', 'todo', 'todo_api', 'agent', 'agent_api', 'storage', 'location_datasets', 'location_datasets_api', 'airports', 'airports_api', 'res', 'res_api']
```

**Grafserv config:**
```ts
grafserv: {
  graphqlPath: `${baseUrl}/api/graphql`,
  eventStreamPath: `${baseUrl}/api/graphql/stream`,
  graphiql: true,
  watch: process.env.NODE_ENV !== 'production'    // hot-reload schema in dev
}
```

**Context function (`grafast.context`):**

Runs on every request. Pulls claims from `event.context.claims` (populated by auth middleware) and sets PostgreSQL session variables:

```ts
// Authenticated:
pgSettings.role = 'authenticated'
pgSettings['request.jwt.claims'] = JSON.stringify({
  email, display_name,
  user_metadata: { profile_id, tenant_id, resident_id, actual_resident_id, permissions }
})

// Unauthenticated:
pgSettings.role = 'anon'
```

WebSocket connections: auth middleware doesn't run for WS upgrades, so the context fn reconstructs an H3Event manually from `requestContext.ws.request._req`:
```ts
const event = requestContext.h3v1?.event
  ?? (requestContext.ws
    ? new H3Event(requestContext.ws.request._req, new ServerResponse(requestContext.ws.request._req))
    : undefined)
```

---

### `server/graphserv/pgl.ts`

```ts
import { postgraphile } from 'postgraphile'
import preset from '../graphile.config'
export const pgl = postgraphile(preset)
```

Creates the PostGraphile instance. Imported by `serv.ts` and the `postgraphile.ts` Nitro plugin.

---

### `server/graphserv/serv.ts`

```ts
import { grafserv } from 'postgraphile/grafserv/h3/v1'
import { pgl } from './pgl'
export const serv = pgl.createServ(grafserv)
```

Creates the grafserv handler (h3 adaptor). Imported by:
- `server/plugins/postgraphile.ts` — mounts it onto the Nitro h3 app
- `server/api/graphql.ts` — handles individual route events

---

### `server/plugins/postgraphile.ts`

```ts
export default defineNitroPlugin(async (nitroApp) => {
  await serv.addTo(nitroApp.h3App)
})
```

Mounts PostGraphile/grafserv as a middleware on the h3 app at startup. This makes the GraphQL endpoint available at all configured paths.

---

### Workflows — no worker anywhere (agentic engine, 2026-07-17)

graphql-api-app runs no job queue and no workflow engine. Workflows run in the headless
`apps/agent-app` (R22; spec `.claude/specs/agentic-workflow-engine/`); this app's only workflow
surface is the `triggerWorkflow` extendSchema plugin (below).

---

### `server/api/graphql.ts`

```ts
export default eventHandler({
  handler: (event) => serv.handleGraphQLEvent(event),
  websocket: serv.makeWsHandler(),
})
```

Handles both HTTP (POST) and WebSocket (upgrade) for the GraphQL endpoint. Registered at `/api/graphql` by Nuxt file-based routing.

---

### `server/api/graphql/stream.ts`

```ts
export default eventHandler(event => serv.handleEventStreamEvent(event))
```

Handles GET `/api/graphql/stream` for Server-Sent Events (SSE) subscriptions.

---

### Auth middleware — inherited from tenant-layer (no bespoke file here)

graphql-api-app extends `@function-bucket/fnb-tenant-layer`, so it inherits that layer's
`server/middleware/auth.ts`, which calls `applyEventClaims(event)` on every request. There is **no**
`server/middleware/auth.ts` and no bespoke `pg.Pool`/`parsePgArray` in graphql-api-app itself.

The chain (see `graphql-api-pattern.md` → Auth Context):
- `applyEventClaims` (`packages/auth-layer/server/utils/applyEventClaims.ts`) → `getEventClaims`
  reads the httpOnly `session` cookie's `id` → `currentProfileClaims(userId)`
  (`@function-bucket/fnb-db-access`, raw pg over its own pool; `camelCaseKeys` handles snake_case /
  nested composites) → sets `event.context.{ user, claims }`.
- The `H3EventContext` augmentation (`user?: { id }`, `claims?: ProfileClaims`) is declared once in
  `applyEventClaims.ts`; `ProfileClaims` (incl. `modules`) is the hand-written `db-access` type.
- If there is no `session` / no claims row, `event.context.claims` is undefined and
  `grafast.context` falls back to `role = 'anon'`.

---

## extendSchema Plugins (`server/graphile/`)

The retired `server/api/mutation-hooks/` directory (queueWorkflow wrap-plan + `_scheduleUows`
lazy producer) is replaced by extendSchema plugins registered in `graphile.config.ts` `plugins`:

### `server/graphile/trigger-workflow.plugin.ts`

`makeExtendSchemaPlugin`: adds `Mutation.triggerWorkflow(workflowKey, inputData) →
TriggerWorkflowResult { accepted, runId }`. R7-thin transport:
1. `context().get('claims')` — the grafast context carries `claims` (set in
   `graphile.config.ts`) — 401-parity error when absent.
2. Static allow-map `{ 'sync-breweries': null, 'sync-airports': null, exerciser:
   'p:app-admin-super' }` (`null` = any authenticated user). `asset-scan` is deliberately
   absent — only the storage upload endpoint fires it.
3. POST `{ ...inputData, tenantId, profileId }` to
   `${AGENT_INTERNAL_URL}/api/trigger/<key>` with the `X-Fnb-Trigger-Secret` header.
4. Pass `{ accepted, runId }` through.

### `server/graphile/asset-download-url.plugin.ts`

Computed nullable `Asset.downloadUrl` (presign/public URL — see the asset-storage spec).

---

## `postgraphile.tags.json5`

Smart tag overrides for PostGraphile. Currently only adds a description to the `permission` table class:
```json5
{
  version: 1,
  config: {
    class: {
      permission: {
        description: "A permission that a license can allow."
      }
    }
  }
}
```

---

## Adding a New Mutation Hook

To add a side-effect that fires after a PostGraphile mutation:

1. Create `server/api/mutation-hooks/my-hook.ts`:
```ts
import { makeWrapPlansPlugin } from 'graphile-utils'
import { sideEffect } from 'grafast'

export default makeWrapPlansPlugin({
  Mutation: {
    myMutation: (plan) => {
      const $result = plan()
      sideEffect($result, async (result: any) => {
        // do side effect with result
      })
      return $result
    }
  }
}, { name: 'MyMutationPlugin', version: '1.0.0' })
```

2. Import and add to `server/api/mutation-hooks/index.ts`:
```ts
import myHook from './my-hook.js'
export default [queueWorkflowPlugin, myHook]
```

The plugin array is spread into `plugins: [TagsFilePlugin, ...mutationHooks]` in `graphile.config.ts`.
