# Phase 0 — Current Architecture (ground truth, read-only mining)

Scratch note for the `level-up-skills` recalibration. Every claim below is traceable to a
source line I read. **Where this contradicts existing specs/skills, this note (the code) wins.**

## Packages — 7, not 6
`packages/`: `auth-layer`, `auth-server`, `auth-ui`, `db-access`, `graphql-client-api`,
`msg-layer`, `tenant-layer`. (`db-types` is **gone**; `db-access` + `graphql-client-api` replaced it.)

## Default data path (verified)
Vue page → auto-imported composable in `apps/tenant-app/app/composables/*` (thin re-export,
e.g. `export { useMsgTopics, useMsgResidents } from '@function-bucket/fnb-graphql-client-api'`)
→ real composable in `packages/graphql-client-api/src/composables/*` → urql generated hook in
`src/generated/fnb-graphql-api.ts` → `POST /graphql-api/api/graphql` → PostGraphile 5
(`apps/graphql-api-app`) → RLS via `grafast.context()`→`pgSettings`.

- **`apps/tenant-app` has NO `server/` dir** (verified). Nitro REST layer gone for it.
- urql plugin: `apps/tenant-app/app/plugins/urql.client.ts` — `preferGetMethod: false`,
  exchanges `[cacheExchange, mapExchange(onError), fetchExchange]`, url from
  `runtimeConfig.public.graphqlApiUrl`; provides `$urqlClient` on the Nuxt app.
- Composables return `{ data|<computed lists>, fetching, error, executeQuery/execute* }` —
  urql shape (`fetching`, not `pending`; no `refresh`; re-run via `executeQuery({requestPolicy:'network-only'})`).

## graphql-client-api (verified)
- codegen `codegen.ts`: schema `http://localhost:4000/graphql-api/api/graphql`,
  documents `src/graphql/**/*.graphql`, output `src/generated/fnb-graphql-api.ts` with plugins
  `typescript`, `typescript-operations`, `typescript-vue-urql`; config `gqlImport:'@urql/vue#gql'`,
  `arrayInputCoercion:false`, `nonOptionalTypename:true`. Also emits `schema.json` (introspection)
  + `schema.min.json` (urql-introspection).
- package script: `generate` = `graphql-codegen --config codegen.ts`; build = `vite build`.
- `.graphql` docs organized `src/graphql/<module>/{query,mutation,fragment}/*.graphql`
  (modules seen: address-book, app, discussions, locations, msg, support, todo, wf).
- barrel `src/index.ts` = `export * from './generated/fnb-graphql-api'` + one line per composable.
- dep on `@function-bucket/fnb-db-access` (workspace:*); peers `@urql/vue`, `vue`.

## db-access — pre-claims root of trust (verified, raw pg)
- Owns its own `pg.Pool` (`pool.ts`, `DATABASE_URL` → `authenticator` role). No Kysely.
- `camelCaseKeys` (`utils/camel-case.ts`) recursively camelCases `to_jsonb` snake_case keys
  (replaces retired Kysely `CamelCasePlugin`; handles nested `modules[]`/`tools[]`).
- **Pre-claims trio** (run before claims exist → cannot be GraphQL):
  - `loginUser(email,pwd)` → `auth.login_user` (bcrypt, anonymous).
  - `profileClaimsForUser(userId)` → `app_fn.profile_claims_for_user` (SEC DEFINER; middleware bootstrap).
  - `currentProfileClaims(profileId)` → `app_fn.current_profile_claims` (SEC DEFINER; login/session-change).
- **`withClaims` is 2-arg**: `withClaims(claims, fn)` (`with-claims.ts:11-14`). Opens a pg txn,
  `set local role authenticated`, `select set_config('request.jwt.claims', $payload, true)`, runs
  `fn(client)`. Used only for authorized reads outside GraphQL (currently the WS message read).
- `selectMessageWithSenderById(client, id)` — the one RLS read, runs inside `withClaims`.
- Types are **hand-written source of truth** (`types/*`): `ProfileClaims` (flat, no `Maybe`/`__typename`,
  deliberately NOT imported from graphql codegen), `Resident`, `Location`, `MessageWithSender`, `User`.
- Barrel `index.ts` must list every export or Node ESM crashes at startup (dist/index.js), not build.

## graphql-api-app — PostGraphile 5 + H3 carve-out (verified)
- `server/graphile.config.ts`: PostGraphileAmberPreset + PgSimplifyInflectionPreset + v4 preset
  (`simpleCollections:'both'`, `disableDefaultMutations:true`, `dynamicJson:true`); TagsFilePlugin +
  mutationHooks. `pgServices` schemas: `app,app_api,msg,msg_api,loc,loc_api,todo,todo_api,wf,wf_api`.
- `grafast.context()` reads `event.context.claims` (HTTP via h3v1 adaptor; WS via constructed H3Event),
  and when claims present sets `pgSettings.role='authenticated'` + `request.jwt.claims` (same JSON shape
  as `buildJwtPayload`); else `role='anon'`. **This is the GraphQL analog of `withClaims`.**
- Entry: `server/api/graphql.ts` (`serv.handleGraphQLEvent` + `makeWsHandler`); serv via
  `server/graphserv/serv.ts`→`pgl.ts` (`postgraphile(preset)`).
- graphile-worker + mutation-hooks live here (`server/plugins/graphile-worker.ts`,
  `server/api/mutation-hooks/*`, `server/lib/worker-task-handlers/*`). This app IS a Nuxt app with
  its own Vue pages (workflow UI) + composables that also live in graphql-client-api.
- **No `asset-storage` app/package exists** in the repo (the plan named it as a hypothetical H3
  carve-out; there is a `.claude/specs/asset-storage/` spec tree, but no code). The real H3
  carve-outs today are: (1) msg-layer WS message read via `withClaims`; (2) graphql-api-app itself.

## Claims flow (verified) — claims in localStorage, not cookie
- Server: `packages/tenant-layer/server/middleware/auth.ts` → `applyEventClaims(event)`
  (`auth-layer/server/utils/applyEventClaims.ts`) → `getEventClaims` reads httpOnly `session`
  cookie's `id` → `currentProfileClaims(userId)` (db-access) → sets `event.context.{user,claims}`.
  Comment is explicit: **claims are NOT written to a cookie** (full JSON overflows the response
  header → nginx 502). auth-app extends auth-layer directly (also registers the middleware).
- Client: `packages/auth-ui/src/use-auth.ts` — `useAuth()` stores claims in **localStorage** via
  `useStorage('auth.user', ...)`; `refreshClaims()` calls `fetchProfileClaims(urqlClient)` (GraphQL);
  `login/logout/exitSupport` re-fetch. `exitSupport` → `exitSupportMode(client)` (GraphQL mutation).
- `graphql-client-api/src/composables/useProfileClaims.ts` `fetchProfileClaims(client)` runs the
  `CurrentProfileClaims` GraphQL query + `availableModules`, maps into the hand-written `ProfileClaims`.

## DB layer — unchanged, three-layer + RLS still correct (spot-checked fnb-msg)
- `<module>` tables (RLS) / `<module>_fn` SECURITY DEFINER business logic / `<module>_api`
  SECURITY INVOKER gate. Verified: `msg_api.upsert_topic(_topic_info)` calls
  `jwt.enforce_permission('p:discussions')` then delegates to `msg_fn.upsert_topic(...)`
  (`db/fnb-msg/deploy/00000000010410_msg_fn.sql:64-80`). `handle_update_profile` is SECURITY DEFINER.
- RLS in `_policies.sql`: `enable row level security` + policies using `jwt.tenant_id()` /
  `jwt.has_permission('p:discussions', tenant_id)`. sqitch deploy/revert/verify unchanged.
- `_api` functions are the PostGraphile mutation surface (schemas in pgServices list above).

## Spec tree reality (differs from skills' canonical tree)
- Per-app spec dirs already exist: `auth-app/`, `home-app/`, `msg-app/`, `graphql-api-app/`
  (with `_overview.md`, `workflow/`), `asset-storage/` (forward-looking, `.future.md` files),
  `tenant-app/` (admin, loc, msg, site-admin, support, tools).
- Newer spec shapes in use: `_overview.md`, YAML frontmatter, `.future.md`, per-app `server-pattern.md`
  and `graphql-client-api-package.md` under `graphql-api-app/`. The skills' rigid
  `{page}.ui.md`+`{page}.data.md`-only tree no longer matches reality.

## Drift inventory (grep sizing; targets for Phases 1–3)
Heaviest stale files: `rest-api-pattern.md` (34), `fnb-stack-implementor/SKILL.md` (28),
`package-layers-pattern.md` (13), `fnb-stack-spec/SKILL.md` (13), `global-rules.md` (10),
then per-page `.data.md` under msg/site-admin/auth-app + asset-storage.
(`function-bucket-legacy-ui-converter` and `fnb-create-app` also hit but are out of scope for
this plan; note but don't rewrite unless a concrete inbound reference breaks.)

## Guardrails reconfirmed against code
- Pre-claims trio stays raw pg in db-access — NEVER GraphQL.
- `withClaims` is 2-arg everywhere.
- `rest-api-pattern.md` → `graphql-api-pattern.md` rename must fix inbound refs in both SKILL.md.
- `*.ui.md` never touched.
- No git; `pnpm build` is the gate (`pnpm lint` broken); don't rebuild env — ask.
