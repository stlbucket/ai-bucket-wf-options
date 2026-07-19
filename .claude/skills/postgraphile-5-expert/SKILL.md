---
name: postgraphile-5-expert
description: >
  Expert in PostGraphile 5 — automatic GraphQL API generation from PostgreSQL schemas.
  Triggers for any task involving PostGraphile 5: configuration, schema design for PostGraphile,
  smart tags, behaviors, inflection, security (RLS/JWT/pgSettings), plugins, extending the schema,
  migrating from V4, troubleshooting, and database design decisions that affect the GraphQL API shape.
  Use this skill whenever the user is working with PostGraphile 5 or designing a PostgreSQL schema
  that will be exposed via PostGraphile.
---

# PostGraphile 5 Expert

You are an expert in PostGraphile 5 — a tool that auto-generates a GraphQL API from a PostgreSQL
database schema. PostGraphile 5 is a complete rewrite of V4, powered by the Grafast execution engine.

## Critical Architecture Concepts

**PostGraphile 5 is fundamentally different from V4.** If the user has V4 experience, flag key differences:
- Config file: `graphile.config.mjs` with preset objects (not CLI flags or `createPostGraphileSchema`)
- New runtime: Grafast (replaces field resolvers with "plan" functions)
- HTTP layer: Grafserv (framework adaptor, not Express middleware directly)
- Smart tags: `@behavior` replaces `@omit`, `@simpleCollections`, `@sortable`, `@filterable`

**Core packages:**
- `postgraphile` — main package (includes Grafast, Grafserv, graphile-build)
- `@graphile/simplify-inflection` — highly recommended; simplifies relation names
- `postgraphile/presets/amber` — the standard V5 preset (use this as your base)

## Quick Reference: Common Tasks

| Task | Go-to approach |
|------|---------------|
| Rename a table/column in GraphQL | `@name` smart tag or inflection plugin |
| Hide a table/column/mutation | `@behavior -*` smart tag |
| Enable list instead of connection | `@behavior +list -connection` or `defaultBehavior` |
| Add computed field | PostgreSQL function with `(row table_name)` first arg |
| Custom query/mutation | PostgreSQL function (STABLE → query, VOLATILE → mutation) |
| Row-level security | PostgreSQL RLS policies + pgSettings |
| Session auth (Nuxt) | `nuxt-auth-utils` + `getUserSession(event)` in `grafast.context()` |
| Auth from Nuxt middleware claims (fnb) | Read `event.context.claims` in `grafast.context()` + `buildJwtPayload()` → pgSettings |
| JWT auth | `pgJwtTypes` in preset config + `pgSettings` middleware |
| Rename relation | `@fieldName` / `@foreignFieldName` smart tags |
| Virtual FK on view | `@foreignKey (col) references other_table` smart tag |
| Mark view column non-null | `@notNull` smart tag |
| Mount in Nuxt/Nitro | `grafserv` from `postgraphile/grafserv/h3/v1` |
| Deploy behind path-prefix proxy | Set ALL grafserv path options explicitly — see path-prefix section below |
| Serve Ruru static assets behind prefix | Separate nginx location + Nitro plugin `serv.addTo(nitroApp.h3App)` |
| SSE stream for schema watch | Separate Nuxt route `server/api/graphql/stream.ts` → `serv.handleEventStreamEvent(event)` |

## Workflow: Approaching PostGraphile Tasks

**For schema design questions** (how to model X in Postgres for PostGraphile):
1. Read `references/schema-design.md` for patterns
2. Prefer tables over views when mutations are needed
3. Use functions for business logic and computed fields
4. Consider how foreign keys shape relation names (use `@graphile/simplify-inflection`)

**For configuration questions** (presets, behaviors, options):
1. Read `references/configuration.md`
2. Start with `PostGraphileAmberPreset` and extend
3. Use `graphile config print` to debug what's active

**For customization questions** (smart tags, behaviors, naming):
1. Read `references/customization.md`
2. Smart tags via SQL comments are simplest; a `.jsonc` tags file avoids DB comments
3. Use `npx graphile behavior debug` to trace behavior resolution

**For security questions** (auth, RLS, permissions):
1. Read `references/security.md`
2. Always design security at the database layer (RLS), not just application layer
3. Pass user identity via `pgSettings`, read with `current_setting()` in SQL

**For extending the schema** (custom types, fields, plugins):
1. Read `references/extending.md`
2. For simple additions: use `extendSchema()` helper
3. For naming overrides: use inflection plugins
4. For complex custom logic: raw Graphile Build plugins

## Reference Files

- `references/configuration.md` — graphile.config, presets, pgServices, Grafserv, library usage
- `references/schema-design.md` — PostgreSQL → GraphQL mapping: tables, views, functions, polymorphism
- `references/customization.md` — Smart tags, behaviors, inflection — complete reference
- `references/security.md` — RLS, JWT, pgSettings, authentication patterns
- `references/extending.md` — Plugins, extendSchema(), plan functions, Grafast basics

## Key Constraints to Always Mention

- Requires **Node.js 22+** (24+ recommended) and **PostgreSQL 14+**
- VOLATILE functions → mutations; STABLE/IMMUTABLE functions → queries
- Functions must use **named arguments** for clean GraphQL exposure
- Views lack PK/FK/NOT NULL inference — must add via smart tags
- CRUD mutations are **not** generated for polymorphic types; use custom mutations
- `@graphile/simplify-inflection` is strongly recommended for all projects
- **Nuxt/Nitro:** requires `nitro.experimental.websocket = true` for WebSocket/subscription support
- **Nuxt/Nitro:** use `postgraphile/grafserv/h3/v1`; mount via API route (`serv.handleGraphQLEvent`) or Nitro plugin (`serv.addTo(nitroApp.h3App)`)
- **H3 context:** extract `H3Event` from `requestContext.h3v1?.event` (HTTP) or construct from `requestContext.ws.request._req` (WebSocket)
- **Dual pools:** use `authPgPool` (unprivileged) for PostGraphile, `rootPgPool` (superuser) for session management
- **Grafserv path options are independent:** `graphqlPath`, `eventStreamPath`, and `graphiqlStaticPath` each have their own defaults — `eventStreamPath` is NOT derived from `graphqlPath`. When deploying behind a path prefix, every option must be set explicitly.

## Nuxt + Path-Prefix Proxy Deployment

When nginx routes to a Nuxt app **without stripping the prefix** (e.g. `location /graphql-api { proxy_pass ...; }`) and the app uses `NUXT_APP_BASE_URL=/graphql-api`, three grafserv problems arise — each caused by a different path option having an independent default.

### Problem 1 — `graphqlPath` doesn't include the base URL

Ruru embeds `graphqlPath` in its HTML as the GraphQL endpoint. If it's `/api/graphql`, the browser (at `localhost/graphql-api/...`) will POST to `/api/graphql` — nginx routes that elsewhere.

**Fix:** derive from `NUXT_APP_BASE_URL`:
```typescript
const baseUrl = process.env.NUXT_APP_BASE_URL ?? ''

grafserv: {
  graphqlPath: `${baseUrl}/api/graphql`,
}
```
In Docker: `/graphql-api/api/graphql`. In local dev (no env var): `/api/graphql`. Both work.

### Problem 2 — Ruru static assets (`/ruru-static/`) go to the wrong upstream

`graphiqlStaticPath` defaults to `/ruru-static/` — an absolute path with **no** base URL prefix. Ruru's HTML references its JS and CSS there. nginx routes `/ruru-static/` to the default app (not the graphql-api app), which returns a JSON 404. `X-Content-Type-Options: nosniff` blocks the browser from running it as JS.

Even after fixing nginx routing, Nuxt's router (mounted at `h3App.use('/graphql-api', router.handler)`) can't handle `/ruru-static/` requests — they arrive without the prefix and bypass Nuxt entirely.

**Fix — two parts:**

1. Add an nginx location **before** `location /`:
```nginx
location /ruru-static {
    proxy_pass http://graphql-api-app:3000;
}
```

2. Add a Nitro plugin — `server/plugins/postgraphile.ts`:
```typescript
import { serv } from '../graphserv/serv'

export default defineNitroPlugin(async (nitroApp) => {
  await serv.addTo(nitroApp.h3App)
})
```

`serv.addTo(nitroApp.h3App)` registers grafserv's H3 router as a **catch-all** after Nuxt's router. Middleware order becomes:
```
1. h3App.use('/graphql-api', nuxtRouter)   ← Nuxt routes
2. h3App.use(grafservRouter)               ← grafserv catch-all (our plugin, added last)
```
`/ruru-static/ruru.js` skips step 1 (wrong prefix), hits grafserv in step 2 ✓. `event.path` is the original full path — no prefix stripping — so `getStaticFile` receives the correct `urlPath`.

Leave `graphiqlStaticPath` at the default `/ruru-static/` — no change needed there.

### Problem 3 — `eventStreamPath` doesn't include the base URL

`eventStreamPath` defaults to `/graphql/stream` regardless of what `graphqlPath` is set to. Ruru opens an EventSource there for schema-watch live reload; it fails with the same nginx routing mismatch.

**Fix — two parts:**

1. `server/graphile.config.ts`:
```typescript
grafserv: {
  graphqlPath:     `${baseUrl}/api/graphql`,
  eventStreamPath: `${baseUrl}/api/graphql/stream`,
}
```

2. Add `server/api/graphql/stream.ts`:
```typescript
import { eventHandler } from 'h3'
import { serv } from '../../graphserv/serv'

export default eventHandler((event) => serv.handleEventStreamEvent(event))
```
Nuxt strips the base URL from `/graphql-api/api/graphql/stream` and routes to this handler. No additional nginx config needed — `location /graphql-api` already covers it.

### Complete file layout for Nuxt path-prefix deployment

```
server/
├── graphile.config.ts          PostGraphile preset — all paths set from NUXT_APP_BASE_URL
├── graphserv/
│   ├── pgl.ts                  postgraphile(preset) singleton
│   └── serv.ts                 pgl.createServ(grafserv) singleton
├── plugins/
│   └── postgraphile.ts         serv.addTo(nitroApp.h3App) — Ruru static asset catch-all
└── api/
    ├── graphql.ts              handleGraphQLEvent + makeWsHandler
    └── graphql/
        └── stream.ts           handleEventStreamEvent (SSE for schema watch)
```

```typescript
// server/graphile.config.ts
import { buildJwtPayload } from '@function-bucket/fnb-db-access'  // fnb-specific; adapt for other projects (fnb's real graphile.config.ts assembles this payload inline)
import { H3Event } from 'h3'
import { ServerResponse } from 'node:http'

const baseUrl = process.env.NUXT_APP_BASE_URL ?? ''

grafserv: {
  graphqlPath:     `${baseUrl}/api/graphql`,
  eventStreamPath: `${baseUrl}/api/graphql/stream`,
  graphiql: true,
  watch: process.env.NODE_ENV !== 'production',
},
grafast: {
  explain: process.env.NODE_ENV !== 'production',
  async context(requestContext, args) {
    // Always spread args.contextValue to preserve pgSettings from earlier layers
    const pgSettings = {
      ...(args.contextValue?.pgSettings as Record<string, string | undefined>),
    }

    // HTTP: h3v1.event is populated by the grafserv H3 adaptor after Nuxt middleware runs
    // WebSocket: construct H3Event from raw request (middleware context not carried over for WS)
    const event =
      requestContext.h3v1?.event ??
      (requestContext.ws
        ? new H3Event(
            requestContext.ws.request._req,
            new ServerResponse(requestContext.ws.request._req),
          )
        : undefined)

    // In fnb, event.context.claims is populated by the Nuxt auth middleware before this runs.
    // In other projects, call getUserSession(event) or verify a Bearer token here instead.
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

```typescript
// server/api/graphql.ts
export default eventHandler({
  handler: (event) => serv.handleGraphQLEvent(event),
  websocket: serv.makeWsHandler(),
})
```

**Note on WebSocket subscriptions**: For WS, `requestContext.h3v1?.event` is not available — a fresh `H3Event` constructed from `requestContext.ws.request._req` carries no middleware context. Auth falls back to `anon`. To authenticate WS subscriptions, read the session cookie from the WS request headers and do a DB lookup directly in `grafast.context()`.

Reference: `.claude/specs/architecture-considerations/read-these/postgraphile-service-setup.md`
