# admin/workspace — Nested Workspace Tenants

> **Execution Directive:** plan + build this spec via
> `/fnb-stack-implementor .claude/specs/tenant-app/admin/workspace/README.md` —
> the implementor derives the `.claude/issues/` plan file (R23) from the task list below,
> then executes it.

## Status
Implemented — GraphQL (2026-07-10). Built via
`.claude/issues/` plan `0010__app_______workspace-tenants_______________MED__.plan.md`.
See **Implementation corrections** below for the deltas discovered in flight.

## Purpose

Let a `p:app-admin` user create **workspace tenants** that become children of their current
tenant (`app.tenant.parent_tenant_id`, which exists today but is set nowhere and read nowhere).
The creator receives an `app-admin` license in the new workspace via a guest residency and
enters it through the existing residency-switch mechanism (`assume_residency` → claims refresh).
Workspaces nest to arbitrary depth: a workspace admin sees the same Workspaces tool and can
create grandchildren.

Seed data already in place (`db/fnb-app/deploy/00000000010240_app_fn.sql`):
- `workspace` license pack (`app-user` + `app-admin`, `auto_subscribe = false`)
- `'workspace'` member of `app.tenant_type`
- tool `tenant-admin-workspaces` → `/tenant/admin/workspace`, `p:app-admin`, `i-lucide-network`

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| Packs a workspace subscribes to | `workspace` pack **only**, explicitly | Leanest; the pack is the workspace's identity. `auto_subscribe` flipped to `false` (already done) so customer tenants stop auto-getting it and workspaces skip `base`/address-book. |
| Creator entry flow | Stay in parent on create; residency in child is created `inactive` (invitation ceremony skipped); enter on demand via `assume_residency` + `refreshClaims` | Claims bind to one active residency (`idx_uq_resident`); auto-switching on create would silently yank the admin out of their tenant. |
| Creator's license in child | `app-admin` via `app_fn.invite_user(child, email, 'admin')` | Requirement; reuses existing license-granting machinery. |
| Workspace name uniqueness | Scoped under parent: unique among siblings; global uniqueness kept only for root tenants (`parent_tenant_id is null`) | Two orgs must both be able to have an "Engineering" workspace; partial unique indexes replace the global `unique` on `app.tenant.name`. |
| Nesting depth | Arbitrary — any tenant whose active admin you are can spawn a child | Matches the pack description ("nested workspaces"); `parent_tenant_id` forms a tree. |
| Lifecycle | Parent admins deactivate/reactivate **direct** children via new `app_api.deactivate_workspace` / `app_api.activate_workspace` | Existing `deactivate_tenant`/`activate_tenant` are `p:app-admin-super` only; parent-scoped variants delegate to the same `app_fn` bodies. |
| Visibility | New **SELECT-only** RLS policies expose direct-child workspace rows (tenant, resident, tenant_subscription, license) to parent admins | Makes plain PostGraphile queries work for list + detail; one level per hop — you enter a child to see grandchildren's residents. |
| Page scope | List page + detail page (`/tenant/admin/workspace`, `/tenant/admin/workspace/[id]`) | User choice. |
| DB delivery | In-place edits to existing sqitch deploy files | Rebuild-only env; house rule (no new migrations/reworks). |

## Files in this spec

| File | Covers |
|---|---|
| `README.md` | This index |
| `_shared.data.md` | DB schema changes, functions, RLS policies, types, fragments, permission model |
| `index.ui.md` / `index.data.md` | Workspace list page + create modal |
| `[id].ui.md` / `[id].data.md` | Workspace detail page (summary, residents, subscription, lifecycle actions) |

## Implementation Task List

### Phase 1 — DB (in-place edits, then env rebuild by the user)
- [x] `00000000010220_app.sql`: `parent_tenant_id` FK → `app.tenant(id)` + index; replace global
      `unique` on `name` with partial unique indexes (root vs sibling); `chk_workspace_parent`
      check constraint
- [x] `00000000010240_app_fn.sql`: scope `app_fn.create_tenant`'s duplicate-name check to root
      tenants; add `app_fn.create_workspace` (DEFINER) + `app_api.create_workspace`
- [x] `00000000010243_app_fn_support.sql`: add `app_fn.deactivate_workspace` /
      `app_fn.activate_workspace` (DEFINER) + `app_api` wrappers
- [x] `00000000010250_app_policies.sql`: four `view_child_workspace_*` SELECT policies
- [x] User rebuilt; verified via rolled-back claims-simulated transaction (create → child list →
      RLS visibility → workspace-pack-only subscription → inactive guest resident with
      app-admin license → 30002 on sibling dup → deactivate blocks residents → reactivate)

### Phase 2 — types + GraphQL client
- [x] `fnb-types`: `'WORKSPACE'` in `TenantType`; `parentTenantId: string | null` on `Tenant`;
      `toTenant` mapper passes it through
- [x] `app/fragment/Tenant.graphql` expanded with `parentTenantId`
- [x] New operations: `childWorkspaces.graphql`, `workspaceById.graphql`,
      `createWorkspace.graphql`, `deactivateWorkspace.graphql`, `activateWorkspace.graphql`
- [x] Codegen run; `useWorkspaces.ts` composable (list, create, enter) + `useWorkspaceDetail`;
      barrel export added

### Phase 3 — tenant-app UI
- [x] Re-export `apps/tenant-app/app/composables/useWorkspaces.ts`
- [x] `pages/admin/workspace/index.vue` + `WorkspaceList.vue` + `WorkspaceCreateModal.vue`
- [x] `pages/admin/workspace/[id].vue` (detail inline — see corrections)
- [x] `pnpm build` gate green (12/12)

### Phase 4 — spec upkeep
- [x] README status → Implemented; boxes retro-checked;
      `tenant-app/admin/_shared.data.md` navigation table updated

## Implementation corrections (2026-07-10 — the code is the source of truth)

1. **No `WorkspaceDetail.vue`** — the detail layout lives inline in
   `pages/admin/workspace/[id].vue`, matching the `site-admin/tenant/[id].vue` house precedent.
2. **Create modal is self-contained** (`WorkspaceCreateModal.vue` owns its `open` state and
   renders its own trigger button, emitting `create(name, identifier?)`), matching the
   `MsgNewConversationModal.vue` precedent — not the props/emits shape the ui spec drafted.
3. **Enter navigates `navigateTo('/', { external: true })`** (full reload into home-app, the
   same contract as support-mode entry), not `/tenant`.
4. **Smart tags added** in `apps/graphql-api-app/postgraphile.tags.json5` naming the
   self-referential FK relations `parentTenant` / `childTenants(List)` explicitly.
5. **Pre-existing bug found & fixed**: `app_fn.deactivate_tenant` / `activate_tenant` returned
   NULL (missing `returning * into _tenant`) — fixed in
   `00000000010243_app_fn_support.sql` and hot-patched into the live DB (user-approved).
6. **Pre-existing schema-build warnings diagnosed** — the recoverable "naming conflict …
   'tenant'/'resident'" log lines come from `res.resource` relation names (urn registry), not
   this feature; tracked as issue `0345__graphql___resource-relation-name-clash____LOW__`.
7. **`@urql/vue` exposes `useClientHandle()`**, not `useClient()` — composables needing the raw
   client for imperative ops use `const { client } = useClientHandle()`.
8. Status color/label rendering uses the shared auth-layer `statusColor('tenant' | 'resident' |
   'subscription', …)` / `statusLabel` utils — no per-page color maps (UC1).

## Remaining Open Questions
- **Joining an existing workspace**: parent admins who did not create a workspace see it listed
  but hold no residency there, so Enter is unavailable to them. A `join_workspace` /
  invite-into-workspace flow is deferred (invites inside the workspace work once you're in it,
  via the normal admin/user pages).
- **Cascade on deactivate**: deactivating a workspace does **not** cascade to its child
  workspaces (they stay active but become unlistable from a deactivated parent's context).
  Documented as a known gap; revisit if deep trees get real use.

## Considered & rejected

- **Auto-switch into the workspace on create** — surprising context loss for the admin; the
  switcher already exists.
- **`base` + `workspace` packs for children** — address-book in every ephemeral workspace is
  noise; add later by subscribing explicitly if needed.
- **Global tenant-name uniqueness with a friendly error** — cross-tenant name collisions on
  common workspace names ("Engineering") would be constant.
- **PostGraphile `tenants(condition: …)` connection for the list** — an `app_api.child_workspaces()`
  set-returning function is the established house style (`my_profile_residencies`,
  `tenant_profile_residencies`) and doesn't depend on condition-arg availability.
- **SECURITY DEFINER detail-fetch function instead of RLS policies** — SELECT-only child
  policies keep plain GraphQL queries working (fragments, counts) and match the "RLS does the
  real restriction" pattern.
