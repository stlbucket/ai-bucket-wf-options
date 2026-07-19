---
name: function-bucket-legacy-ui-converter
description: >
  Converts UI components and feature modules from the legacy function-bucket Nuxt 3 project
  into the modern fnb Nuxt 4 monorepo. Modules: app, todo, msg, loc, wf.
  Invocation forms: no args = full scout all modules; <module> = scout one module;
  <module> convert = interactive conversion (asks what to convert before starting);
  component <path> = convert a single component; page <path> = convert a page + all child
  components + API routes + nav registration.
---

# Function-Bucket Legacy UI Converter

You are an expert at migrating Nuxt 3 applications to Nuxt 4 monorepos. Your job is to help
convert the legacy function-bucket project's UI into the modern fnb monorepo structure.

---

## Project Locations

| Project | Path |
|---|---|
| Legacy (source) | `~/function-bucket/function-bucket` |
| Target (destination) | `/Users/buckfactor/claude/projects/fnb` |

---

## Known Tech Stack Differences

| Dimension | Legacy | Target |
|---|---|---|
| Nuxt version | 3, SPA mode | 4, multi-app monorepo |
| UI kit | Nuxt UI **v2** | Nuxt UI **v4** |
| Auth | Supabase (`useSupabaseUser`, `useSupabaseClient`) | ZITADEL OIDC + httpOnly `session` cookie + `useAuth()` (claims in localStorage, fetched via GraphQL); login/logout are `auth-app` OIDC routes (`/auth/api/auth/oidc/{login,callback,logout}`); **no password/change-password path** — ZITADEL owns credentials |
| Data fetching | URQL + generated GraphQL | **URQL + PostGraphile 5** (same shape!) — composables in `graphql-client-api`, re-exported per app |
| App structure | Single app, `pages/` at root | `apps/` + `packages/` shared layers |
| DB migrations | Supabase raw SQL | Sqitch packages (already deployed) |
| Icons | `i-heroicons-*` (dynamic) | Iconify: `i-lucide-*` or `i-simple-icons-*` |
| Pinia persistence | `pinia-plugin-persistedstate` + Supabase | Pinia available; no Supabase persistence plugin |
| Real-time | `supabase.channel()` subscriptions | msg-layer WebSocket infra (pg-notify bridge, `_ws` routes) — see `.claude/specs/sockets-pattern.md` |
| Workflow engine | Vue Flow + XState | `@vue-flow/*` + `elkjs` already installed (graphql-api-app); XState not installed |

---

## Conversion Rules (apply every time)

### Nuxt 3 → 4 structure
- Legacy: `pages/`, `components/`, `composables/`, `store/` at project root
- Target: same dirs live inside `app/` subdirectory within each Nuxt app

### Nuxt UI v2 → v4
- `UCard` default slot → named `#default` slot; `#header` and `#footer` work differently — check v4 docs
- `UTable` columns API changed — verify each column definition
- `UModal` / `USlideover`: `v-model` still works but some props renamed
- `UButton` `variant` values changed (`soft`, `ghost`, `outline` remain; `link` is new)
- `UDropdown` → `UDropdownMenu` in v4
- `UFormGroup` → `UFormField` in v4
- Always check Nuxt UI v4 docs for any component before assuming v2 API works

### Auth replacement
Remove all of the following from legacy code:
- `useSupabaseUser()` → `useAuth().user`
- `useSupabaseClient()` → remove; auth calls go through server routes
- `$supabase` in templates → remove entirely
- `supabase.auth.signIn*` / `signOut` → navigate to the auth-app OIDC routes
  (`/auth/api/auth/oidc/login`, `logout`) — `useAuth()` already exposes the helpers
- Any password-management UI (change/reset password) → **drop it**; ZITADEL owns the
  credential ceremony and there is no password path in fnb

### URQL / GraphQL — the natural path (legacy already used URQL)
fnb's default data layer **is** urql + PostGraphile 5, so legacy URQL maps almost 1:1:
- Legacy `.graphql` document → add it under `packages/graphql-client-api/src/graphql/<module>/{query,mutation,fragment}/`, run codegen (`pnpm -F @function-bucket/fnb-graphql-client-api generate`)
- Legacy `useQuery(SomeDocument, vars)` → the generated `useSomeQuery()` hook, wrapped in a composable at `packages/graphql-client-api/src/composables/use<Domain>.ts` (shapes the response; `fetching`/`error`; no `refresh` — use `executeQuery({ requestPolicy: 'network-only' })`)
- Legacy `useMutation(SomeDocument)` → the generated `useSomeMutation()` hook in that composable; mutations hit `<module>_api.*` (permission-gated)
- The page auto-imports a **thin re-export** in `apps/<app>/app/composables/use<Domain>.ts`
- **Do NOT convert GraphQL to Kysely/REST routes** — that was the pre-migration guidance and is now wrong. PostGraphile field names come from `src/generated/fnb-graphql-api.ts` (or GraphiQL).
- PostGraphile is served by `apps/graphql-api-app` (schemas in `server/graphile.config.ts`). Each app needs an urql client plugin (`app/plugins/urql.client.ts`, `preferGetMethod: false`).

### Icon replacement
- `<UIcon name="i-heroicons-check" />` → `<UIcon name="i-lucide-check" />`
- Map heroicons names to lucide equivalents (usually identical or close)
- Use `i-simple-icons-*` for brand logos

### Pinia stores
- Remove any `persistedstate` that references Supabase
- Local-only persistence via `localStorage` still works (persistedstate is available in fnb)
- Remove Supabase user references from store state

### Workflow module only
- `@vue-flow/core`, `@vue-flow/background`, and `elkjs` are already deps of **graphql-api-app**;
  if the workflow UI lands in a different app, add them (plus `@vue-flow/controls`) to that
  app's `package.json` before converting — see the **vue-flow-expert** skill for layout patterns
- XState (`xstate`, `@xstate/vue`) is not installed anywhere yet — add it if the converted
  code needs it
- New per-app deps need a full docker down/up cycle — ask the user; never restart the env yourself

---

## Conversion Stack Pattern

This section encodes the full vertical slice learned from the TenantList conversion. Apply these
patterns when replacing any legacy GraphQL-driven component.

### GraphQL → Data Layer mapping (legacy URQL → fnb URQL — nearly 1:1)

| Legacy layer | Modern equivalent |
|---|---|
| `.graphql` query document | `.graphql` document in `packages/graphql-client-api/src/graphql/<module>/query/` |
| Generated URQL composable (`useSearchTenantsQuery`) | the same generated hook in `src/generated/fnb-graphql-api.ts` (after codegen), wrapped in a composable |
| PostGraphile resolver | PostGraphile auto-generates it from the `<module>` / `<module>_api` schemas (`graphql-api-app`) |
| Reactive search: `executeQuery({ requestPolicy: 'network-only' })` | **unchanged** — same urql API |
| `useMutation(...)` + `supabase.auth.refreshSession()` | the generated `useSomeMutation()` hook → then `useAuth().refreshClaims()` if the mutation changed the session |

### Canonical composable (in `graphql-client-api`)

`packages/graphql-client-api/src/composables/useSiteAdminTenants.ts`:
```typescript
import { computed } from 'vue'
import { useSearchTenantsQuery } from '../generated/fnb-graphql-api'

export type TenantSummary = { id: string; name: string /* … view type lives here */ }

export function useSiteAdminTenants() {
  const { data, fetching, error, executeQuery } = useSearchTenantsQuery({ variables: { searchTerm: null } })
  const tenants = computed<TenantSummary[]>(() => (data.value?.searchTenants ?? []).filter(Boolean).map(/* → TenantSummary */))
  return { tenants, fetching, error, executeQuery }
}
```
- Add the `.graphql` doc under `src/graphql/<module>/…`, run codegen, wrap the hook here
- Export the composable from `packages/graphql-client-api/src/index.ts` (barrel)
- Re-export from `apps/<app>/app/composables/use<Domain>.ts` (one line) so the page auto-imports it
- There is **no** `db-types` / Kysely / `event.context.db` / H3 GET route — that stack is retired

### UTable cell slot names (v2 → v4)

- v2: `#<field>-data` (e.g. `#name-data`, `#status-data`)
- v4: `#<field>-cell` (e.g. `#name-cell`, `#status-cell`)

### Nav registration pattern

Nav is **claims-driven**, like legacy — there is no static registry and no `nav-register.ts`.
`useAppNav()` (`packages/tenant-layer/app/composables/useAppNav.ts`) maps
`useAuth().user.modules` (`ModuleInfo[]` with nested `ToolInfo[]` from `fnb-types`) into nav
sections; permission filtering already happened server-side when the claims were assembled.

To make a converted page appear in nav:
- The page's **module + tool rows must exist in the DB** (`app_fn.install_application` /
  `install_basic_application` define modules, tools, routes, and icon keys)
- The user needs a license whose permissions include that module
- `ToolInfo.route` must match the converted page's route

If the module/tool rows don't exist yet, that's DB work — hand off to the **fnb-db-designer**
skill rather than inventing a frontend registry.

### Auth session refresh after privilege mutation (e.g. becomeSupport)

- Legacy: `supabase.auth.refreshSession()` then `refreshCurrentProfileClaims()`
- Modern: run the GraphQL mutation (e.g. `useBecomeSupport()`), then `useAuth().refreshClaims()` —
  which re-fetches `ProfileClaims` via GraphQL into **localStorage** (there is no claims cookie and
  no `fetchUser()`)

---

## fnb Monorepo Structure (target)

```
apps/
  auth-app/        — auth root of trust: OIDC login/callback/logout H3 routes + profile pages
  graphql-api-app/ — PostGraphile 5 GraphQL server
  worker-app/      — headless graphile-worker runner
  tenant-app/      — Main tenant workspace app (todos, discussions, maps, workflows live here)
  msg-app/         — Discussions app (extends msg-layer; WebSocket)
  storage-app/     — Uploads/assets app (extends storage-layer)
  home-app/        — Landing/marketing page
packages/
  fnb-types/       — Shared type-only vocabulary (ModuleInfo, ToolInfo, entity types)
  auth-layer/      — Shared Nuxt layer: auth composables, middleware (applyEventClaims), auth UI
  auth-server/     — Server-side pg utilities (useFnbPgClient)
  tenant-layer/    — Shared Nuxt layer: extends auth-layer, tenant composables + useAppNav
  msg-layer/       — Shared Nuxt layer: extends tenant-layer, WebSocket infra
  storage-layer/   — Shared Nuxt layer: extends tenant-layer, upload/asset infra
  auth-ui/         — Vue 3 auth UI + useAuth() (claims in localStorage via GraphQL)
  db-access/       — Pre-claims root of trust (raw pg), 2-arg withClaims, hand-written types
  graphql-client-api/ — urql GraphQL codegen hooks + composables (the default data layer)
db/                — nine sqitch packages, all deployed:
  fnb-auth, fnb-app, fnb-msg, fnb-todo, fnb-loc, fnb-wf, fnb-storage, fnb-location-datasets, fnb-airports
```

**Where each module's UI lands:**
- **App**: tenant admin pages (residencies, subscriptions, licenses) → `apps/tenant-app/app/pages/admin/`; site-admin pages → `apps/tenant-app/app/pages/site-admin/`; common layout/nav components → `packages/tenant-layer/app/components/`
- **Todo**: `apps/tenant-app/app/` (pages + components) + shared composables in `packages/tenant-layer/`
- **Msg/Discussions**: `apps/tenant-app/app/`
- **Loc/Maps**: `apps/tenant-app/app/` — tenant-app already ships `mapbox-gl` + `nuxt-mapbox`
  (do NOT introduce leaflet); loc pages exist under `app/pages/loc/`
- **Workflow**: `apps/tenant-app/app/` (add Vue Flow/elkjs deps there if that's where it lands
  — currently they live in graphql-api-app; XState not installed)

---

## Module → Legacy Directory Map

| Module | Legacy components | Legacy pages | Legacy GraphQL / other |
|---|---|---|---|
| `app` | `components/App/admin/`, `components/App/profile/`, `components/App/site-admin/`, `components/App/tools/`, `components/_common/MenuBar*`, `components/_homepage/` | `pages/admin/`, `pages/site-admin/`, `pages/index.vue` | `composables/has-permission.ts`, `composables/use-available-modules.ts`, `store/` |
| `todo` | `components/Todo/` | `pages/tools/todo/` | `graphql/todo/` |
| `msg` | `components/Msg/` | `pages/tools/discussions/` | `graphql/discussions/` |
| `loc` | `components/Loc/`, `components/Map/` | `pages/tools/maps/` | `graphql/locations/` |
| `wf` | `components/Wf/` | `pages/tools/workflow/`, `pages/tools/flow/`, `pages/site-admin/wf/`, `pages/flow-play.vue`, `pages/flow-play-waiting.vue` | `lib/flowModels/`, `lib/worker-task-handlers/`, `composables/use-wf-layout/` |

---

## Invocation Forms

The skill handles three distinct invocation forms. Parse the ARGUMENTS string to determine which mode to use:

### Form 1 — No arguments: Full scout all modules
`/function-bucket-legacy-ui-converter`

Run the scout phase across all 5 modules (app, todo, msg, loc, wf). For each module produce:

```markdown
## [Module Name]

**Complexity**: Low / Medium / High
**Data layer**: urql + PostGraphile via `graphql-client-api` (the default; the legacy URQL maps almost 1:1 — do not convert to Kysely/REST)
**New dependencies needed**: [list or "none"]

### Legacy files to convert
| Legacy path | Target path | Notes |
|---|---|---|
| components/Todo/TodoTree.vue | apps/tenant-app/app/components/Todo/TodoTree.vue | Recursive |

### Pages / routes
| Legacy route | Target route | Notes |
|---|---|---|
| /tools/todo | /tools/todo | |

### GraphQL → data layer
| Legacy GQL file | Replacement approach |
|---|---|
| graphql/todo/queries.ts | `.graphql` docs in `graphql-client-api/src/graphql/todo/` + generated hooks + composable (urql, near 1:1) |

### Conversion risks
- Supabase-specific patterns present
- v2 UI components with breaking v4 changes
- Real-time subscriptions that need replacement
```

End with a **Priority recommendation** — which module to start with (simplest first to validate approach).

Do NOT write any code. Read, analyze, and plan only.

---

### Form 2 — Module name only: Scout one module
`/function-bucket-legacy-ui-converter <module>`

Where `<module>` is one of: `app`, `todo`, `msg`, `loc`, `wf`

1. Use the Module → Legacy Directory Map above to find all relevant files
2. Read each legacy file
3. Check the target location for what already exists
4. Produce:
   - A **file inventory** grouped by type (page, component, composable, store, GQL)
   - A **file-by-file checklist** — each file as a checkbox with conversion notes and target path
   - **Dependencies to install** before starting
   - **Sequence recommendation** — which file to convert first (simplest leaf component, not the root page)

Do NOT write any code. Read, analyze, and plan only.

---

### Form 3 — Interactive conversion: Convert files for a module
`/function-bucket-legacy-ui-converter <module> convert`

Before writing any code, use AskUserQuestion to ask the user what they want to convert:

**Question**: "What would you like to convert for the `<module>` module?"
**Options**:
- "The entire UI layer" — all components, pages, composables, and stores in the module map
- "Specific file(s)" — follow up: ask the user to name the file(s) (comma-separated filenames or paths)
- "A directory or group" — follow up: ask the user for the directory path or file pattern

Once the scope is confirmed, proceed:

**For entire UI layer:**
1. List all files from the module map
2. Sort by dependency order — leaf components (no local imports) first, then files that depend on them
3. Convert each file in sequence, applying all conversion rules
4. After each file, confirm it was written before moving to the next
5. End with summary: files converted, unresolved imports

**For specific file(s):**
1. Locate each named file in the legacy project using the module map
2. Read the file in full and any unconverted direct imports
3. Apply all conversion rules
4. Write the converted file to the correct target path
5. Report: what was written, what still needs conversion

**For a directory or group:**
1. List all files matching the scope
2. Sort by dependency order
3. Convert each in sequence, confirming each write before moving on
4. End with summary: files converted, unresolved imports

**In all cases:** After conversion, flag any remaining `useSupabaseUser`, `useQuery`, `useMutation`, `i-heroicons-`, or `UFormGroup`/`UDropdown` references explicitly.

---

### Form 4 — Single component or page conversion
`/function-bucket-legacy-ui-converter component <path/to/LegacyComponent.vue>`
`/function-bucket-legacy-ui-converter page <path/to/legacy/page.vue>`

Parse the first word of ARGUMENTS to detect `component` or `page`, then the remainder is the path.
The path may be relative to the legacy project root (`~/function-bucket/function-bucket`) or absolute.

**`component` mode** — convert a single component:
1. Read the named legacy component in full
2. Identify: GQL queries/mutations used, Nuxt UI v2 components, heroicons, Supabase calls, composables
3. Derive the target path using the module map (legacy `components/` path → target `app/components/` path)
4. Check if a corresponding GraphQL composable already exists in `graphql-client-api` for the data the component needs
5. Apply all conversion rules (see Conversion Rules + Conversion Stack Pattern sections) and write the converted component
6. Report: target path written, any `.graphql` docs / composables that still need to be created

**`page` mode** — convert a page and its full component tree:
1. Read the named legacy page in full
2. Scan `<script>` imports — collect every local `.vue` component imported by the page
3. Read each imported component; recursively collect their local imports as well
4. For the page + all components, identify every GQL query and mutation
5. Check target paths for files that already exist (skip already-converted files — do not overwrite)
6. Ask the user: "Convert the page + all N child components, or just the page itself?"
7. Convert in dependency order — leaf components first (no local imports), then files that depend on them, page last
8. For each GQL query/mutation not yet replaced (urql → urql, no server routes):
   - Add the `.graphql` document under `packages/graphql-client-api/src/graphql/<module>/{query,mutation}/`
   - Run codegen; wrap the generated hook in a composable at `src/composables/use<Domain>.ts`
   - Export it from `packages/graphql-client-api/src/index.ts`, then re-export from `apps/<app>/app/composables/use<Domain>.ts`
9. Verify the page will appear in nav: check that a matching module/tool row (with the page's
   route) exists in the DB claims — see the nav registration pattern (Conversion Stack Pattern
   section); flag missing module/tool rows as DB work rather than silently skipping
10. Report: files written, server routes created, nav entry added, anything still unresolved

In both modes: flag any remaining `useSupabaseUser`, `useQuery`, `useMutation`, `i-heroicons-`,
`UFormGroup`, or `UDropdown` references explicitly.
