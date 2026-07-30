# PostGraphile 5: Configuration Reference

## graphile.config.mjs (the config file)

PostGraphile 5 uses a config file instead of CLI flags. The standard setup:

```typescript
import { PostGraphileAmberPreset } from "postgraphile/presets/amber";
import { makePgService } from "postgraphile/adaptors/pg";
import { PgSimplifyInflectionPreset } from "@graphile/simplify-inflection";

const preset: GraphileConfig.Preset = {
  extends: [PostGraphileAmberPreset, PgSimplifyInflectionPreset],
  pgServices: [
    makePgService({
      connectionString: process.env.DATABASE_URL ?? "postgres:///mydb",
    }),
  ],
  grafserv: {
    port: 5678,
    watch: process.env.NODE_ENV !== "production",
  },
  schema: {
    defaultBehavior: "-connection +list",  // optional: prefer lists over connections
  },
  grafast: {
    explain: process.env.NODE_ENV !== "production",
  },
};

export default preset;
```

## The Amber Preset

`PostGraphileAmberPreset` is the standard V5 preset. It enables:
- CRUD mutations for all accessible tables
- Relay-style cursor connections
- nodeId global identifiers
- PgRBACPlugin (respects GRANT permissions)
- Smart tags support
- Standard inflection

Always extend Amber as your base unless you have a specific reason not to.

## pgServices Configuration

```typescript
// Single database
pgServices: [makePgService({ connectionString: "postgres:///mydb" })],

// With all options
pgServices: [makePgService({
  connectionString: process.env.AUTH_DATABASE_URL,  // unprivileged user pool
  pool: authPgPool,                                  // pass existing pool directly
  schemas: ["app_public"],                           // schemas to expose
  superuserConnectionString: process.env.DATABASE_URL,  // for watch mode / DDL
  pubsub: true,                  // enable LISTEN/NOTIFY for subscriptions
  pgSettings: async (ctx) => ({  // per-request settings callback
    role: "app_visitor",
  }),
  pgSettingsForIntrospection: {  // static settings for schema introspection only
    role: "app_postgraphile",
  },
})],
```

**`makePgService` import path:** Both are valid depending on installed package versions:
- `import { makePgService } from "postgraphile/adaptors/pg"` (newer, recommended)
- `import { makePgService } from "@dataplan/pg/adaptors/pg"` (older, also works)

## Dual Database Pool Pattern

For production apps, use two separate `pg.Pool` instances:
- `authPgPool` — connects as the unprivileged visitor role; what PostGraphile uses per-request
- `rootPgPool` — connects as superuser; for session management, background tasks, watch mode

```typescript
// server/utils/pg.ts
import { Pool } from "pg";

function swallowPoolError(_error: Error) { /* noop */ }

export const rootPgPool = new Pool({ connectionString: process.env.DATABASE_URL });
rootPgPool.on("error", swallowPoolError);

export const authPgPool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
authPgPool.on("error", swallowPoolError);
```

Pass `authPgPool` to PostGraphile, keep `rootPgPool` for your `grafast.context()`:
```typescript
pgServices: [makePgService({
  superuserConnectionString: process.env.DATABASE_URL,
  pool: authPgPool,
  schemas: ["app_public"],
  pubsub: true,
})],
```

## makeV4Preset: V4 Compatibility Layer

`makeV4Preset` exposes V4-style config options in V5. Useful for projects migrating from V4 or
needing fine-grained control over schema generation:

```typescript
import { makeV4Preset } from "postgraphile/presets/v4";
import { NodePlugin } from "graphile-build";

extends: [
  PostGraphileAmberPreset,
  makeV4Preset({
    retryOnInitFail: true,               // keep trying if DB unavailable at startup
    subscriptions: true,                  // enable WebSocket subscriptions
    dynamicJson: true,                    // JSON as objects, not strings
    ignoreRBAC: false,                    // respect GRANT permissions
    ignoreIndexes: false,                 // respect DB indexes
    setofFunctionsContainNulls: false,    // cleaner nullability
    watchPg: isDev,                       // auto-reload schema on DB change
    graphiql: isDev,                      // enable GraphiQL in dev
    enhanceGraphiql: true,                // prettier + header editing in GraphiQL
    allowExplain: isDev,                  // EXPLAIN support in dev
    sortExport: true,
    exportGqlSchemaPath: isDev ? "data/schema.graphql" : undefined,
    // Register custom plugins:
    appendPlugins: [TagsFilePlugin, LoginPlugin, SubscriptionsPlugin],
    skipPlugins: [NodePlugin],            // e.g. remove Relay Node interface
    graphileBuildOptions: {
      pgStrictFunctions: true,            // function args without defaults are non-nullable
    },
  }),
  PgSimplifyInflectionPreset,
],
```

**When using `makeV4Preset`, plugins go in `appendPlugins`/`skipPlugins`, not `preset.plugins`.**

## Schema Configuration Options

```typescript
schema: {
  defaultBehavior: "-connection +list",  // global behavior override

  // JWT generation: functions returning this type emit JWTs
  pgJwtTypes: "app_public.jwt_token",
}
```

## Grafserv Options

```typescript
grafserv: {
  port: 5678,
  host: "0.0.0.0",                    // listen on all interfaces
  watch: true,                         // auto-reload on schema change
  graphqlPath: "/api/graphql",
  eventStreamPath: "/api/graphql/stream",
  websockets: true,                    // enable WebSocket support
  websocketKeepalive: 12000,           // keepalive interval (ms), default 12000
  graphiql: true,
  maxRequestLength: 100000,
  parseAndValidateCacheSize: 500,      // default 500
}

// Separate Ruru (GraphQL IDE) endpoint:
ruru: { endpoint: "/api/ruru" }
```

## Library Usage (Express)

```typescript
import express from "express";
import { postgraphile } from "postgraphile";
import { grafserv } from "postgraphile/grafserv/express/v4";
import preset from "./graphile.config.js";

const app = express();
const pgl = postgraphile(preset);
const serv = pgl.createServ(grafserv);
await serv.addTo(app);
app.listen(5678);
```

## Nuxt 4 / H3 / Nitro Integration

PostGraphile integrates with Nuxt via the `h3/v1` grafserv adaptor. There are two mounting
patterns — the **API route pattern** (more explicit) and the **Nitro plugin pattern** (cleaner).

### Prerequisite: enable Nitro WebSockets

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    experimental: { websocket: true }
  }
})
```

### Pattern A: API Route (recommended)

Separate your PostGraphile instance and server into their own modules, then expose them as
a Nuxt API route:

```typescript
// server/utils/pg.ts — database pools
import { Pool } from "pg";
function swallowPoolError(_error: Error) {}
export const rootPgPool = new Pool({ connectionString: process.env.DATABASE_URL });
rootPgPool.on("error", swallowPoolError);
export const authPgPool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
authPgPool.on("error", swallowPoolError);
```

```typescript
// server/graphserv/pgl.ts — PostGraphile instance
import { postgraphile } from "postgraphile";
import { getPreset } from "../graphile.config";
import { authPgPool, rootPgPool } from "../utils/pg";

export const pgl = postgraphile(getPreset({ authPgPool, rootPgPool }));
```

```typescript
// server/graphserv/serv.ts — Grafserv server
import { grafserv } from "postgraphile/grafserv/h3/v1";
import { pgl } from "./pgl";
import { getPreset } from "../graphile.config";
import { authPgPool, rootPgPool } from "../utils/pg";

export const serv = grafserv({
  preset: getPreset({ authPgPool, rootPgPool }),
  schema: pgl.getSchema(),
});
```

```typescript
// server/api/graphql.ts — Nuxt API route
import { eventHandler } from "h3";
import { serv } from "~/server/graphserv/serv";

export default eventHandler({
  handler: (event) => serv.handleGraphQLEvent(event),
  websocket: serv.makeWsHandler(),
});
```

### Pattern B: Nitro Plugin

```typescript
// server/plugins/postgraphile.ts
import { postgraphile } from "postgraphile";
import { grafserv } from "postgraphile/grafserv/h3/v1";
import preset from "../graphile.config";

export default defineNitroPlugin(async (nitroApp) => {
  const pgl = postgraphile(preset);
  const serv = pgl.createServ(grafserv);
  await serv.addTo(nitroApp.h3App);  // note: nitroApp.h3App, not nitroApp itself
});
```

### Framework Adaptors

| Framework | Import path |
|-----------|------------|
| **H3 (Nuxt/Nitro)** | **`postgraphile/grafserv/h3/v1`** |
| Express 4 | `postgraphile/grafserv/express/v4` |
| Koa 2 | `postgraphile/grafserv/koa/v2` |
| Fastify 4 | `postgraphile/grafserv/fastify/v4` |
| Node HTTP | `postgraphile/grafserv/node` |

## GraphQL Context / pgSettings

To pass per-request context (user ID, role, etc.) to PostgreSQL. The `grafast.context` function
receives `(requestContext, args)` — use both:

```typescript
grafast: {
  async context(requestContext, args) {
    // Accumulate any pgSettings already set by pgServices:
    const pgSettings = { ...(args.contextValue?.pgSettings as Record<string, string>) };

    // For Express: requestContext.expressv4?.req
    // For H3/Nuxt: requestContext.h3v1?.event (see security.md for full pattern)
    const req = requestContext.expressv4?.req;
    const user = req?.user;

    return {
      ...args.contextValue,
      pgSettings: {
        ...pgSettings,
        role: user ? "app_user" : "app_anonymous",
        "myapp.user_id": user?.id?.toString() ?? "",
      },
    };
  },
},
```

## CLI Usage

```bash
# Run with config file (auto-detects graphile.config.mjs)
npx postgraphile

# Run without config file (basic)
npx postgraphile -P postgraphile/presets/amber -c "postgres:///mydb"

# Debug tools
npx graphile config print          # show resolved config
npx graphile behavior debug        # trace behavior resolution
npx graphile inflection list       # list all inflectors
```

## Preset Composition

Presets compose with `extends`. Later presets override earlier ones:

```typescript
const myPreset: GraphileConfig.Preset = {
  extends: [PostGraphileAmberPreset, PgSimplifyInflectionPreset],
  plugins: [MyCustomPlugin],
  // ...overrides
};
```

## Instance Methods (Library Mode)

```typescript
const pgl = postgraphile(preset);

await pgl.getSchema()          // get the GraphQL schema
await pgl.getSchemaResult()    // get schema + resolved preset
pgl.getResolvedPreset()        // sync: get current preset
await pgl.release()            // clean up (on shutdown)
```
