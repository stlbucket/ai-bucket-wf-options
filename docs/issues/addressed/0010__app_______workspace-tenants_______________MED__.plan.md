# Plan: Workspace tenants — nested child tenants, creator app-admin residency, admin list/detail UI

> **Execution Directive:** Implement this plan via `/fnb-stack-implementor <this-file>`.
> The authoritative spec is `.claude/specs/tenant-app/admin/workspace/` (README +
> `_shared.data.md` + `index.*` + `[id].*`) — this plan sequences it and records verified code
> anchors; it does not restate the spec (R21). Specialist skills: `fnb-db-designer` (schema/RLS),
> `postgraphile-5-expert` (if field-name/exposure questions arise). Never run `git` in a sqitch
> session; never rebuild/restart the env yourself — ask the user (memory
> `feedback_rebuild_ask_user`), then verify read-only.

**Severity: MED** (feature work) · Workstream: app/admin · Planned: 2026-07-10
· Spec status: Draft, no `[FILL IN]`s; all decisions locked in the spec README.

## Context

`app.tenant.parent_tenant_id` exists (`db/fnb-app/deploy/00000000010220_app.sql:150`) but has no
FK and is set/read nowhere. This feature makes it real: a `p:app-admin` user creates `workspace`
tenants as children of their active tenant, holding an `app-admin` license there via an
`inactive` guest residency, entering through the existing `assume_residency` switch. Seed data
already landed (workspace license pack `auto_subscribe=false`, `'workspace'` tenant type, tool
`tenant-admin-workspaces` → `/tenant/admin/workspace` — all in `00000000010240_app_fn.sql`).

**All DB work is in-place edits to existing deploy files** (memory `feedback_inplace_sql_edits`;
rebuild-only env) — no new sqitch changes, no new packages, no new npm deps (R24 untouched).

## Verified code anchors (2026-07-10)

- `app.tenant` DDL + constraints section: `00000000010220_app.sql:142-151, 254-303`
- `app_fn.create_tenant` dup-check to scope: `00000000010240_app_fn.sql:679`; insert path `:685`
- `app_fn.subscribe_tenant_to_license_pack` (DEFINER): `:721` — reuse as-is
- `app_fn.invite_user(tenant, email, scope)` (DEFINER, `00000000010242_app_fn_definers.sql:269`)
  — creates a `guest` resident (email exists elsewhere → guest branch `:310`), grants
  admin-scope licenses from the tenant's subscriptions, links `profile_id`; leaves status
  `'invited'` (create_workspace flips it to `'inactive'`)
- `app_fn.assume_residency` (DEFINER, email-matched, `00000000010242:77`) — works from any
  non-deleted status; `app_api.my_profile_residencies` returns **all** residencies by email
  (`00000000010240:1053`) so the Enter action needs no new query
- Lifecycle bodies to delegate to: `app_fn.deactivate_tenant` / `activate_tenant`
  (`00000000010243_app_fn_support.sql:169, 209`) — INVOKER, hence the DEFINER `_workspace`
  wrappers per spec
- RLS file sections: tenant `00000000010250_app_policies.sql:63`, resident `:41`,
  tenant_subscription `:74`, license `:82`
- `jwt.has_permission(p, tenant_id)` binds to the **active** tenant only
  (`db/fnb-auth/deploy/00000000010150_jwt.sql:201`) — this is why child visibility is
  policy-driven, never 2-arg checks against the child id
- Client: `toTenant` mapper `packages/graphql-client-api/src/mappers/tenant.ts`; fragment
  `src/graphql/app/fragment/Tenant.graphql`; residency ops `src/composables/useResidency.ts`
  (`assumeResidency`, `fetchMyProfileResidencies`); relation-name precedent
  `src/graphql/app/query/appTenantById.graphql` (`tenantSubscriptionsList`, `residents`
  connection) — confirm exact inflected names for `residentsList`/`licensesList` in
  `src/generated/fnb-graphql-api.ts` after the rebuild
- fnb-types: `packages/fnb-types/src/tenant.ts` (`TenantType` lacks `'WORKSPACE'`, `Tenant`
  lacks `parentTenantId`); `Resident`/`ResidentStatus` already exported from the barrel
- UI precedents: `apps/tenant-app/app/components/TenantList.vue` (flat components dir),
  pages under `apps/tenant-app/app/pages/admin/`

## Implementation phases

Follows the spec README task list. **`pnpm build` is the gate** (repo lint broken — memory
`project_eslint_broken`). SQL/RLS details are verbatim in `_shared.data.md`; do not improvise.

### Phase 1 — DB (in-place edits; land on rebuild)
1. `00000000010220_app.sql` — FK + `idx_tenant_parent` on `parent_tenant_id`; drop the inline
   `unique` on `name`, add `idx_uq_tenant_name_root` / `idx_uq_tenant_name_sibling` partial
   indexes in the constraints section; `chk_workspace_parent` check
   (`(type = 'workspace') = (parent_tenant_id is not null)`).
2. `00000000010240_app_fn.sql` — scope `create_tenant`'s name dup-check to
   `parent_tenant_id is null`; add `app_fn.create_workspace` (DEFINER) +
   `app_api.create_workspace` + `app_api.child_workspaces()` after the create_tenant block.
3. `00000000010243_app_fn_support.sql` — `app_fn.deactivate_workspace` /
   `app_fn.activate_workspace` (DEFINER, parentage-verified) + `app_api` wrappers, after the
   activate_tenant block.
4. `00000000010250_app_policies.sql` — the four `view_child_workspace_*` SELECT policies.
5. Sanity: `chk_workspace_parent` must not break existing seeds (`create_anchor_tenant`,
   `create_tenant` insert no parent + non-workspace types — passes).

### ⏸ USER REBUILD GATE
Ask the user to rebuild (wipes/reseeds DB — memory `project_rebuild_wipes_db`). Then verify
**read-only** as super-admin `bucket@` (holds `p:app-admin` too): GraphiQL shows
`createWorkspace`, `childWorkspacesList`, `deactivateWorkspace`, `activateWorkspace`,
`TenantType.WORKSPACE`; run `createWorkspace(name: "ws-verify")` → child row with
`parentTenantId`, `workspace`-pack subscription only, creator residency `INACTIVE` with
`app-admin` license; `myProfileResidenciesList` includes it; sibling-duplicate name raises
`30002`; record exact inflected relation names for Phase 2 documents.

### Phase 2 — fnb-types + graphql-client-api
1. `fnb-types/src/tenant.ts`: `TenantType` + `'WORKSPACE'`; `Tenant.parentTenantId:
   string | null`. Mapper `toTenant` passes it through (`f.parentTenantId ?? null`).
2. Fragment `Tenant.graphql`: add `parentTenantId` (fragments select all fields — memory
   `feedback_fragments_all_fields`). Codegen ripples to all consumers; re-run `pnpm -F
   @function-bucket/fnb-graphql-client-api generate`.
3. New documents per `_shared.data.md` §GraphQL Operations: `query/childWorkspaces.graphql`,
   `query/workspaceById.graphql`, `mutation/createWorkspace.graphql`,
   `mutation/deactivateWorkspace.graphql`, `mutation/activateWorkspace.graphql` (field names as
   recorded at the rebuild gate). Codegen again.
4. `src/composables/useWorkspaces.ts`: `useWorkspaces()` (list + residency join via
   `fetchMyProfileResidencies` + `createWorkspace` + `enterWorkspace`) and
   `useWorkspaceDetail(tenantId)` (+ lifecycle mutations); `WorkspaceView` type lives here (R4);
   shapes per `_shared.data.md` §Composables.
5. **Barrel** `src/index.ts` export line (the #1 miss) + `pnpm -F
   @function-bucket/fnb-graphql-client-api build` green.

### Phase 3 — tenant-app UI
1. Thin re-export `apps/tenant-app/app/composables/useWorkspaces.ts`.
2. `pages/admin/workspace/index.vue` + components `WorkspaceList.vue`,
   `WorkspaceCreateModal.vue` (flat components dir, `TenantList.vue` precedent) — per
   `index.ui.md`. Nuxt UI **v4** only (UC13 `TableColumn` + `row.original`), UC4/5/6/7/8/12;
   `UEmpty` for the zero-workspace state; width `max-w-5xl mx-auto`.
3. `pages/admin/workspace/[id].vue` + `WorkspaceDetail.vue` — per `[id].ui.md`; `max-w-3xl`.
4. Icons (UC11, verify each): `i-lucide-network` (already seeded), `i-lucide-plus`,
   `i-lucide-log-in`.
5. Enter flow wiring: `enterWorkspace(residentId)` → `useAuth().refreshClaims()` →
   `navigateTo('/tenant')` (contract in `_shared.data.md` §Enter-Workspace Flow).
6. Root `pnpm build` green. Nav needs no work — the tool row is already seeded (R14).

### Phase 4 — end-to-end verification (read-only; user runs any restart)
As `bucket@`: Workspaces tool visible under Administration → create workspace → appears in list
(member badge) → Enter → claims/nav switch to the workspace → Workspaces tool visible *inside*
it (nesting) → create a grandchild → switch back via residency switcher. Detail page: residents
table (creator `inactive`, `app-admin` license), subscription = `workspace` pack; Deactivate →
confirm → status inactive + residents `blocked_tenant`; Reactivate restores. Negative checks: a
plain `p:app-user` sees no Workspaces tool and `childWorkspacesList` returns `[]`; a non-child
tenant id on the detail page renders not-found.

### Phase 5 — spec reconcile
Fold any in-flight corrections into the spec files; flip Status lines to `Implemented —
GraphQL`; retro-check the README task list; add the workspaces row to
`tenant-app/admin/_shared.data.md` §Navigation. Ask the user before moving this plan to
`addressed/` (memory `feedback_ask_before_moving_addressed`).

## Sequencing summary

1. Phase 1 (file edits only) → **user rebuild** → GraphiQL verify + record field names →
   Phase 2 (codegen needs the live schema) → Phase 3 (packages-watch rebuilds the client
   package; layer-level restarts are the user's) → Phase 4 → Phase 5.
2. Two user touchpoints: the rebuild, and sign-off at Phase 5.

## Out of scope / linked (recorded in the spec README)

- Join-workspace flow for parent admins without a residency (Enter is member-only for now).
- Deactivation cascade to grandchild workspaces (non-cascading MVP; known gap).
- Anything wf/licensing-count enforcement related (`number_of_licenses` is advisory platform-wide).

## Post-implementation addendum (2026-07-10 — executed; spec is the source of truth)

All five phases executed same day; `pnpm build` green (12/12). DB verified via a rolled-back
claims-simulated transaction (create → visibility → workspace-pack-only subscription →
inactive guest app-admin residency → 30002 dup → deactivate/reactivate); anon GraphQL calls
rejected. Corrections are folded into the spec README (§Implementation corrections): detail
page inline (no `WorkspaceDetail.vue`), self-contained create modal, Enter navigates
`'/'` external (support-mode precedent), `useClientHandle()` not `useClient()`, smart tags
naming the self-FK relations (`parentTenant`/`childTenants`). Beyond the plan: fixed the
pre-existing `app_fn.deactivate_tenant`/`activate_tenant` NULL-return bug (missing
`returning * into` — file + user-approved live hot-patch), and diagnosed the recoverable
"naming conflict 'tenant'/'resident'" schema-build warnings as pre-existing `res.resource`
relation collisions → filed `0345__graphql___resource-relation-name-clash____LOW__.plan.md`.
Remaining: user's in-browser walkthrough (create/enter/nest/switch-back as bucket@).
