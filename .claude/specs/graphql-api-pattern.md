# GraphQL API Pattern

The standard stack for all data access in fnb. Every layer has a defined responsibility.
Do not skip layers or bypass the pattern.

> This file replaces the retired `rest-api-pattern.md`. The default data path is **urql GraphQL
> → PostGraphile 5**, not Nitro REST. A narrow **REST/H3 carve-out** survives for the things
> that cannot go through GraphQL — the msg WS incremental read, the storage multipart upload,
> and the pre-claims root of trust (see the last two sections).

---

## Stack Overview (default path)

```
PostgreSQL tables (RLS enabled)
        ↓
PL/pgSQL functions
  <module>_fn.*   — SECURITY DEFINER internal logic, no permission checks
  <module>_api.*  — SECURITY INVOKER entry points, jwt.enforce_permission(...) gate
        ↓
PostGraphile 5  (apps/graphql-api-app)
  auto-generates the GraphQL schema from the app/*_api schemas
  grafast.context() applies auth: event.context.claims → pgSettings
        ↓
graphql-client-api  (packages/graphql-client-api)
  src/graphql/<module>/{query,mutation,fragment}/*.graphql  — operation documents
  graphql-codegen → src/generated/fnb-graphql-api.ts        — typed urql/vue hooks
  src/composables/use{Domain}.ts                            — wrap hooks, shape the response
        ↓
Composable re-export  (apps/*/app/composables/use{Domain}.ts)
  one line: export { useX } from '@function-bucket/fnb-graphql-client-api'
        ↓
Vue page / component
  calls the auto-imported composable only — zero transport knowledge
```

There is **no `server/` directory in feature apps** (e.g. `tenant-app`). The Nitro REST layer
is gone for them.

---

## Layer 1: Database (unchanged from before)

### Tables
All tables have RLS enabled. Tenant-scoped tables always have a `tenant_id` FK. Row access is
controlled by `jwt.tenant_id()` / `jwt.has_permission(key, tenant_id)` reading from
`current_setting('request.jwt.claims')`.

### PL/pgSQL two-layer pattern
Every mutation has two functions:

```sql
-- SECURITY DEFINER: does the work, no permission check
<module>_fn.do_the_thing(_arg1, _arg2, ...) RETURNS <module>.some_table

-- SECURITY INVOKER: checks permission, then delegates
<module>_api.do_the_thing(_arg1) RETURNS <module>.some_table
  → PERFORM jwt.enforce_permission('p:some-permission')
  → RETURN <module>_fn.do_the_thing(..., jwt.resident_id())
```

`<module>_api.*` is the surface PostGraphile exposes as GraphQL **mutations**. Reads go through
RLS-protected selects that PostGraphile generates from the tables/views (no `_api` wrapper needed
for SELECTs).

_Verified example:_ `msg_api.upsert_topic(_topic_info)` gates `jwt.enforce_permission('p:discussions')`
then calls `msg_fn.upsert_topic(_topic_info, jwt.resident_id())`
(`db/fnb-msg/deploy/00000000010410_msg_fn.sql`).

---

## Layer 2: PostGraphile 5 (`apps/graphql-api-app`)

PostGraphile auto-generates the schema from the exposed schemas. Config in
`server/graphile.config.ts`:
- Presets: `PostGraphileAmberPreset`, `PgSimplifyInflectionPreset`, `makeV4Preset({ simpleCollections:'both', disableDefaultMutations:true, dynamicJson:true })`; plus `TagsFilePlugin` + local mutation hooks.
- `pgServices` schemas: `app, app_api, msg, msg_api, loc, loc_api, todo, todo_api, agent, agent_api, n8n, n8n_api, storage, location_datasets, location_datasets_api, airports, airports_api, game, game_api, res, res_api` (never `res_fn`/`game_fn` — registry writes and the game referee surface stay behind SECURITY DEFINER functions, closed to the GraphQL surface).
- Smart-tag overrides in `apps/graphql-api-app/postgraphile.tags.json5`.

### Auth: `grafast.context()` is the analog of `withClaims`
The auth middleware runs before PostGraphile and populates `event.context.claims`. Then:

```ts
// server/graphile.config.ts (grafast.context)
const claims = event?.context?.claims
if (claims) {
  pgSettings.role = 'authenticated'
  pgSettings['request.jwt.claims'] = JSON.stringify({
    email: claims.email,
    display_name: claims.displayName,
    user_metadata: {
      profile_id: claims.profileId, tenant_id: claims.tenantId,
      resident_id: claims.residentId, actual_resident_id: claims.actualResidentId,
      permissions: claims.permissions ?? [],
    },
  })
} else {
  pgSettings.role = 'anon'
}
```

PostGraphile issues the equivalent `SET LOCAL ROLE` + `set_config('request.jwt.claims', …)` per
operation, so the same RLS + `jwt.*()` helpers fire. HTTP requests get the event from the
grafserv H3 adaptor; WebSocket subscriptions construct an `H3Event` from the raw upgrade request.

---

## Layer 3: graphql-client-api (`packages/graphql-client-api`)

### Operation documents (`src/graphql/<module>/{query,mutation,fragment}/*.graphql`)
Hand-written GraphQL documents. Use PostGraphile's auto-generated field names — check
`src/generated/fnb-graphql-api.ts` (or GraphiQL) for exact type/relationship field names
(e.g. `toolsByModuleKeyList`, `subscribersList`). Fragments are shared across operations.

### Codegen (`codegen.ts` → `src/generated/fnb-graphql-api.ts`)
```
schema:    http://localhost:4000/graphql-api/api/graphql   (PostGraphile must be running)
documents: src/graphql/**/*.graphql
plugins:   typescript, typescript-operations, typescript-vue-urql
config:    gqlImport '@urql/vue#gql', arrayInputCoercion: false, nonOptionalTypename: true
also emits schema.json (introspection) + schema.min.json (urql-introspection)
```
Run with `pnpm -F @function-bucket/fnb-graphql-client-api generate`. The generated hook name
follows the operation name: `query MySubscribedTopics` → `useMySubscribedTopicsQuery()`,
`mutation UpsertTopic` → `useUpsertTopicMutation()`.

### Composables (`src/composables/use{Domain}.ts`)
The real implementations. Each wraps one or more generated hooks and shapes the raw response into
a view type the page expects. Return shape follows the urql convention:
- reactive data via `computed()` (not the raw urql `data` ref)
- `fetching` (not `pending`), `error`
- re-run a query with `executeQuery({ requestPolicy: 'network-only' })` — there is **no `refresh`**
- flatten nested relationships and map permission objects to string arrays as needed
- view types (`SubscribedTopicSummary`, etc.) are declared in the composable file (R4)

Barrel `src/index.ts`: `export * from './generated/fnb-graphql-api'` plus one
`export * from './composables/use{Domain}'` per composable. A missing barrel line is a hard ESM
startup crash (`does not provide an export named 'X'` at `dist/index.js`), not a build error.

---

## Layer 4: Composable re-export (`apps/*/app/composables/`)

Feature apps do not implement composables — they re-export the shared ones so Nuxt auto-import
resolves them in pages:

```ts
// apps/tenant-app/app/composables/useMsgTopics.ts
export { useMsgTopics, useMsgResidents } from '@function-bucket/fnb-graphql-client-api'
```

Naming: `use{Domain}()` — e.g. `useAdminUsers()`, `useSupportTickets()`, `useLocations()`.

### urql client plugin (`apps/*/app/plugins/urql.client.ts`)
```ts
const client = new Client({
  url: pub.graphqlApiUrl,
  preferGetMethod: false,              // PostGraphile rejects GET with 405
  exchanges: [cacheExchange, mapExchange({ onError }), fetchExchange],
})
nuxtApp.vueApp.use(urql, client)
return { provide: { urqlClient: client } } // reachable outside setup (route middleware, useAuth)
```
`nuxt.config.ts` must declare `runtimeConfig.public.graphqlApiUrl`
(default `http://localhost:4000/graphql-api/api/graphql`).

---

## Layer 5: Vue page / component

Pages call the auto-imported composable only. No `$fetch`, no `useFetch`, no `/api/` paths, no
transport awareness. They consume `{ data | <computed lists>, fetching, error, <actions> }`.

---

## Auth Context

`ProfileClaims` is the hand-written source-of-truth type in
`packages/db-access/src/types/profile-claims.ts` (NOT generated — see global-rules R3):
```ts
{
  profileId, tenantId, residentId, actualResidentId,   // string | null
  profileStatus,                                        // 'active'|'inactive'|'blocked' | null
  permissions,                                          // string[] | null  e.g. ['p:app-admin','p:discussions']
  email, displayName, tenantName,                       // string | null
  modules,                                              // ModuleInfo[] | null — drives nav
}
```
- **Server**: derived per request from the httpOnly `session` cookie — a **sealed**
  (encrypted+authenticated, h3 `useSession`/iron-webcrypto) blob carrying
  `{ id: <profile uuid>, sid: <auth.session uuid> }`, keyed by `NUXT_SESSION_SECRET` (auth-layer
  `server/utils/session.ts`; issues 0010 + 0185). Forged or tampered values fail unseal and read
  as unauthenticated. **Validity is decided by the server-side `auth.session` row**, not the
  seal's maxAge (`future-auth/session-refresh-pattern.md`): `app_fn.claims_for_session` enforces
  revocation / idle 24h / absolute 7d and touch-renews `last_seen_at` (throttled 1h) in the same
  round trip that builds the claims. The cookie is written once at login, never re-sealed.
  Middleware (`tenant-layer` / auth-app) → `applyEventClaims` → `getEventClaims` →
  `claimsForSession(sid)` (db-access) → `event.context.claims`. Claims are **not** written to a
  cookie (the full JSON overflows the response header → nginx 502).
- **Client**: `useAuth()` (`packages/auth-ui`) stores claims in **localStorage** via `useStorage`,
  (re)fetched from GraphQL (`fetchProfileClaims` in graphql-client-api) on login / session change / hydration.
- Support mode: `claims.residentId !== claims.actualResidentId`.

---

## Error Handling

| Situation | Default GraphQL path | H3 carve-out |
|---|---|---|
| Not authenticated | resolves as `anon` → empty under RLS | `throw createError({ statusCode: 401 })` |
| Entity not found | query returns null/empty | `throw createError({ statusCode: 404 })` |
| Permission denied | `<module>_api` raises → GraphQL error in `error` ref | exception surfaces from the handler |
| Validation failure | mutation raises → GraphQL error | `400` with message |

Composables surface `error` from the urql hook; pages render it (UC7 toast / UAlert).

---

## REST/H3 Carve-out #1 — authorized operations outside GraphQL (`withClaims`)

Some authorized server-side operations run outside the GraphQL request lifecycle. There are
currently two: the msg-layer WebSocket incremental "new message" read, and the storage-layer
**multipart upload endpoint** (`packages/storage-layer/server/api/upload.post.ts` — multipart
can't ride GraphQL; it runs `storage_api.insert_asset` in a `withClaims` transaction, then fires
the post-commit asset-scan trigger POST to agent-app — R22). Both use `withClaims` (2-arg) from
`packages/db-access`:

```ts
// packages/msg-layer/server/api/topics/[id]/messages/[msgId].get.ts
export default defineEventHandler(async (event) => {
  const { claims } = event.context
  if (!claims) throw createError({ statusCode: 401, message: 'Not authenticated' })
  const msgId = getRouterParam(event, 'msgId')!
  return withClaims(claims, (client) => selectMessageWithSenderById(client, msgId))
})
```
```ts
// packages/db-access/src/with-claims.ts — 2-arg: withClaims(claims, fn)
// begin; set local role authenticated; set_config('request.jwt.claims', payload, true); fn(client); commit
```
`withClaims` is **2-arg** (`withClaims(claims, fn)`) — it fires RLS exactly as the old Kysely
`withClaims` did, but there is no `db`/trx parameter. Do not write the retired 3-arg form.

---

## REST/H3 Carve-out #2 — the pre-claims root of trust (`db-access`, raw pg)

These functions run *before* claims exist, so they cannot go through GraphQL (whose context
requires claims already present). They live in `packages/db-access` as raw `pg` calls and are the
permanent server-side "root of trust". **Authentication itself is ZITADEL's** (OIDC code+PKCE,
`zitadel-login-pattern.md`) — the auth-app callback verifies the id_token, then:
- `provisionIdpUser(sub, email, name)` → `app_fn.provision_idp_user` (SEC DEFINER; links/creates
  the `app.profile` by `idp_user_id`/email — the retired `loginUser`/`auth.login_user` password
  path is gone)
- `createSession(profileId)` → `app_fn.create_session` (SEC DEFINER; OIDC callback mints the
  `auth.session` row whose id is sealed into the cookie as `sid`)
- `claimsForSession(sid)` → `app_fn.claims_for_session` (SEC DEFINER; the per-request choke
  point — middleware + WS bootstrap: validates the session row, touch-renews, builds claims)
- `revokeSession(sid)` → `app_fn.revoke_session` (SEC DEFINER; logout revocation, idempotent)
- `profileClaimsForUser(profileId)` / `currentProfileClaims(profileId)` →
  `app_fn.profile_claims_for_user` / `app_fn.current_profile_claims` (SEC DEFINER; the claims
  builders — `claims_for_session` calls `profile_claims_for_user` internally)

**Never migrate these to GraphQL.** `to_jsonb(...)` returns snake_case; `camelCaseKeys` in
db-access recursively camelCases nested keys (the retired Kysely `CamelCasePlugin` behavior).

**First-run setup** (`.claude/specs/first-run-setup/`) adds two more pre-claims functions in the
same posture — they bootstrap a virgin env (no anchor tenant, no profiles) from auth-app's
`/auth/setup` before any session exists: `anchorExists()` → `app_fn.anchor_exists` (the gate) and
`initializeAnchor(input)` → `app_fn.initialize_anchor` (SEC DEFINER, hard-gated on "no anchor
tenant yet", **no `app_api` wrapper**, granted only to `authenticator`). Consumed by the auth-app
Nitro routes `server/api/setup/{status.get,initialize.post}.ts` (the `initialize` endpoint adds a
mandatory, fail-closed, constant-time `SETUP_TOKEN` gate in front). Same rule applies: never
GraphQL-ify them.

The `graphql-api-app` itself (PostGraphile server + extendSchema plugins) is also an H3/Nitro
app — but its endpoints are the GraphQL transport, not per-feature REST routes. Workflows run in
the headless `apps/agent-app` (R22); graphql-api-app's only workflow surface is the
`triggerWorkflow` extendSchema plugin (`server/graphile/trigger-workflow.plugin.ts`): claims 401
gate → static allow-map → secret-header POST to `${AGENT_INTERNAL_URL}/api/trigger/<key>` →
`{ accepted, runId }` passthrough.

---

## What Lives Where — Quick Reference

| Concern | Location |
|---|---|
| DB schema & enums | `db/<module>/deploy/*.sql` (sqitch) |
| Business logic | `<module>_fn.*` PL/pgSQL (SECURITY DEFINER) |
| Permission enforcement | `<module>_api.*` PL/pgSQL (SECURITY INVOKER + `jwt.enforce_permission`) |
| GraphQL server / auth bridge | `apps/graphql-api-app/server/graphile.config.ts` |
| GraphQL operation documents | `packages/graphql-client-api/src/graphql/<module>/**/*.graphql` |
| Generated typed hooks | `packages/graphql-client-api/src/generated/fnb-graphql-api.ts` (do not edit) |
| Composable implementations | `packages/graphql-client-api/src/composables/` |
| Composable re-exports | `apps/*/app/composables/` |
| Pre-claims root of trust + `withClaims` | `packages/db-access/src/` |
| UI / pages | `apps/*/app/pages/` |
| Shared UI components | `apps/*/app/components/` (+ Nuxt layers) |
