# PostGraphile 5: Extending the Schema

## Overview

Extension approaches in order of complexity (use the simplest that works):

1. **PostgreSQL functions** — computed columns, custom queries, custom mutations
2. **Smart tags + inflection** — rename, hide, reshape existing schema
3. **`extendSchema()` helper** — add custom GraphQL types and fields
4. **Inflection plugins** — override naming conventions
5. **Raw Graphile Build plugins** — full control over schema generation

## PostgreSQL Functions (Preferred)

The cleanest way to add custom logic. PostGraphile exposes them automatically.

See `schema-design.md` → Functions section for patterns.

## extendSchema() Helper

For adding custom GraphQL types/fields without writing raw Graphile Build plugins:

```javascript
import { gql, makeExtendSchemaPlugin } from "postgraphile/utils";

const MyCustomPlugin = makeExtendSchemaPlugin((build) => {
  const { sql } = build;
  return {
    typeDefs: gql`
      extend type Query {
        serverTime: String!
      }
      type SearchResult {
        users: [User!]!
        posts: [Post!]!
      }
      extend type Query {
        search(query: String!): SearchResult!
      }
    `,
    plans: {
      Query: {
        serverTime() {
          return constant(new Date().toISOString());
        },
        search(_, fieldArgs) {
          // Grafast plan function
          const $query = fieldArgs.get("query");
          // ... build plan
        },
      },
    },
  };
});

// In graphile.config.mjs:
const preset = {
  plugins: [MyCustomPlugin],
};
```

## Inflection Plugins

Override any naming behavior:

```javascript
const MyInflectionPlugin = {
  name: "MyInflectionPlugin",
  version: "0.0.1",
  inflection: {
    replace: {
      // Change how patch types are named: UserPatch → UserInput
      patchType(previous, resolvedPreset, typeName) {
        return this.upperCamelCase(`${typeName}-input`);
      },
      // Change how connection types are named: UsersConnection → UserConnection
      connectionType(previous, resolvedPreset, typeName) {
        return `${typeName}Connection`;
      },
      // Override specific column name
      attribute(previous, options, details) {
        if (
          details.codec.name === "users" &&
          details.attributeName === "full_name"
        ) {
          return "name";
        }
        return previous?.(details) ?? details.attributeName;
      },
    },
  },
};
```

Key inflectors to know:
- `tableType` — GraphQL type name from table
- `attribute` — field name from column
- `patchType` — update input type name
- `createField`, `updateField`, `deleteField` — mutation field names
- `allRows`, `allRowsConnection` — root query field names
- `connectionType`, `edgeType` — connection/edge type names
- `manyRelationConnection`, `singleRelation` — relation field names

List all: `npx graphile inflection list`

## Behavior Plugins

Add custom behaviors to entities programmatically:

```javascript
const MyBehaviorPlugin = {
  name: "MyBehaviorPlugin",
  schema: {
    entityBehaviors: {
      pgCodec(behavior, codec, build) {
        // Disable mutations on all tables in app_private schema
        if (codec.extensions?.pg?.schemaName === "app_private") {
          return `${behavior} -insert -update -delete`;
        }
        return behavior;
      },
    },
  },
};
```

## Server Plugins (Grafserv Middleware)

For HTTP-layer customizations (not GraphQL schema changes):

```javascript
const MyServerPlugin = {
  name: "MyServerPlugin",
  version: "0.0.1",
  grafserv: {
    middleware: {
      // Customize the GraphQL request body before processing
      async processGraphQLRequestBody(next, ctx, body) {
        // Modify body.body (the parsed GraphQL request)
        return next(ctx, body);
      },
      // Customize the Ruru GraphQL IDE HTML
      async ruruHTML(next, ctx, html) {
        return next(ctx, html);
      },
    },
  },
};
```

**Note:** Most use cases are better served by standard HTTP middleware (Express/Koa/Fastify) for CORS, logging, rate limiting, etc.

## Raw Graphile Build Plugins

For advanced schema manipulation (rarely needed):

```javascript
const MyRawPlugin = {
  name: "MyRawPlugin",
  version: "0.0.1",
  schema: {
    hooks: {
      // Add a field to every object type
      GraphQLObjectType_fields(fields, build, context) {
        const { Self } = context;
        if (Self.name !== "Query") return fields;
        return {
          ...fields,
          _debug: {
            type: build.graphql.GraphQLString,
            description: "Debug info",
            plan() {
              return constant("debug");
            },
          },
        };
      },
    },
  },
};
```

Available hooks (partial list):
- `build` — modify the build object
- `init` — initialization
- `GraphQLSchema` — modify the final schema
- `GraphQLObjectType` — modify object type config
- `GraphQLObjectType_fields` — add/modify fields
- `GraphQLObjectType_fields_field` — modify individual fields
- `GraphQLInputObjectType_fields` — modify input type fields
- `GraphQLEnumType_values` — modify enum values

## Grafast Basics (for custom plans)

PostGraphile 5 uses Grafast instead of traditional resolvers. Key concepts:

```javascript
import {
  constant,          // static value
  lambda,            // transform a step
  context,           // access GraphQL context
  makeGrafastSchema, // build schema with plans
} from "grafast";
import { sql, pgSelect } from "@dataplan/pg";

// In extendSchema plans:
Query: {
  // Simple static value
  serverVersion() {
    return constant("1.0.0");
  },

  // Access context (e.g., pgSettings)
  currentUserId() {
    const $ctx = context();
    return lambda($ctx, (ctx) => ctx.pgSettings?.["myapp.user_id"]);
  },
}
```

For complex Grafast plans, refer to the Grafast documentation at https://grafast.org

## Plugin Loading

```typescript
// graphile.config.ts
import MyPlugin from "./src/plugins/my-plugin.js";
import { MyInflectionPlugin } from "./src/plugins/inflection.js";

const preset: GraphileConfig.Preset = {
  extends: [PostGraphileAmberPreset],
  plugins: [
    MyPlugin,
    MyInflectionPlugin,
  ],
};
```

**When using `makeV4Preset`, use `appendPlugins`/`skipPlugins` instead of `preset.plugins`:**

```typescript
makeV4Preset({
  appendPlugins: [
    TagsFilePlugin,                    // smart tags from file
    LoginPlugin,                       // custom mutation
    SubscriptionsPlugin,               // LISTEN/NOTIFY subscriptions
    PrimaryKeyMutationsOnlyPlugin,     // restrict mutations to PK operations
    RemoveQueryQueryPlugin,            // remove Relay 1 compat query field
    OrdersPlugin,                      // custom ordering
  ],
  skipPlugins: [NodePlugin],           // e.g. remove Relay Node interface
})
```

Plugin objects are plain JavaScript objects — no class instantiation needed.
Order matters: later plugins can override earlier ones for the same hooks.

## grafastExchange: SSR Without HTTP Round-Trip

For Nuxt SSR with URQL, server-side GraphQL queries can bypass the HTTP layer entirely by
calling Grafast directly. This avoids a loopback HTTP request during SSR.

```typescript
// app/plugins/lib/grafastExchange.ts
import { execute, hookArgs } from "grafast";
import { filter, fromPromise, mergeMap, pipe } from "wonka";
import type { Exchange, Operation, OperationResult } from "@urql/core";
import type { PostGraphileInstance } from "postgraphile";
import type { H3Event } from "h3";

interface RequestContext {
  h3v1: { event: H3Event };
}

export const grafastExchange = (
  pgl: PostGraphileInstance,
  requestContext: RequestContext
): Exchange => {
  return () => (ops$) =>
    pipe(
      ops$,
      filter((op) => op.kind === "query"),
      mergeMap((operation: Operation) =>
        fromPromise(
          (async (): Promise<OperationResult> => {
            const args = {
              resolvedPreset: pgl.getResolvedPreset(),
              schema: await pgl.getSchema(),
              document: operation.query,
              requestContext,
              variableValues: operation.variables,
            };
            await hookArgs(args);
            const result = await execute(args);
            return {
              operation,
              data: result.data,
              error: undefined,
              extensions: result.extensions,
              stale: false,
              hasNext: false,
            };
          })()
        )
      )
    );
};
```

Use in the URQL server plugin — swap `fetchExchange` for `grafastExchange` during SSR:

```typescript
// app/plugins/urql.server.ts
import { grafastExchange } from "./lib/grafastExchange";
import { pgl } from "../../server/graphserv/pgl";

// exchanges: use grafastExchange on server, fetchExchange on client
exchanges: [
  ssr,
  ...(nuxt.ssrContext?.event
    ? [grafastExchange(pgl, { h3v1: { event: nuxt.ssrContext.event } })]
    : [fetchExchange])
]
```

This pattern works only for queries (not mutations or subscriptions), and only during SSR
where `nuxt.ssrContext?.event` is available.
