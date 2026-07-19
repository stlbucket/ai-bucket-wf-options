---
name: fnb-stack-implementor
description: >
  Full-stack implementor for the fnb monorepo. Use this skill when the user wants to add a
  feature, page, GraphQL operation, component, or module to fnb — spanning DB → PostGraphile →
  graphql-client-api (urql) → composable re-export → Vue page. Covers the complete stack:
  PostgreSQL RLS, the `<module>_api`/`<module>_fn` two-layer pattern, ProfileClaims, the
  pre-claims root of trust (`db-access`, 2-arg `withClaims`), PostGraphile 5 + grafast context,
  urql/graphql-codegen, Nuxt UI v4 components, and the tenant/resident/license permission model.
  Triggers include: "add a page to tenant-app", "wire up a new GraphQL query/mutation", "how do
  I add a feature to fnb", "implement X in the stack", or any task that touches more than one
  layer of the fnb architecture.
---

# fnb Stack Implementor

You are an expert across the full fnb monorepo stack. Apply the patterns precisely.

**The stack is described once, in the pattern files — this skill does not restate it inline.**
The default data path is **urql GraphQL → PostGraphile 5**, not Nitro REST. Read the pattern
files (below); this skill holds only the implementor-specific procedure, checklists, failure
signatures, and gotchas.

---

## Nuxt UI Version — Non-Negotiable

**This project uses Nuxt UI v4. Never use v3 API.**

Every component, prop, slot, and import must follow the v4 API. When in doubt, check existing
components under `apps/tenant-app/app/components/` — they are the authoritative reference.
Do not rely on training data or documentation that predates v4; it will be wrong.

---

## Before Implementing — Required Reading

**Always read these before writing any code:**
- `.claude/specs/global-rules.md` — R1–R24, enforced across all modules (R23 = `.claude/issues/`
  lifecycle + fixed-width `[####]__[category]__[title-slug]__[SEV]__.plan.md` naming (widths 4/8/30/3,
  `_`-padded; SEV ∈ `CRT · HI · MED · LOW`) with a self-referential Execution Directive)
- `.claude/specs/graphql-api-pattern.md` — the canonical data stack (DB → PostGraphile → urql/
  graphql-client-api → composable re-export → Vue) plus the two REST/H3 carve-outs
- `.claude/specs/package-layers-pattern.md` — the seven packages + codegen workflow
- `.claude/specs/ui-components-rules.md` — UC1–UC12, enforced across all UI

Do not re-describe the stack from memory — cite these. Architecture deep-reference docs live in
`.claude/specs/architecture-considerations/read-these/`. Inline `→ [XX]` pointers indicate which
file to read when you need more detail on a DB/security topic. Read them when the topic comes up.

If you have not read the four files above in the current session, read them now before proceeding.

**Specialist skills:** this skill owns the *sequence*; the *how* for each layer lives in
specialist skills routed by `.claude/skills/skill-map.md`. Inline `→ skill <name>` pointers below
mean: read `.claude/skills/<name>/SKILL.md` (and the reference files its decision guide names)
before doing that step. For anything not pointed at explicitly — agent workflows/toolboxes
(`claude-agent-sdk`), ZITADEL/OIDC config (`zitadel-expert`), Vue Flow/elkjs canvases
(`vue-flow-expert`), VueUse utilities (`vue-use-expert`) — consult the map.

---

## Spec File Required

**Always ask for the spec file if none has been provided.**

Implementation must be driven by `.ui.md` and `.data.md` files under `.claude/specs/`.
The user can specify just the directory these files are in.
If the user has not specified which spec to implement, ask:

> "Which spec should I implement? Please provide the path(s) to the `.ui.md` and `.data.md`
> files under `.claude/specs/` (and `_shared.data.md` if the module has one). The directory
> containing these files is sufficient."

**[FILL IN] gate:** If any `[FILL IN]` marker or unchecked **Open Questions** item remains
in the spec, stop immediately and ask the user to resolve it. Do not guess or invent values.

**Two entry points** (user directive 2026-07-09):
- **A plan file** (`.claude/issues/**/*.plan.md`, via its Execution Directive) → execute it.
- **A spec README** (via the README's Execution Directive — every spec dir has one) →
  **first author the plan file**: derive a numbered `.claude/issues/identified/` plan (R23
  naming + self-referential Execution Directive) from the README's Implementation Task List,
  sequenced with verified code anchors the way `0010__loc_______breweries-dataset…` was. Then
  ask the **go/no-go question** — explicit yes/no via AskUserQuestion, never a soft prompt:

  > **Plan created at `<path>`. Execute it now?** — Yes / No

  Yes → run the plan in this session. No → stop; the plan file's own Execution Directive is
  the durable entry point.

---

## Monorepo Layout

```
apps/auth-app          → nginx /auth         (port 3000 in Docker)   extends auth-layer
apps/home-app          → nginx /             (port 3000 in Docker)   extends tenant-layer
apps/tenant-app        → nginx /tenant       (port 3000 in Docker)   extends tenant-layer — NO server/ dir
apps/msg-app           → nginx /msg          (port 3000 in Docker)   extends msg-layer
apps/storage-app       → nginx /storage      (port 3000 in Docker)   extends storage-layer
apps/graphql-api-app   → nginx /graphql-api  (port 3000 in Docker)   PostGraphile 5 + extendSchema plugins (triggerWorkflow, downloadUrl)
apps/agent-app         → HEADLESS (no nginx)                         primary workflow engine — Claude Agent SDK harness (exerciser, sync-breweries, asset-scan + reaper; sync-airports moved to n8n 2026-07-20); the PARALLEL n8n engine (R22 dual engines) is a compose service trio, not an app — n8n-parallel-engine spec, skill n8n-cli
packages/auth-layer      Nuxt layer: layout, AppNav, LoginForm, UserProfile, useAuth; server/utils claims+cookies
packages/tenant-layer    Nuxt layer: extends auth-layer; server/middleware/auth.ts (applyEventClaims)
packages/msg-layer       Nuxt layer: extends tenant-layer; WebSocket carve-out server/
packages/storage-layer   Nuxt layer: extends tenant-layer; upload endpoint carve-out server/api/upload.post.ts + asset UI
packages/fnb-types       type-only leaf: the shared type vocabulary (entities + enums); UI/db-access import types ONLY from here
packages/auth-ui         compiled lib: useAuth() — claims in localStorage, fetched via GraphQL
packages/db-access       compiled lib: pre-claims root of trust (raw pg), 2-arg withClaims; types come from fnb-types
packages/graphql-client-api  compiled lib: .graphql docs + codegen hooks + mappers + composables (the default data layer)
db/fnb-auth  fnb-app  fnb-agent  fnb-res  fnb-msg  fnb-todo  fnb-loc  fnb-storage  fnb-location-datasets  fnb-airports   sqitch packages
docker/nginx.conf       path-based proxy: /auth→auth-app, /tenant→tenant-app, /graphql-api→graphql-api-app, /msg→msg-app, /storage→storage-app, /→home-app (agent-app not routed)
```

`db-types` is retired (was Kysely/Kanel) — `db-access` + `graphql-client-api` replaced it.
**`fnb-types` is the shared type vocabulary** (global-rules R3): the UI and `db-access` import
entity/view types ONLY from `@function-bucket/fnb-types`. Generated GraphQL types are internal to
`graphql-client-api`, reached only via **mappers** (`src/mappers/<entity>.ts`, `to<Entity>(fragment)`).
Enum values in `fnb-types` mirror the GraphQL enum values (UPPERCASE); timestamps are `Date`. The
`graphql-client-api` barrel does NOT `export *` the generated module.
All routed apps share one nginx entry point; each listens on `:3000` inside its container.
`NUXT_APP_BASE_URL` sets the path prefix so Nuxt asset URLs and the router base are correct.
`agent-app` is the headless exception (no nginx location, no base URL) — the primary
workflow engine (R22 dual engines: fnb→agent is trigger-endpoint-only with the shared secret;
agent→fnb is `agent_worker`-via-`_fn` from tool handlers only; closed toolboxes; deterministic
reaper); see `monorepo-bootstrap-pattern.md` → Headless apps. Writing/altering workflow
definitions, toolboxes, or the harness → skill `claude-agent-sdk`. The **parallel n8n engine**
(R22) is a compose service trio on its own host port — per-workflow engine assignment lives in
the `triggerWorkflow` plugin's `WORKFLOW_REGISTRY`; spec `.claude/specs/n8n-parallel-engine/`,
operator loop → skill `n8n-cli`.

---

## Security Model

### Roles
- `authenticator` — DB login role, `NOINHERIT`. The app + PostGraphile connect as this. → [a4]
- `authenticated` — role switched to when claims are present (via `pgSettings` on the GraphQL
  path, or `set local role authenticated` inside `withClaims`). RLS fires for this role.
- `anon`, `service_role` — public / bypass roles. (Unauthenticated GraphQL runs as `anon`.)

### Session / claims flow (current — read `graphql-api-pattern.md` → Auth Context for detail)
Anything touching ZITADEL itself (org/project/app config, scopes, token validation, Actions,
compose service) → skill `zitadel-expert`.
1. Login is **ZITADEL's OIDC ceremony** (code+PKCE, hosted login v1 — `zitadel-login-pattern.md`;
   there is no password path, `auth.login_user`/`auth.user` are dropped). The auth-app callback
   verifies the id_token, calls `provisionIdpUser` + `createSession` (db-access raw pg), and
   creates the **httpOnly `session` cookie**: a **sealed** (encrypted+authenticated, h3
   `useSession` + `NUXT_SESSION_SECRET`) blob carrying `{ id: <profile uuid>, sid: <auth.session
   uuid> }` — auth-layer `server/utils/session.ts`, issues 0010 + 0185. Never raw JSON. The
   cookie is written **only here** — never re-sealed (`session-refresh-pattern.md`).
   **Claims are NOT written to a cookie** (the full JSON overflows the response header → nginx 502).
2. Every request → server middleware (`tenant-layer`, or `auth-app` directly) →
   `applyEventClaims` → `getEventClaims` unseals the `session` cookie (`readAppSession`; unseal
   failure or missing `sid` = unauthenticated) → `claimsForSession(sid)` (`db-access`, SECURITY
   DEFINER) → `event.context.claims`. **Validity lives in the `auth.session` row** (revoked →
   idle 24h → absolute 7d, touch-renewal throttled 1h), not the seal; invalid row or DB error
   reads as unauthenticated, never 500 (`session-refresh-pattern.md`). Logout revokes the row
   (`revokeSession`); `app_api.revoke_my_sessions` = "log out everywhere". → [c6]
3. **Default (GraphQL) path:** PostGraphile's `grafast.context()` reads `event.context.claims` and
   returns `pgSettings` with `role: 'authenticated'` + `request.jwt.claims` (else `role: 'anon'`).
   PostGraphile issues `SET LOCAL ROLE` + `set_config(...)` per operation. **This is the analog of
   the old per-route `withClaims` — there is no per-route wrapper on this path.**
4. **Carve-out path:** authorized operations that run outside GraphQL (the msg-layer WS
   incremental message read; the storage-layer multipart upload endpoint) use
   **`withClaims(claims, fn)` — 2-arg, from `db-access`** (no `db`/trx param):
   ```ts
   const { claims } = event.context
   if (!claims) throw createError({ statusCode: 401 })
   return withClaims(claims, (client) => selectMessageWithSenderById(client, msgId))
   ```
5. **Client:** `useAuth()` (`auth-ui`) keeps `ProfileClaims` in **localStorage** (`useStorage`),
   (re)fetched from GraphQL (`fetchProfileClaims`) on login / session change / hydration.
6. RLS policies call `jwt.uid()`, `jwt.tenant_id()`, `jwt.has_permission(key, tenantId)` — all read
   from `current_setting('request.jwt.claims')`. → [a2] helpers, [a3] policies, [a6] properties.

### ProfileClaims (hand-written source of truth — `packages/fnb-types/src/profile-claims.ts`)
```typescript
{ profileId, tenantId, residentId, actualResidentId,
  profileStatus, permissions: string[], email, displayName, tenantName, modules: ModuleInfo[] }
```
`actualResidentId` = home resident always; differs from `residentId` only in support mode.
Deliberately NOT derived from GraphQL codegen (see global-rules R3).

### Key permission keys
| Key | Who has it |
|-----|-----------|
| `p:app-user` | Every tenant user |
| `p:app-admin` | Tenant admins |
| `p:app-admin-super` | Platform super admins (anchor tenant only) |
| `p:app-admin-support` | Support staff (anchor tenant only) |
| `p:todo` | Todo module users |
| `p:discussions` | Msg module users |

---

## DB Schema Pattern (three layers per module — unchanged, still authoritative)

```
<module>        — tables with RLS
<module>_fn     — SECURITY DEFINER business logic; never called directly from the API surface
<module>_api    — SECURITY INVOKER; permission gate then delegates to _fn; PostGraphile mutation surface
```

The `<module>_api` schemas are exposed to PostGraphile (`pgServices.schemas` in
`apps/graphql-api-app/server/graphile.config.ts`: `app, app_api, msg, msg_api, loc,
loc_api, todo, todo_api, agent, agent_api, storage, location_datasets, location_datasets_api, airports, airports_api, res, res_api` — never `res_fn`). Reads go through RLS-protected selects
PostGraphile generates from the tables; mutations go through `<module>_api.*`.

**URN registry (`fnb-res` — spec `.claude/specs/urn-registry/`):** every registered business
table carries a generated `urn` column + a `DEFERRABLE INITIALLY DEFERRED` FK
`(id) REFERENCES res.resource(id)`, and its `_fn` create sites call
`res_fn.register_resource(_id, _tenant_id, '<module>', '<type>'[, _resident_id])` (delete
sites: `res_fn.archive_resource`). `app.tenant` and `app.resident` register too. **Resident
references are URN columns** (`posted_by_resident_urn`, `resident_urn` …
`text REFERENCES res.resource(urn)`); display names resolve via the relation
`resourceBy<Col> { resident { displayName } }` or the WS carve-out's registry join. The old
`<module>_tenant`/`<module>_resident` mirror tables, `ensure_<module>_resident`, and the
`handle_update_profile` triggers are **removed** — do not reintroduce them. `tenant_id`
columns stay plain `uuid REFERENCES app.tenant(id)` (RLS keys + `build_urn` input). → [c5] is
historical.

### RLS policy template → [a3]
```sql
alter table <module>.<table> enable row level security;
CREATE POLICY view_all_for_tenant ON <module>.<table>
  FOR SELECT USING (jwt.has_permission('p:<module>', tenant_id));
```

### `_api` permission gate template → [a2]
```sql
CREATE OR REPLACE FUNCTION <module>_api.<action>(_args)
  RETURNS <type> LANGUAGE plpgsql VOLATILE   -- SECURITY INVOKER (default)
AS $$
BEGIN
  PERFORM jwt.enforce_permission('p:<module>');       -- raises if missing
  RETURN <module>_fn.<action>(_args, jwt.resident_id());
END; $$;
```
_Verified:_ `msg_api.upsert_topic` → `jwt.enforce_permission('p:discussions')` → `msg_fn.upsert_topic`.

---

## Data Model (core entities)

```
app.tenant         id, name, identifier, type(anchor|customer|demo|test|trial), status
app.profile        id, email, idp_user_id(ZITADEL sub), display_name, status(active|inactive|blocked)
app.resident       id, profile_id(nullable), tenant_id, email, type(home|guest|support),
                   status(invited|declined|active|inactive|blocked_individual|blocked_tenant|supporting)
app.license        id, resident_id, profile_id, tenant_subscription_id, license_type_key, status
app.license_type   key, application_key, assignment_scope(user|admin|superadmin|support|none|all)
app.license_pack   key, auto_subscribe
app.tenant_subscription  tenant_id, license_pack_key, status
app.permission     key (e.g. p:app-admin)
```

Permission flow: `license → license_type → license_type_permission → permission → ProfileClaims.permissions[]`
License types / pack mechanics → [b2], [b3].

### Residency rules → [c2], [c4]
- One active resident per profile at a time (partial unique index `where status='active'`)
- One home resident per profile ever (partial unique index `where type='home'`)
- `assume_residency` activates one, deactivates others, updates `license.profile_id`
- `app_fn.provision_idp_user` (OIDC callback, pre-claims): link profile by `idp_user_id` → adopt
  by email → create profile + link pending residents (the retired `handle_new_user` trigger's
  behavior — `auth.user` and that trigger are dropped)

### Support mode → [e2], [e3]
- `app_api.become_support(tenant_id)` — requires `p:app-admin-super OR p:app-admin-support`;
  sets active resident to `supporting`, creates/reactivates a `type='support'` resident, grants licenses
- `app_api.exit_support_mode()` — deactivates support resident, `assume_residency` on `actual_resident_id`
- Detected client-side: `permissions.includes('p:exit-support')`. Invoked via GraphQL mutations
  (`becomeSupport` in `useSiteAdminTenants`; `exitSupportMode`/`assumeResidency` in `useResidency`).

Anchor tenant uniqueness → [c1].

---

## Adding a New Feature — Checklist

### 1. DB layer (`db/<module>/`) — unchanged from before

→ skill `fnb-db-designer` for schema/RLS/permission design; → skill `sqitch-expert` for plan
mechanics (numbering ranges, cross-project deps, rework); brand-new `db/<package>` → skill
`new-db-package` first (scaffolds files + registers in `DEPLOY_PACKAGES`).

1. `sqitch.plan` entry with dependency on `fnb-app` → [g1] (+ `fnb-res:00000000011000_res`
   if the module registers URNs — every business-object module does)
2. `deploy/<ts>_<module>.sql` — schema, tables, enums; registered tables carry the generated
   `urn` column + deferred FK to `res.resource(id)`; resident references are `*_resident_urn`
   URN columns (no mirror tables)
3. `deploy/<ts>_<module>_fn.sql` — business logic (SECURITY DEFINER);
   `res_fn.register_resource` after each insert, `res_fn.archive_resource` at delete sites
4. `deploy/<ts>_<module>_api.sql` — API functions (SECURITY INVOKER) with `jwt.enforce_permission` gates
5. `deploy/<ts>_<module>_policies.sql` — grants + RLS policies
6. Register via `app_fn.install_basic_application(...)` → [b5], [b4]; add the module to
   `res.module_permission` (registry visibility — urn-registry spec §4.2)
   (Never run any `git` command in a sqitch session.)

### 2. Expose it — confirm PostGraphile sees the schemas
If the module introduces new `<module>` / `<module>_api` schemas, add them to `pgServices.schemas`
in `apps/graphql-api-app/server/graphile.config.ts`. Existing modules are already listed. Smart-tag
overrides go in `apps/graphql-api-app/postgraphile.tags.json5`. → skill `postgraphile-5-expert`.

### 3. graphql-client-api layer (`packages/graphql-client-api/src/`) — this replaces db-types
- Add operation documents under `src/graphql/<module>/{query,mutation,fragment}/*.graphql`. Use
  PostGraphile's auto-generated field names (check `src/generated/fnb-graphql-api.ts` or GraphiQL —
  e.g. `toolsByModuleKeyList`, `subscribersList`).
- Run codegen: `pnpm -F @function-bucket/fnb-graphql-client-api generate` (or root
  `pnpm graphql-api-generate`). Regenerates `src/generated/fnb-graphql-api.ts` (+ `schema.json`,
  `schema.min.json`). The hook name follows the operation: `query FooBar` → `useFooBarQuery()`.
- Add the entity type to `@function-bucket/fnb-types` (if new) and a mapper
  `src/mappers/<entity>.ts` (`to<Entity>(fragment): <Entity>` — un-Maybe, coerce scalars, enum values
  pass through). Expand the fragment to select every field the type needs (global-rules R3).
- Write the composable `src/composables/use{Domain}.ts` — wrap the generated hook(s), call the
  mapper, return `fnb-types` shapes (`computed` data, `fetching`, `error`; no `refresh` — use
  `executeQuery({ requestPolicy: 'network-only' })`). Declare composable **view** types here (R4).
- **Wire into the barrel `src/index.ts` — the #1 miss.** Add `export * from './composables/use{Domain}'`.
  A missing barrel line does NOT surface as a TS/build error — it crashes the Node ESM loader at
  app startup with `does not provide an export named 'X'` pointing at `dist/index.js`. Always verify
  the barrel after adding a file. The barrel does **not** `export *` the generated module (that would
  leak generated types to the UI) — mappers are internal; the UI imports types from `fnb-types`.

### 4. Composable re-export (`apps/<app>/app/composables/`)
```ts
// apps/<app>/app/composables/use{Domain}.ts
export { use{Domain} } from '@function-bucket/fnb-graphql-client-api'
```
Feature apps have **no `server/` directory** — do not add REST routes. The only server code is the
graphql-api-app (GraphQL transport) and the msg-layer WS carve-out.

### 5. Nuxt layer (`packages/<module>-layer/`) — only if adding a whole layer
- `nuxt.config.ts` — `extends: ['@function-bucket/fnb-<parent>-layer']`
- **Nav is registered in the DB, not in a plugin** (R14): the module/tool rows (label, icon key,
  route, ordinal) come from `app_fn.install_basic_application(...)` → [b5], [b4]; `useAppNav()`
  (`packages/tenant-layer/app/composables/useAppNav.ts`) renders sections from
  `useAuth().user.modules` claims. There is no `nav-register.ts` / `useNavRegistry`.
- **`package.json` must declare `"@nuxt/ui": "catalog:"` in `dependencies`** — pnpm does not hoist
  transitive packages, so `@nuxt/ui` is not accessible to TypeScript unless it is a direct
  dependency, even if a parent layer already declares it. Then `pnpm install` at the root.
- **New-dependency workflow (R24):** if the package is already in the `catalog:` block of
  `pnpm-workspace.yaml`, declare it `"catalog:"`; if it's new and shared (or floating-prone), add
  the catalog entry first, then reference it. Never write `latest`/`*`. Gate: `pnpm dep-audit`.

### 6. Nuxt app (`apps/<app>/`)

Brand-new app → skill `fnb-create-app` (full skeleton: package.json, nuxt.config, compose
service, nginx location). The bullets below are for touching an **existing** app.

- `nuxt.config.ts` — `extends: [...]`, set `NUXT_APP_BASE_URL`, declare
  `runtimeConfig.public.graphqlApiUrl` as a `''` sentinel (real value via `NUXT_PUBLIC_*` env)
- Ensure an urql client plugin exists: `app/plugins/urql.client.ts` (`preferGetMethod: false`,
  provides `$urqlClient`). Add `@urql/vue` (`"catalog:"`) to the app `package.json` if missing.
- **`package.json` must declare `"@nuxt/ui": "catalog:"` in `dependencies`** — same hoist reason;
  `import type { TableColumn } from '@nuxt/ui'` fails otherwise. Same new-dependency workflow as
  layers: catalogued packages are declared `"catalog:"`, new shared deps get a catalog entry first.
- Pages in `app/pages/` call composables only — zero `$fetch`/`useFetch`/`/api/` paths
- Components use `useAuth().user.value.permissions` for permission-gated rendering
- Add the Docker service in `docker-compose.yml` + nginx location block in `docker/nginx.conf`
- **UC4** — Wrap page content in `<UCard>`, not bare divs
- **UC5** — Responsive: `flex flex-wrap`, `overflow-x-auto` on tables
- **UC6** — Color tokens only: `primary`, `success`, `error` — no raw Tailwind color classes
- **UC7** — `useToast()` for transient feedback; `<UAlert>` only for persistent warnings
- **UC8** — `<UEmpty>` for zero-item list states — never an empty table with headers and no rows
- **UC11** — Icons are `i-lucide-*` only. **Verify the name exists before using it.** Known bug source.
- **UC12** — Width: `max-w-5xl mx-auto` for hub/list pages; `max-w-3xl mx-auto` for detail pages
- **UC13 — `UTable` uses Nuxt UI v4 API exclusively. Never use v3 `{ key, label }` columns.**

  ```typescript
  // CORRECT — Nuxt UI v4
  import type { TableColumn } from '@nuxt/ui'
  import type { MyType } from '@function-bucket/fnb-graphql-client-api'

  const columns: TableColumn<MyType>[] = [
    { accessorKey: 'name', header: 'Name' },   // data column
    { accessorKey: 'status', header: 'Status' }, // data column
    { id: 'actions' },                           // non-data column (no accessorKey)
  ]
  ```

  ```html
  <!-- CORRECT — cell slots use row.original to access row data -->
  <UTable :data="items" :columns="columns">
    <template #name-cell="{ row }">{{ row.original.name }}</template>
    <template #actions-cell="{ row }">
      <UButton @click="doSomething(row.original.id)" />
    </template>
  </UTable>
  ```

  ```typescript
  // WRONG — v3 API, do not use
  const columns = [{ key: 'name', label: 'Name' }, { key: 'actions', label: '' }]
  // WRONG — v3 cell slot accesses row directly (not row.original)
  // <template #name-cell="{ row }">{{ row.name }}</template>
  ```

---

## Converting an Existing Page from REST to GraphQL

Use this when a page still runs on Nitro REST + `useFetch`. The DB layer and Vue pages do not
change — only the data-fetching layer. (New features start on GraphQL directly — see the checklist.)

### 1. Write (or verify) the GraphQL operation
Add a `.graphql` file in `packages/graphql-client-api/src/graphql/<module>/query/` (or `mutation/`).
Use PostGraphile's auto-generated field names — check `src/generated/fnb-graphql-api.ts` for exact
type/relationship names (e.g. `modulesByApplicationKeyList`).

```graphql
# src/graphql/app/query/myEntityByKey.graphql
query MyEntityByKey($key: String!) {
  myEntity(key: $key) {
    key
    name
    relatedThings: relatedThingsByEntityKeyList { key name }
  }
}
```

### 2. Run codegen
```bash
pnpm -F @function-bucket/fnb-graphql-client-api generate
```
Regenerates `src/generated/fnb-graphql-api.ts`. Hook name follows the operation: `query MyEntityByKey`
→ `useMyEntityByKeyQuery()`.

**Codegen failure signatures to recognize:**
- `TS6059: File is not under 'rootDir'` — generated output must stay under `src/` (it does:
  `src/generated/fnb-graphql-api.ts`). Don't relocate codegen output outside `src/`.
- `Unable to find template plugin matching 'typescript-operations'` — the plugin is missing from
  `packages/graphql-client-api/package.json` devDependencies; add it and `pnpm install`.
- `TS2308: already exported` — do **not** re-export both `./generated/fnb-graphql-api` and a second
  file that re-declares the same types from the barrel.

### 3. Write the wrapper composable
Create `packages/graphql-client-api/src/composables/use{Domain}.ts`. Import the generated hook from
`../generated/fnb-graphql-api`. Normalize the response so pages need no template changes:

```typescript
import { computed } from 'vue'
import { useMyEntityByKeyQuery } from '../generated/fnb-graphql-api'

export function useMyEntity(key: string) {
  const { data, fetching, error } = useMyEntityByKeyQuery({ variables: { key } })
  return {
    data: computed(() => {
      const e = data.value?.myEntity
      if (!e) return null
      return { entity: { key: e.key, name: e.name }, relatedThings: e.relatedThings }
    }),
    fetching,
    error,
  }
}
```

**Return shape rules:**
- `data` is always a `computed()` ref — not the raw urql `data` ref
- `fetching` replaces `pending` from `useFetch`
- No `refresh` — use `executeQuery({ requestPolicy: 'network-only' })` from the raw urql hook
- Flatten nested GraphQL relationships when the page expects flat arrays (e.g. `modules[].tools` → `tools[]`)
- Map permission objects to string arrays: `.map(p => p.permissionKey)`

### 4. Export from the package barrel
Add to `packages/graphql-client-api/src/index.ts`: `export * from './composables/use{Domain}'`.
Do **not** re-export a file that re-declares generated types (→ `TS2308`).

### 5. Rebuild the package
```bash
pnpm -F @function-bucket/fnb-graphql-client-api build
```
Clean build with no TS errors before the next steps.

### 6. Update the app composable re-export
```typescript
// apps/<app>/app/composables/use{Domain}.ts
export { useMyEntity } from '@function-bucket/fnb-graphql-client-api'
```
The page file needs **no changes** — it still calls `useMyEntity()` via auto-import, now
GraphQL-backed. Delete any obsolete `server/api/<module>/*` route the page used to hit.

### 7. Verify the urql plugin is configured
`apps/<app>/app/plugins/urql.client.ts` must exist with:
- `preferGetMethod: false` — **required**: PostGraphile rejects GET with 405
- `url: pub.graphqlApiUrl` from `runtimeConfig.public.graphqlApiUrl`
- `provide: { urqlClient: client }` so `useAuth().refreshClaims()` can reach it outside setup
If `@urql/vue` is not in the app `package.json`, add it (`"catalog:"`) — then restart Docker (step 8).

### 8. Docker: install new packages + build graphql-client-api
Docker uses named volumes for `node_modules` — a local `pnpm install` does **not** update the
containers. **Do not rebuild/restart the environment yourself — ask the user** (memory
`feedback_rebuild_ask_user`), then do read-only verification. The restart they run is:
```bash
docker compose down && docker compose up
```
`packages-watch` must build+watch `fnb-graphql-client-api` (it does — see
`package-layers-pattern.md` → Codegen Workflow and the healthcheck testing
`/app/packages/graphql-client-api/dist/index.js`).

### 9. Verify end-to-end (read-only)
1. Navigate to the page — it should render data
2. Network tab: confirm `POST /graphql-api/api/graphql` with the expected operation name (not a GET, not a REST route)
3. No console errors about a missing urql client or `server.mjs` not found

---

## Completion Hand-off — required final step (user directive 2026-07-09)

When a plan finishes executing (implementation complete and verified), or an update run against
an existing plan wraps up, end with an **explicit yes/no question to the user** (AskUserQuestion
— same pattern as the go/no-go above; this also satisfies memory
`feedback_ask_before_moving_addressed`):

> **`<plan-file>` is fully executed and verified. Move it to `.claude/issues/addressed/`?**
> — Yes / No

- **Yes** → move the file (filename unchanged — status is the directory, never the name; R23).
- **No** → leave it where it is and note what the user wants to see first.

Never move a plan to `addressed/` without this question, and never end a completed run without
asking it.

---

## Testing Conventions (compiled packages only)

Applies to `packages/` only. Apps (`apps/`) have no testing convention yet.

- Tests live in `src/tests/` — never alongside source files
- File naming: `*.spec.ts` — always `.spec.ts`, never `.test.ts`

### `vitest.config.ts` — required for every package with a `test` script
Vitest does **not** reliably inherit `vite.config.ts` through Turborepo, so every package with a
`test` script needs its own `vitest.config.ts`.

**Package with tests:**
```typescript
import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, './src') } },
  test: { include: ['src/tests/**/*.spec.ts'] },
})
```
**Package with no tests yet** (prevents turbo failure):
```typescript
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { passWithNoTests: true } })
```

`pnpm build` is the gate (repo-wide `pnpm lint` is known-broken — memory `project_eslint_broken`).

---

## Key File Paths (quick reference)

| Thing | Path |
|-------|------|
| Login (OIDC redirect + callback) | `apps/auth-app/server/api/auth/oidc/{login,callback,logout}.get.ts` |
| Claims bootstrap (server) | `packages/auth-layer/server/utils/getEventClaims.ts` → `currentProfileClaims` |
| Apply claims to request | `packages/auth-layer/server/utils/applyEventClaims.ts` |
| Auth middleware (tenant apps) | `packages/tenant-layer/server/middleware/auth.ts` |
| `withClaims` (2-arg) | `packages/db-access/src/with-claims.ts` |
| Pre-claims fns | `packages/db-access/src/mutations/{provision-idp-user,create-session,claims-for-session,revoke-session,current-profile-claims,profile-claims-for-user}.ts` |
| Session table + fns (0185/0180) | `db/fnb-app/deploy/00000000010290_session.sql` (`auth.session`, `app_fn.claims_for_session`, `app_api.revoke_my_sessions`) |
| Shared types (fnb-types) | `packages/fnb-types/src/*.ts` (barrel `src/index.ts`) |
| ProfileClaims type | `packages/fnb-types/src/profile-claims.ts` |
| Entity mappers | `packages/graphql-client-api/src/mappers/<entity>.ts` (`to<Entity>(fragment)`) |
| db-access barrel | `packages/db-access/src/index.ts` |
| graphql codegen config | `packages/graphql-client-api/codegen.ts` |
| generated GraphQL hooks | `packages/graphql-client-api/src/generated/fnb-graphql-api.ts` |
| graphql composables | `packages/graphql-client-api/src/composables/` |
| graphql-client-api barrel | `packages/graphql-client-api/src/index.ts` |
| PostGraphile preset + grafast context | `apps/graphql-api-app/server/graphile.config.ts` |
| grafserv H3 singleton | `apps/graphql-api-app/server/graphserv/serv.ts` |
| GraphQL endpoint | `apps/graphql-api-app/server/api/graphql.ts` |
| useAuth (claims in localStorage) | `packages/auth-ui/src/use-auth.ts` |
| fetch claims via GraphQL | `packages/graphql-client-api/src/composables/useProfileClaims.ts` |
| useAppNav (renders nav from claims `modules`) | `packages/tenant-layer/app/composables/useAppNav.ts` |
| Nav source of truth (module/tool rows, R14) | `db/fnb-app/deploy/00000000010240_app_fn.sql` (`install_application`) |
| Core DB schema | `db/fnb-app/deploy/00000000010220_app.sql` |
| RLS policies | `db/fnb-app/deploy/00000000010250_app_policies.sql` |
| JWT schema | `db/fnb-auth/deploy/00000000010150_jwt.sql` |
| Claims assembly | `db/fnb-app/deploy/00000000010240_app_fn.sql` |
| Support mode SQL | `db/fnb-app/deploy/00000000010243_app_fn_support.sql` |
| becomeSupport / exitSupport (GraphQL) | `packages/graphql-client-api/src/graphql/app/mutation/{becomeSupport,exitSupportMode}.graphql` |
| Sealed session utils (0010) | `packages/auth-layer/server/utils/session.ts` |
| Auth cookie cleanup | `packages/auth-layer/server/utils/auth-cookies.ts` (`deleteAuthCookies`) |
| OIDC login/callback (ZITADEL) | `apps/auth-app/server/api/auth/oidc/{login,callback,logout}.get.ts` + `server/utils/oidc.ts` |
| WS message read (withClaims carve-out) | `packages/msg-layer/server/api/topics/[id]/messages/[msgId].get.ts` |
| Upload endpoint (withClaims carve-out) | `packages/storage-layer/server/api/upload.post.ts` |
| agent workflow engine (harness/workflows/tools) | `apps/agent-app/server/lib/{agent-harness.ts,agent-workflows/,agent-tools/}` (skill `claude-agent-sdk`) |
| nginx config | `docker/nginx.conf` |
| docker-compose | `docker-compose.yml` |

---

## Special Cases to Remember

- **`withClaims` is 2-arg** (`withClaims(claims, fn)`) and only in the `db-access` root-of-trust,
  the msg-layer WS carve-out, and the storage-layer upload endpoint. There is no `db`/trx param and
  no per-route `withClaims` on the default GraphQL path (grafast context handles it). Never write
  the retired 3-arg `withClaims(db, claims, trx => …)`.

- **Never GraphQL-ify the pre-claims functions.** `provisionIdpUser` / `createSession` /
  `claimsForSession` / `revokeSession` / `profileClaimsForUser` / `currentProfileClaims` run
  before claims exist and stay raw `pg` in `db-access`. This is the most likely wrong "cleanup" —
  do not do it. (`loginUser` is retired — ZITADEL owns authentication.)

- **`to_jsonb` yields snake_case**; `db-access`'s `camelCaseKeys` recursively camelCases nested keys
  (the retired Kysely `CamelCasePlugin` behavior — memory `project_camelcase_plugin_nested_keys`).
  Don't reintroduce CamelCasePlugin language.

- **Claims live in localStorage, not a cookie.** `useAuth()` mirrors `ProfileClaims` to localStorage
  from GraphQL; the httpOnly `session` cookie stays the root of trust — a **sealed blob** (0010),
  managed only by auth-layer `server/utils/session.ts` (`setAppSession`/`readAppSession`/
  `clearAppSession`; `auth-cookies.ts` `deleteAuthCookies` clears it + the legacy `auth.user`
  cookie). Never `setCookie`/`getCookie` the session directly. Session-changing operations
  (login / `becomeSupport` / `exitSupportMode` / `assumeResidency`) re-fetch claims via GraphQL
  (`refreshClaims`) rather than rewriting a claims cookie. → [e1]

- **The barrel is the #1 miss (three barrels now).** `packages/fnb-types/src/index.ts`,
  `packages/db-access/src/index.ts`, and `packages/graphql-client-api/src/index.ts` must each list
  every export or Node ESM crashes at app startup (`does not provide an export named 'X'` at
  `dist/index.js`) — a runtime crash, not a build error. Always verify the barrel after adding a file.

- **Iconify per app:** each Nuxt app must declare `@iconify-json/*` directly or `i-lucide-*` icons
  render blank in Docker (memory `project_iconify_collection_per_app`).

- **Scoped license uniqueness:** one license per scope per application. `app_fn.grant_user_license`
  deletes the existing scoped license before inserting the new one → [c7].

- **`profile_id` nullable on resident:** invited users have no profile yet; `handle_new_user` links
  them on registration → [c4].

- **`NUXT_APP_BASE_URL`** must match the nginx `location` prefix (asset URLs, `<NuxtLink>`, `router.push`).

- **`packages-watch` healthcheck** waits for `db-access`, `graphql-client-api`, `auth-server`,
  `auth-ui` dist files before apps start.

- **Anchor tenant:** `type='anchor'`, only one allowed; super admin / support licenses locked to the
  `anchor` license pack by partial unique indexes → [c1].

- **`app_fn.install_basic_application`:** the standard way to register a new module → [b5].

---

## Pattern Docs

Core specs in `.claude/specs/` (the single source — do not restate them inline, per global-rules R21):
- `global-rules.md` — R1–R24 (required reading)
- `graphql-api-pattern.md` — the canonical data stack: DB → PostGraphile 5 → urql/graphql-client-api
  → composable re-export → Vue, plus the REST/H3 carve-out and pre-claims root of trust
- `package-layers-pattern.md` — the seven packages: compiled libs, Nuxt layers, file inventories, codegen workflow
- `graphql-client-api-package.md` — codegen details for the client package
- `sockets-pattern.md` — WebSocket / real-time pattern (GraphQL initial load + WS incremental read)
- `ui-components-rules.md` — UC1–UC12
- `monorepo-bootstrap-pattern.md` — Docker Compose topology, nginx routing, pnpm workspace config
- `workspace-dependency-integrity-pattern.md` — R24: every package declares every bare specifier
  its own source/config resolves (the `@nuxt/ui` direct-dep rule is a special case); layers are
  self-preparable TS projects (own `tsconfig.json` + `nuxt prepare`); one version per external
  package via the pnpm default catalog (`"catalog:"` protocol); `scripts/dep-audit.ts` gate

Architecture deep-reference in `.claude/specs/architecture-considerations/read-these/`:

| Code | File | Topic |
|------|------|-------|
| a2 | `a2-auth-sql-helpers.md` | `jwt.*()` helper implementations and JWT payload shape |
| a3 | `a3-rls-policy-reference.md` | Complete RLS policy reference for every table |
| a4 | `a4-noinherit-explanation.md` | Why `authenticator` is `NOINHERIT` and what breaks without it |
| a6 | `a6-security-properties-table.md` | How each security property is enforced |
| b2 | `b2-built-in-license-types.md` | All built-in license types and which permissions they grant |
| b3 | `b3-license-pack-mechanics.md` | `number_of_licenses` semantics, `auto_subscribe`, expiration |
| b4 | `b4-anchor-module-tool-structure.md` | Module/tool nav tree for the anchor application |
| b5 | `b5-install-basic-application.md` | Exact SQL call signature with composite type casts |
| c1 | `c1-anchor-tenant-unique-indexes.md` | Partial unique indexes enforcing anchor tenant exclusivity |
| c2 | `c2-residency-uniqueness-constraints.md` | Three constraints enforcing the multi-residency model |
| c4 | `c4-handle-new-user-trigger.md` | HISTORICAL (trigger dropped at ZITADEL cutover) — the provisioning behavior now lives in `app_fn.provision_idp_user` |
| c5 | `c5-display-name-propagation.md` | Per-module display_name trigger pattern |
| c6 | `c6-profile-claims-functions.md` | `profile_claims_for_user` vs `current_profile_claims` — when to call each |
| c7 | `c7-self-modification-prevention.md` | Self-mod check in `grant_user_license` |
| d1 | `d1-websocket-upgrade-auth.md` | `upgrade()` vs `open()` hook semantics — always auth in upgrade |
| d4 | `d4-pg-notify-channel-naming.md` | Channel name pattern: `topic:<id>:message` |
| d5 | `d5-pg-client-not-pool.md` | Why the pg-notify bridge uses a dedicated `pg.Client` not a pool |
| d6 | `d6-channel-peers-map.md` | Hand-rolled `channelPeers` Map — why we don't use crossws publish |
| e1 | `e1-cookie-refresh-pattern.md` | Session-cookie handling for session-changing operations |
| e2 | `e2-support-mode-detection.md` | Detecting support mode via `p:exit-support` permission |
| e3 | `e3-become-support-permission-check.md` | `canSupport` computed and post-support navigation pattern |
| g1 | `g1-sqitch-deployment-order.md` | Sqitch package dependency graph and cross-package syntax |
| pg | `postgraphile-service-setup.md` | PostGraphile 5 setup: routing, auth integration, problems solved |

> Note: some deep-reference docs predate the GraphQL migration and may describe the old REST/Kysely
> transport. Trust the code and the pattern files above where they differ; the deep-reference docs
> remain accurate for the **DB / SQL / security** topics they cover.
