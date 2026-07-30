# Plan: Workspace switcher — sidebar tenant button + residency tree modal, residencies in ProfileClaims

> **Execution Directive:** Implement this plan via `/fnb-stack-implementor <this-file>`.
> The authoritative spec is `.claude/specs/workspace-switcher/` (README + `_shared.data.md` +
> `switcher.data.md` + `switcher.ui.md`) — this plan sequences it and records verified code
> anchors; it does not restate the spec (R21). Specialist skills: `fnb-db-designer` (composite
> type / DEFINER function), `postgraphile-5-expert` (if the `myResidencyTreeList` exposure or
> field names surprise). Never run `git` in a sqitch session; never rebuild/restart the env
> yourself — ask the user (memory `feedback_rebuild_ask_user`), then verify read-only.

**Severity: MED** (feature work) · Workstream: app/tenant-layer · Planned: 2026-07-10
· Spec status: Draft, no `[FILL IN]`s; decisions locked, revised same day (residencies ride
`ProfileClaims`, not a separate switcher query).

## Context

The residency-switch mechanism is complete end-to-end (`assume_residency` DEFINER + login modal
+ workspace Enter + support mode) but has no persistent UI surface, and the client cannot see
tenant parentage (RLS hides non-active tenants; `my_profile_residencies` rows carry only a
denormalized `tenant_name`). This feature adds: a SECURITY DEFINER ancestor-walk function whose
rows ride the existing `CurrentProfileClaims` document into `ProfileClaims.residencies`
(localStorage), an `auth-ui` claims-derived tree composable + `switchResidency` action, and a
tenant-layer `WorkspaceSwitcher.vue` (current-tenant trigger → `UModal` + `UTree`) mounted in
`AppNav` and the `AppNavMobile` drawer.

**All DB work is in-place edits to existing deploy files** (memory `feedback_inplace_sql_edits`;
rebuild-only env). **No new package dependencies anywhere** (R24 untouched; `pnpm dep-audit`
confirm only).

## Verified code anchors (2026-07-10)

- Composite-type home: `db/fnb-app/deploy/00000000010230_app_fn_types.sql` (97 lines;
  `app_fn.profile_claims` at `:22`; append `app_fn.residency_tree_node` at end of file)
- Function home: `db/fnb-app/deploy/00000000010240_app_fn.sql:1135-1167` —
  `app_api.my_profile_residencies` (`:1136`, INVOKER, no guard, keys `jwt.email()`) +
  `app_fn.my_profile_residencies` (`:1150`, DEFINER) — insert the two `my_residency_tree`
  functions directly after, same shape
- Claims builders (NOT touched): `app_fn.profile_claims_for_user`
  (`00000000010260_app_bootstrap.sql:5`), `app_fn.current_profile_claims`; jwt payload builder
  `packages/db-access/src/jwt.ts` (`buildJwtPayload` picks explicit fields — residencies never
  ride `request.jwt.claims`)
- Claims document to extend: `packages/graphql-client-api/src/graphql/app/query/currentProfileClaims.graphql`;
  client mapping in `src/composables/useProfileClaims.ts` (`fetchProfileClaims` — already
  assembles from two top-level fields: `currentProfileClaims` + `availableModules`; add the
  third, `myResidencyTreeList`)
- `ProfileClaims` type: `packages/fnb-types/src/profile-claims.ts`; barrel `src/index.ts`
  (tenant exports at `:20`; `TenantStatus = 'ACTIVE'|'INACTIVE'|'PAUSED'` in `tenant.ts:4`;
  import style `from '@/tenant'`)
- db-access claim producers that must type-check with the new nullable field:
  `packages/db-access/src/mutations/{current-profile-claims,profile-claims-for-user,claims-for-session}.ts`
  (+ `src/utils/normalize-claims.ts`) — add explicit `residencies: null` where `ProfileClaims`
  literals are built; casts over `camelCaseKeys` output need no data change
- Switch machinery: `packages/graphql-client-api/src/composables/useResidency.ts`
  (`assumeResidency(client, residentId)` `:21`; export `ENTERABLE_STATUSES` here);
  `src/composables/useWorkspaces.ts:36` (private `ENTERABLE_STATUSES` — re-import the shared one)
- `useAuth`: `packages/auth-ui/src/use-auth.ts` — `exitSupport` precedent `:79-83`
  (mutation → `refreshClaims` → navigate); `getClient()` `:42-45`. **`goHome()` is a soft
  `navigateTo('/')`** (`homeUrl` `:36`, call `:76`, no `external`) — `switchResidency` must
  navigate explicitly with `navigateTo('/', { external: true })` (full-reload contract; see
  Phase 2.5, do not change `goHome` for its other callers). Barrel `src/index.ts`
- auth-layer re-export precedent: `packages/auth-layer/app/composables/useAuth.ts`; status
  badge utils `packages/auth-layer/app/utils/status.ts` (`statusColor`/`statusLabel`)
- Mount points: `packages/tenant-layer/app/components/AppNav.vue` (brand block `:26-33`,
  sections `:35-41`; imports useAuth via
  `@function-bucket/fnb-auth-layer/app/composables/useAuth` `:2`) and `AppNavMobile.vue`
  (drawer header rows `:76-93`); both dark (`bg-blue-900`)
- `UTree` confirmed in installed `@nuxt/ui` 4.6.1
  (`node_modules/.pnpm/@nuxt+ui@4.6.1*/…/components/Tree.vue`) — check its v4 item API
  (`items`, `disabled`, slots) against the dist types before writing the modal
- tenant-layer deps (`packages/tenant-layer/package.json`): auth-layer/fnb-types/@nuxt/ui
  present; **no graphql-client-api and none needed** (component reaches everything via
  auth-layer)

## Implementation phases

Follows the spec README task list. **`pnpm build` is the gate** (repo lint broken — memory
`project_eslint_broken`). SQL is verbatim in `_shared.data.md`; do not improvise.

### Phase 1 — DB (in-place edits; land on rebuild)
1. `00000000010230_app_fn_types.sql` — append `app_fn.residency_tree_node` (8 fields, spec
   §Composite Type).
2. `00000000010240_app_fn.sql` — after `:1167`: `app_fn.my_residency_tree(_email citext)`
   (DEFINER, STABLE; recursive CTE seeded from the caller's resident tenants, `union` walk up
   `parent_tenant_id`, left-join own resident rows back on) + `app_api.my_residency_tree()`
   (INVOKER, STABLE, no guard — `jwt.email()` null ⇒ empty, the `my_profile_residencies`
   contract). SQL verbatim in `_shared.data.md` §Functions.
3. Sanity: no RLS/policy/grant changes; grants are schema-wide already.

### ⏸ USER REBUILD GATE
Ask the user to rebuild (wipes/reseeds — memory `project_rebuild_wipes_db`). Then verify
**read-only**: GraphiQL shows `myResidencyTreeList` with all 8 fields (record exact inflected
names for the document); as multi-residency `bucket@`, a claims-simulated rolled-back
transaction returns own residencies + ghost ancestors (create a nested workspace via the
existing Workspaces tool to produce a grandchild case), anon returns empty set.

### Phase 2 — fnb-types + graphql-client-api + auth-ui
1. `fnb-types`: new `src/residency-tree.ts` (`ResidencyTreeNode`, spec §Types); `ProfileClaims`
   gains `residencies: ResidencyTreeNode[] | null`; barrel lines.
2. db-access: add `residencies: null` to every `ProfileClaims` literal/normalization site
   (grep `tenantName` under `src/`); build green.
3. `currentProfileClaims.graphql`: add the `myResidencyTreeList { … }` selection (every field —
   memory `feedback_fragments_all_fields`); codegen
   (`pnpm -F @function-bucket/fnb-graphql-client-api generate`).
4. `useProfileClaims.ts`: map the field into `residencies` (String-coerce ids, enum
   pass-through, spec `switcher.data.md` snippet). `useResidency.ts`: export
   `ENTERABLE_STATUSES`; `useWorkspaces.ts` imports it (drop the private const). Barrel check;
   package build green.
5. `auth-ui`: `src/use-residency-switcher.ts` (`useResidencySwitcher()` — computed `roots` tree
   from `user.value?.residencies`, `ResidencySwitchNode` view type, `isCurrent`/`canEnter`,
   sibling sort) + `switchResidency(residentId)` on `useAuth` (assumeResidency →
   `refreshClaims` → **full-reload home**). **Contract note:** the spec's post-switch behavior
   is the workspace-Enter full reload; `goHome()` currently calls `navigateTo('/')`
   *without* `{ external: true }` — inside `switchResidency` use
   `navigateTo('/', { external: true })` explicitly (do not silently change `goHome` for its
   other callers). Barrel exports; build green.

### Phase 3 — layer UI (no new deps)
1. `packages/auth-layer/app/composables/useResidencySwitcher.ts` — one-line re-export
   (`useAuth.ts` precedent).
2. `packages/tenant-layer/app/components/WorkspaceSwitcher.vue` per `switcher.ui.md`:
   trigger (current `tenantName`, `i-lucide-building-2` + `i-lucide-chevrons-up-down`, sidebar
   dark styling; static row in support mode `p:exit-support`; hidden when logged out) +
   `UModal` `title="Switch workspace"` + `UTree` (default-expanded; Current badge; ghost nodes
   muted + `i-lucide-lock`; non-enterable nodes disabled with `statusColor`/`statusLabel`
   badges; `i-lucide-network` icon for `WORKSPACE` nodes). `refreshClaims()` on open
   (background; tree renders from claims immediately); switch → `switching` flag →
   `switchResidency`; errors toast (UC7). Icons verified lucide names (UC11).
3. Mount: `AppNav.vue` between Brand and Sections; `AppNavMobile.vue` under the drawer header
   row. Bottom tab bar untouched.
4. Ask the user to `docker compose restart` the tenant-layer apps (layer edits don't
   hot-reload — memory `project_layer_changes_need_restart`; packages-watch rebuilds auth-ui /
   graphql-client-api / fnb-types on its own). Root `pnpm build` green.

### Phase 4 — end-to-end verification (read-only; user runs any restart)
As `bucket@` (multi-residency): sidebar shows the anchor tenant button → modal lists the
residency tree instantly → create/enter a workspace via the Workspaces tool → switcher now
shows the workspace as Current with the parent above it → switch back via the switcher (full
reload to `/`, nav re-derived) → grandchild case renders the ghost/hierarchy correctly. Support
mode: trigger static, no modal. Logged out: no trigger. Mobile drawer: same behavior. Login
modal + workspace Enter still work (shared `ENTERABLE_STATUSES`, untouched flows).

### Phase 5 — spec reconcile
Fold in-flight corrections into `.claude/specs/workspace-switcher/` (README §Implementation
corrections if code diverged); flip Status lines to `Implemented — GraphQL (claims delivery)`;
retro-check the README task list; add `WorkspaceSwitcher.vue` / `useResidencySwitcher` rows to
`package-layers-pattern.md`'s tenant-layer / auth-ui file inventories (R21 hygiene). Ask the
user before moving this plan to `addressed/` (memory `feedback_ask_before_moving_addressed`).

## Sequencing summary

1. Phase 1 (SQL file edits only) → **user rebuild** → GraphiQL verify + record field names →
   Phase 2 (codegen needs the live schema; fnb-types → db-access → graphql-client-api → auth-ui
   build order) → Phase 3 (user restarts tenant-layer apps) → Phase 4 → Phase 5.
2. Two user touchpoints mid-flight: the rebuild after Phase 1, the layer-app restart in Phase 3
   — plus sign-off at Phase 5.

## Out of scope / linked (recorded in the spec README)

- Login page switching to claims-based residencies (`fetchMyResidencies` becomes redundant) —
  optional follow-up.
- Tree search/filter for very wide residency sets.
- Hardening `INVITED`-status entry (inherited `ENTERABLE_STATUSES` behavior, not widened here).
