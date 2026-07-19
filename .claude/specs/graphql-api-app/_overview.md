---
name: graphql-api-app-overview
description: Full architecture overview of the graphql-api-app — Nuxt config, package deps, plugins, middleware, server structure, and how all layers connect.
metadata:
  type: reference
---

## Status
Implemented — reverse-engineered from the existing codebase.

---

## Purpose

`apps/graphql-api-app` is the **GraphQL API server** for the FNB platform. It:

1. Runs a **PostGraphile 5** GraphQL API over PostgreSQL (served via grafserv + Nuxt Nitro)
2. **Enqueues** background jobs lazily (`_scheduleUows` on the `queueWorkflow` mutation) — it does
   **not** run a graphile-worker runner (Plan D, 2026-07-06: all handlers execute in the headless
   `apps/worker-app`, the stack's single worker — see `worker-pattern.md`)
3. Provides a small **Vue 3 / Nuxt 4 front-end** for browsing and launching workflows

It is not a tenant-facing app; it is an infrastructure/developer app. The GraphQL endpoint is the primary product; the UI is an operator tool.

---

## Package Identity

```
name:    @function-bucket/fnb-graphql-api-app
path:    apps/graphql-api-app/
type:    private Nuxt 4 app
```

### Key Dependencies

| Package | Purpose |
|---|---|
| `@function-bucket/fnb-tenant-layer` | Shared Nuxt layer (auth, layout, UI defaults) |
| `@function-bucket/fnb-graphql-client-api` | Compiled composable/type library (urql-based) |
| `postgraphile` (`^5`) | Core GraphQL API server |
| `@graphile/simplify-inflection` | PostGraphile preset — simplifies field names |
| `grafast` | PostGraphile 5's step-based execution engine |
| `graphile-utils` | `makeWrapPlansPlugin` for mutation hooks |
| `graphile-worker` (`^0.16.6`) | **Producer only** — lazy `makeWorkerUtils` in `_scheduleUows.ts`; no runner here |
| `@urql/vue`, `@urql/core` | GraphQL client (urql) used by the front-end |
| `@vue-flow/core`, `@vue-flow/background` | Workflow DAG visualization |
| `elkjs` | ELK layout engine for the flow graph |
| `pg` | Node.js PostgreSQL driver (used by auth middleware pool) |

(`@function-bucket/fnb-auth-server` and `camelcase-keys` were removed with the worker handlers —
they now live in `apps/worker-app`.)

---

## nuxt.config.ts

File: `apps/graphql-api-app/nuxt.config.ts`

```ts
extends: ['@function-bucket/fnb-tenant-layer']   // inherits layout, auth UI, Tailwind
modules: ['@nuxt/ui', '@nuxt/eslint']

runtimeConfig.public:
  authAppUrl:    'http://localhost:4000/auth'
  graphqlApiUrl: 'http://localhost:4000/graphql-api/api/graphql'   // used by urql plugin

routeRules:
  '/workflow/**': { ssr: false }    // workflow pages are client-side only (VueFlow requires browser)

nitro.experimental.websocket: true  // required for grafserv WebSocket subscriptions

vite.server.hmr.clientPort: process.env.VITE_HMR_CLIENT_PORT ?? 3000
```

---

## Server Architecture

The Nitro server has three main roles, wired up through server plugins:

```
server/
├── middleware/
│   └── auth.ts                    ← runs on every request; hydrates event.context.claims
├── plugins/
│   └── postgraphile.ts            ← mounts PostGraphile (grafserv) into Nitro's h3 app
├── api/
│   ├── graphql.ts                 ← handles POST /api/graphql + WebSocket
│   ├── graphql/stream.ts          ← handles GET /api/graphql/stream (SSE for subscriptions)
│   └── mutation-hooks/            ← PostGraphile mutation interceptors (WrapPlansPlugin)
│       ├── index.ts               ← exports plugin array for graphile.config.ts
│       ├── queue-workflow.ts      ← wraps queueWorkflow mutation → schedules UOWs via worker
│       ├── _scheduleUows.ts       ← calls workerUtils.addJob for each UOW to schedule
│       ├── _queueWorkflow.ts      ← legacy: direct PG call to prj_fn.do_queue_workflow (unused)
│       └── _queueAnonWorkflow.ts  ← legacy: direct PG call for anon workflows (unused)
├── graphserv/
│   ├── pgl.ts                     ← creates postgraphile(preset) instance
│   └── serv.ts                    ← creates grafserv (h3 adaptor) from pgl
├── graphile.config.ts             ← PostGraphile GraphileConfig.Preset (full config)
├── lib/
│   ├── flowModels/                ← stub classes (Milestone, task — not yet implemented)
│   └── s3.ts                      ← S3 client for the downloadUrl presign field (presign only)
└── tsconfig.json
```

The former `server/plugins/graphile-worker.ts` and `server/lib/worker-task-handlers/` tree
(d.ts, `_workflow-handler.ts`, `_common/`, `wf-exerciser/`) moved to
`apps/worker-app/server/` (Plan D) — documented in `worker-pattern.md`.

---

## Front-End Architecture

```
app/
├── app.vue                        ← UApp > NuxtLayout > NuxtPage (standard shell)
├── pages/
│   ├── index.vue                  ← Landing hub: links to /workflow and /api/graphql (GraphiQL)
│   └── workflow/
│       ├── index.vue              ← Workflow list (instances + templates tabs)
│       └── [id].vue               ← Workflow detail with VueFlow DAG + queue modal
├── components/
│   ├── WfUowNode.vue              ← Custom VueFlow node: leaf tasks and trigger UOWs
│   ├── WfMilestoneNode.vue        ← Custom VueFlow node: container/milestone UOWs
│   └── WfQueueModal.vue           ← Modal for queueing a workflow template with input data
└── composables/
    ├── useWfDetail.ts             ← re-export from @function-bucket/fnb-graphql-client-api
    ├── useWfInstances.ts          ← re-export from @function-bucket/fnb-graphql-client-api
    ├── useWfTemplates.ts          ← re-export from @function-bucket/fnb-graphql-client-api
    ├── usePullTrigger.ts          ← re-export from @function-bucket/fnb-graphql-client-api
    ├── useQueueWorkflow.ts        ← re-export from @function-bucket/fnb-graphql-client-api
    └── useWfFlowGraph.ts          ← LOCAL: ELK layout engine → VueFlow nodes/edges
```

**All composables except `useWfFlowGraph` are thin re-exports** from `@function-bucket/fnb-graphql-client-api`. The real implementations live in `packages/graphql-client-api/src/composables/`.

---

## Request Flow: GraphQL Query

```
Browser → /api/graphql (POST)
  → tenant-layer auth middleware     applyEventClaims → getEventClaims reads `session` cookie →
                                     currentProfileClaims() (db-access) → event.context.claims
  → server/api/graphql.ts            delegates to serv.handleGraphQLEvent(event)
  → grafserv (H3 adaptor)            passes h3v1.event (with context.claims) to PostGraphile
  → graphile.config.ts grafast.context()
      reads event.context.claims
      sets pgSettings.role = 'authenticated' | 'anon'
      sets pgSettings['request.jwt.claims'] = JSON.stringify(...)
  → PostGraphile executes query with those pg settings (RLS enforced by PostgreSQL)
```

---

## Request Flow: queueWorkflow Mutation

```
Browser → mutation QueueWorkflow(identifier, workflowInputData)
  → same auth flow as above
  → PostGraphile resolves via wf_api.queue_workflow()  (PostgreSQL function)
  → queue-workflow.ts (WrapPlansPlugin) intercepts the result
      reads result.uows_to_schedule[]
      calls _scheduleUows.ts → workerUtils.addJob(uow.workflow_handler_key, { uow })
        (lazy singleton — created on first mutation, never at boot)
  → worker-app's graphile-worker runner picks up jobs and runs the matching task handler
```

---

## Environment Variables

| Variable | Default | Used By |
|---|---|---|
| `DATABASE_URL` | `postgresql://authenticator:authenticator@localhost:5444/fnb` | auth middleware pool, graphile.config.ts pgService |
| `DB_OWNER_CONNECTION` | — | `_scheduleUows.ts` (owner-level access for enqueueing) |
| `DB_CONNECTION` | — | fallback for above (then `DATABASE_URL`) |
| `NUXT_APP_BASE_URL` | `''` | grafserv path prefix (for reverse-proxy deployment) |
| `VITE_HMR_CLIENT_PORT` | `3000` | Vite HMR client port (Docker/proxy setups) |
| `ALPHA_VANTAGE_KEY` | — | `get-stock-quote.ts` worker handler — now in worker-app (currently hardcoded stub) |
| `NODE_ENV` | — | Controls PostGraphile `watch` mode and grafast `explain` |

(The former known-gap about the worker plugin and `_scheduleUows.ts` using different connection
defaults is moot — the worker plugin moved to worker-app, which reads `DATABASE_URL`.)

---

## PostGraphile Schemas Exposed

`graphile.config.ts` exposes these PostgreSQL schemas via PostGraphile:

```
app, app_api, msg, msg_api, loc, loc_api, todo, todo_api, wf, wf_api
```

Presets applied:
- `PostGraphileAmberPreset` — base PostGraphile 5 preset
- `PgSimplifyInflectionPreset` — simplifies generated field names
- `makeV4Preset({ simpleCollections: 'both', disableDefaultMutations: true, dynamicJson: true })`

`postgraphile.tags.json5` — adds a description override for the `permission` table class.

---

## pgSettings / Auth Model

PostGraphile's `grafast.context()` function in `graphile.config.ts` bridges Nuxt's middleware claims into PostgreSQL session settings:

```
Authenticated user:
  role = 'authenticated'
  request.jwt.claims = {
    email, display_name,
    user_metadata: { profile_id, tenant_id, resident_id, actual_resident_id, permissions[] }
  }

Unauthenticated:
  role = 'anon'
```

WebSocket connections reconstruct an H3Event from the raw `ws.request._req` to access claims (since Nuxt middleware doesn't run for WebSocket upgrade requests).

---

## Client-Side urql Plugin

File: `app/plugins/urql.client.ts`

```ts
nuxtApp.vueApp.use(urql, {
  url: pub.graphqlApiUrl,      // from runtimeConfig: /graphql-api/api/graphql
  preferGetMethod: false,
  exchanges: [cacheExchange, mapExchange({ onError: console.error }), fetchExchange]
})
```

This is a **client-only plugin** (`.client.ts` suffix). urql is only initialized in the browser. The workflow pages are `ssr: false`, so this is consistent.
