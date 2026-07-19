# PostGraphile 5 Service Setup

> **Note (fnb specifics updated):** the PostGraphile/grafast wiring here is current, but fnb-specific
> references have moved — `buildJwtPayload` now lives in `@function-bucket/fnb-db-access`
> (`src/jwt.ts`), the SQL helpers are in the `jwt` schema (not `auth`), and app-layer claims live in
> localStorage (not a cookie). fnb's real `graphile.config.ts` assembles the `request.jwt.claims`
> payload inline. See `.claude/specs/graphql-api-pattern.md`.

> **Intended audience**: Benjie Gillam and the Graphile team. If you're reading this — thank you
> for PostGraphile 5. The preset-based config, Grafast execution engine, and the clean H3/Nitro
> adaptor made this integration genuinely pleasant to wire up. The `handleGraphiqlStaticEvent` /
> `handleEventStreamEvent` method split on the H3 class was exactly the right abstraction once we
> understood the routing topology. Great work.

---

## Infrastructure Overview

The `fnb` monorepo runs several Nuxt 4 apps behind a single nginx reverse proxy on port 4000.
nginx does **path-based routing** with no prefix stripping — the full path is forwarded to each
upstream container:

```
nginx :80 (host :4000)
  /auth         → auth-app:3000
  /tenant       → tenant-app:3000
  /msg          → msg-app:3000
  /graphql-api  → graphql-api-app:3000
  /ruru-static  → graphql-api-app:3000   ← added during this effort
  /             → home-app:3000
```

Each app runs in its own Docker container on port 3000 and is given `NUXT_APP_BASE_URL` matching
its nginx prefix (e.g. `NUXT_APP_BASE_URL=/graphql-api`). Nuxt/Nitro uses this to strip the
prefix when matching server routes internally, but the underlying H3 `event.path` retains the
original full path as received from nginx.

PostgreSQL runs in a container named `function_bucket`, accessible at port 5444 from the host and
port 5432 from within the Docker network.

---

## Initial Implementation

The goal: add a PostGraphile 5 GraphQL API to the `graphql-api-app` Nuxt server, connecting as
the `postgres` superuser to get things working before adding authentication.

We used the **API route pattern** (not the Nitro plugin pattern) for the GraphQL endpoint:

### Files created

**`server/graphile.config.ts`** — PostGraphile preset (initial version, without auth):
```typescript
import { PostGraphileAmberPreset } from 'postgraphile/presets/amber'
import { PgSimplifyInflectionPreset } from '@graphile/simplify-inflection'
import { makePgService } from 'postgraphile/adaptors/pg'

const baseUrl = process.env.NUXT_APP_BASE_URL ?? ''

const preset: GraphileConfig.Preset = {
  extends: [PostGraphileAmberPreset, PgSimplifyInflectionPreset],
  pgServices: [
    makePgService({
      connectionString: process.env.DATABASE_URL ?? 'postgresql://postgres:1234@localhost:5444/fnb',
      schemas: ['auth', 'app', 'msg', 'my_app'],
    }),
  ],
  grafserv: {
    graphqlPath: `${baseUrl}/api/graphql`,
    eventStreamPath: `${baseUrl}/api/graphql/stream`,
    graphiql: true,
    watch: process.env.NODE_ENV !== 'production',
  },
  grafast: {
    explain: process.env.NODE_ENV !== 'production',
  },
}

export default preset
```

See [Authentication Integration](#authentication-integration) below for the complete version with `grafast.context()`.

**`server/graphserv/pgl.ts`** — PostGraphile instance:
```typescript
import { postgraphile } from 'postgraphile'
import preset from '../graphile.config'
export const pgl = postgraphile(preset)
```

**`server/graphserv/serv.ts`** — H3 grafserv adaptor:
```typescript
import { grafserv } from 'postgraphile/grafserv/h3/v1'
import { pgl } from './pgl'
export const serv = pgl.createServ(grafserv)
```

**`server/api/graphql.ts`** — Nuxt API route (main GraphQL endpoint):
```typescript
import { eventHandler } from 'h3'
import { serv } from '../graphserv/serv'

export default eventHandler({
  handler: (event) => serv.handleGraphQLEvent(event),
  websocket: serv.makeWsHandler(),
})
```

**`nuxt.config.ts`** — WebSocket support:
```typescript
nitro: {
  experimental: { websocket: true }
}
```

Packages added: `postgraphile`, `@graphile/simplify-inflection`, `pg`, `@types/pg`.

---

## Problems Encountered and Fixes

### Problem 1 — GraphQL endpoint URL missing base URL prefix

**Symptom**: Navigating to `/graphql-api/api/graphql` loaded the Ruru HTML but all GraphQL
queries failed. Network tab showed POSTs going to `/api/graphql` instead of
`/graphql-api/api/graphql`.

**Root cause**: `graphqlPath` was initially hardcoded to `'/api/graphql'`. Ruru embeds
`graphqlPath` in its HTML as the endpoint for all queries. The browser (at
`localhost:4000/graphql-api/...`) sent those POSTs to `localhost:4000/api/graphql`, which nginx
routed to **home-app** via `location /`, not to `graphql-api-app`.

**Fix**: Derive `graphqlPath` from `NUXT_APP_BASE_URL`:
```typescript
const baseUrl = process.env.NUXT_APP_BASE_URL ?? ''
graphqlPath: `${baseUrl}/api/graphql`
```
In Docker: `graphqlPath = '/graphql-api/api/graphql'` — nginx routes correctly.
In local dev (no env var): `graphqlPath = '/api/graphql'` — works without nginx.

---

### Problem 2 — Ruru static assets (ruru.js / ruru.css) MIME type errors

**Symptom**:
```
GET http://localhost:4000/ruru-static/ruru.js
NS_ERROR_CORRUPTED_CONTENT
Loading module was blocked: disallowed MIME type ("application/json")
```

**Root cause**: Ruru's HTML references its JS and CSS at `/ruru-static/ruru.js` — an absolute
path that doesn't include the `/graphql-api/` prefix. nginx routed `/ruru-static/` to home-app
via `location /`, which returned a JSON 404. The `X-Content-Type-Options: nosniff` header
(correctly) blocked the browser from treating JSON as JavaScript.

This is a two-layer problem:
1. nginx needs to route `/ruru-static/` to `graphql-api-app`
2. But even after that, `graphql-api-app`'s Nuxt router can't handle it — Nitro mounts
   Nuxt's router at `h3App.use('/graphql-api', router.handler)`, so requests arriving without
   the `/graphql-api/` prefix bypass the Nuxt router entirely

**Fix**: Two changes:

**nginx** — add a location block before `location /`:
```nginx
location /ruru-static {
    proxy_pass http://graphql-api-app:3000;
}
```

**`server/plugins/postgraphile.ts`** — new Nitro plugin:
```typescript
import { serv } from '../graphserv/serv'

export default defineNitroPlugin(async (nitroApp) => {
  await serv.addTo(nitroApp.h3App)
})
```

`serv.addTo(nitroApp.h3App)` registers grafserv's H3 router as a catch-all middleware on the H3
app. Nitro plugins run *after* Nuxt's core setup, so the middleware order becomes:

```
1. h3App.use('/graphql-api', nuxtRouter)   ← handles /graphql-api/* (Nuxt routes)
2. h3App.use(grafservRouter)               ← catch-all (our plugin, added last)
```

For `/ruru-static/ruru.js`:
- Step 1 skips (wrong prefix)
- Step 2 grafservRouter matches `router.get('/ruru-static/*', staticHandler)` ✓
- `event.path` is the original `/ruru-static/ruru.js` (no prefix stripping occurred)
- `getStaticFile({ staticPath: '/ruru-static/', urlPath: '/ruru-static/ruru.js' })` → `ruru.js` ✓

Note: `graphiqlStaticPath` stays at the default `/ruru-static/` — no change needed there.

---

### Problem 3 — SSE stream 404 (`/graphql/stream`)

**Symptom**:
```
GET http://localhost:4000/graphql/stream  404
Firefox can't establish a connection to the server at http://localhost:4000/graphql/stream
Ruru: EventSource is closed, reopening
```

**Root cause**: Grafserv's `eventStreamPath` defaults to `/graphql/stream` — it is **not**
derived from the configured `graphqlPath`. We had overridden `graphqlPath` but not
`eventStreamPath`, so Ruru tried to open an EventSource at the wrong URL (no base prefix, wrong
path segment). nginx routed it to home-app.

**Fix**: Explicitly set `eventStreamPath` alongside `graphqlPath`, and add a Nuxt route to serve it.

`server/graphile.config.ts`:
```typescript
eventStreamPath: `${baseUrl}/api/graphql/stream`
```

**`server/api/graphql/stream.ts`** — new Nuxt API route:
```typescript
import { eventHandler } from 'h3'
import { serv } from '../../graphserv/serv'

export default eventHandler((event) => serv.handleEventStreamEvent(event))
```

Nuxt routes `/api/graphql/stream` (after Nitro strips the base URL from
`/graphql-api/api/graphql/stream`) to this handler. nginx already routes
`/graphql-api/*` to `graphql-api-app` via `location /graphql-api`.

---

## Authentication Integration

### The gap: PostGraphile runs without claims unless `grafast.context()` is wired up

The auth middleware (`server/middleware/auth.ts`) already runs before every HTTP request and
populates `event.context.claims` with fresh `ProfileClaims` from the DB (via `getEventClaims()`).
But without a `grafast.context()` callback in the preset, PostGraphile executes every query
without `SET LOCAL ROLE authenticated` or `request.jwt.claims` — so RLS policies always see no
user and `_api` functions using `auth.enforce_permission()` always fail.

### Fix: add `grafast.context()` to the preset

Three new imports and the `context()` callback in the `grafast` section:

```typescript
import { buildJwtPayload } from '@function-bucket/fnb-db-access'
import { H3Event } from 'h3'
import { ServerResponse } from 'node:http'

// ...inside the preset:
grafast: {
  explain: process.env.NODE_ENV !== 'production',
  async context(requestContext, args) {
    // Spread pgSettings from earlier layers — never clobber
    const pgSettings = {
      ...(args.contextValue?.pgSettings as Record<string, string | undefined>),
    }

    // HTTP: h3v1.event is populated by the grafserv H3 adaptor after Nuxt middleware runs
    // WebSocket: construct H3Event from raw request (middleware context not carried over)
    const event =
      requestContext.h3v1?.event ??
      (requestContext.ws
        ? new H3Event(
            requestContext.ws.request._req,
            new ServerResponse(requestContext.ws.request._req),
          )
        : undefined)

    const claims = event?.context?.claims

    if (claims) {
      pgSettings.role = 'authenticated'
      pgSettings['request.jwt.claims'] = JSON.stringify(buildJwtPayload(claims))
    } else {
      pgSettings.role = 'anon'
    }

    return { ...args.contextValue, pgSettings }
  },
},
```

### How it works end-to-end

```
HTTP request
  → Nuxt auth middleware
      reads session cookie → DB lookup → event.context.claims (ProfileClaims)
  → grafserv → PostGraphile → grafast.context()
      reads event.context.claims
      builds JWT payload with buildJwtPayload(claims)
      returns pgSettings: { role: 'authenticated', 'request.jwt.claims': '...' }
  → PostgreSQL, before each query:
      SET LOCAL ROLE authenticated
      select set_config('request.jwt.claims', payload, true)
  → auth.uid(), auth.tenant_id(), auth.has_permission() — all read current_setting(...)
  → RLS policies and _api auth.enforce_permission() work correctly
```

### Key points

- `buildJwtPayload` is exported from `@function-bucket/fnb-db-access` (`src/jwt.ts`); fnb's real config assembles the payload inline in `graphile.config.ts`
- Always spread `args.contextValue` and `args.contextValue?.pgSettings` to preserve settings from earlier layers
- `role: 'authenticated'` triggers PostGraphile to `SET LOCAL ROLE authenticated` — this activates RLS
- The JWT payload must match the fnb shape (`{ email, display_name, user_metadata: { profile_id, tenant_id, resident_id, ... } }`) that the `auth.*()` SQL helper functions parse
- For WebSocket subscriptions, the constructed H3Event has no middleware context, so auth falls back to `role: 'anon'` — WS subscription auth requires a separate DB lookup in `grafast.context()` and is not yet implemented

---

## Key Lesson: Every grafserv Path Option Must Include the Base URL

Grafserv ships with defaults designed for apps mounted at `/` with no prefix:
- `graphqlPath = '/graphql'`
- `eventStreamPath = '/graphql/stream'`
- `graphiqlStaticPath = '/ruru-static/'`

These defaults are **independent** — `eventStreamPath` does not inherit from `graphqlPath`. In a
Nuxt app deployed at a path prefix via nginx (a common production pattern), every one of these
must be explicitly configured:

```typescript
const baseUrl = process.env.NUXT_APP_BASE_URL ?? ''

grafserv: {
  graphqlPath:       `${baseUrl}/api/graphql`,
  eventStreamPath:   `${baseUrl}/api/graphql/stream`,
  // graphiqlStaticPath stays at '/ruru-static/' — handled separately via nginx + Nitro plugin
}
```

`graphiqlStaticPath` is the exception: it cannot be moved under the base URL prefix because the
Nuxt router (mounted at that prefix) can't handle paths outside it. The solution is a separate
nginx `location /ruru-static` block plus `serv.addTo(nitroApp.h3App)` in a Nitro plugin to
serve those assets as a catch-all after the Nuxt router.

---

## Final Architecture

```
graphql-api-app/
└── server/
    ├── graphile.config.ts          PostGraphile preset — paths from NUXT_APP_BASE_URL + grafast.context() auth
    ├── graphserv/
    │   ├── pgl.ts                  postgraphile(preset) — singleton
    │   └── serv.ts                 pgl.createServ(grafserv) — H3 adaptor singleton
    ├── middleware/
    │   └── auth.ts                 getEventClaims() → event.context.claims (runs before every request)
    ├── plugins/
    │   └── postgraphile.ts         serv.addTo(nitroApp.h3App) — handles /ruru-static/* catch-all
    └── api/
        ├── graphql.ts              handleGraphQLEvent + makeWsHandler → POST/GET /api/graphql
        └── graphql/
            └── stream.ts           handleEventStreamEvent → GET /api/graphql/stream
```

**nginx** routes:
```nginx
location /graphql-api  { proxy_pass http://graphql-api-app:3000; }  # GraphQL + GraphiQL + stream
location /ruru-static  { proxy_pass http://graphql-api-app:3000; }  # Ruru JS/CSS static assets
```

**Public URLs** (through nginx on host port 4000):
| Endpoint | URL |
|----------|-----|
| GraphQL queries/mutations | `POST http://localhost:4000/graphql-api/api/graphql` |
| Ruru (GraphQL IDE) | `GET  http://localhost:4000/graphql-api/api/graphql` |
| Schema watch stream | `GET  http://localhost:4000/graphql-api/api/graphql/stream` |
| Static assets | `GET  http://localhost:4000/ruru-static/ruru.{js,css}` |
