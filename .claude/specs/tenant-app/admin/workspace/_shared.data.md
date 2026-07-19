# admin/workspace — Shared Data, Schema & Permissions

Referenced by `index.data.md` and `[id].data.md`. Do not duplicate here.

## Status
Implemented — GraphQL (2026-07-10). Divergences from the draft are recorded in README.md → Implementation corrections.

## Navigation

Already registered in DB (`db/fnb-app/deploy/00000000010240_app_fn.sql`, admin module):
```
'tenant-admin-workspaces' → /tenant/admin/workspace   i-lucide-network   p:app-admin   ordinal 0
```
Because workspace residents' admins also hold `p:app-admin` (workspace pack → `app-admin`
license type), the tool appears inside workspaces too — this is what enables arbitrary nesting.

## Permission Model

| Action | Required | Enforced by |
|---|---|---|
| See Workspaces pages | `p:app-admin` | nav/tool permission + RLS |
| List direct-child workspaces | `p:app-admin` in the parent | RLS `view_child_workspaces` + `app_api.child_workspaces()` |
| View child workspace detail (residents, subscription, licenses) | `p:app-admin` in the parent | new `view_child_workspace_*` SELECT policies |
| Create a workspace | `p:app-admin` | `app_api.create_workspace` guard |
| Deactivate / reactivate a **direct child** workspace | `p:app-admin` in the parent | `app_api.deactivate_workspace` / `app_api.activate_workspace` guards |
| Enter a workspace | a residency of your own in it (any non-blocked status) | existing `app_api.assume_residency` (email match) |

Cross-tenant note: `jwt.has_permission(p, tenant_id)` is true only for the **active residency's**
tenant. All parent-side reach into children therefore goes through the new SELECT policies
(keyed on `parent_tenant_id = jwt.tenant_id()`) and SECURITY DEFINER `app_fn` bodies — never
through 2-arg `has_permission` against the child id.

## DB Schema Changes — `db/fnb-app/deploy/00000000010220_app.sql` (in-place)

### `app.tenant`
```sql
-- column changes
,name citext not null                          -- was: not null unique
,parent_tenant_id uuid null references app.tenant(id)   -- FK added (column exists today, no FK)

-- new check: exactly the workspace type carries a parent
,constraint chk_workspace_parent check ((type = 'workspace') = (parent_tenant_id is not null))
```

Constraints/indexes section:
```sql
create index idx_tenant_parent on app.tenant(parent_tenant_id);
-- name uniqueness: global for root tenants, per-parent for workspaces
create unique index idx_uq_tenant_name_root on app.tenant(name) where parent_tenant_id is null;
create unique index idx_uq_tenant_name_sibling on app.tenant(parent_tenant_id, name)
  where parent_tenant_id is not null;
```
`identifier` keeps its existing global `unique` (it is optional; workspaces normally pass null).

## Functions — `db/fnb-app/deploy/00000000010240_app_fn.sql` (in-place)

### `app_fn.create_tenant` — one-line adjustment
The duplicate-name pre-check must scope to root tenants now that `name` is not globally unique:
```sql
select * into _tenant from app.tenant
where (name = _name and parent_tenant_id is null)
   or (_identifier is not null and identifier = _identifier);
```

### `app_fn.create_workspace(_parent_tenant_id uuid, _name citext, _creator_email citext, _identifier citext default null) returns app.tenant`
`SECURITY DEFINER` (parent admins hold no INSERT right on `app.tenant`; matches the
`invite_user` / `subscribe_tenant_to_license_pack` precedent). Body:

1. Guard: `_parent_tenant_id` must exist and have `status = 'active'`
   (`31001: PARENT TENANT NOT ACTIVE` on failure).
2. Duplicate check among siblings: `where parent_tenant_id = _parent_tenant_id and name = _name`
   → raise `30002: APP TENANT WITH THIS NAME OR IDENTIFIER ALREADY EXISTS` (reuse code).
3. `insert into app.tenant(name, identifier, type, parent_tenant_id)
   values (_name, _identifier, 'workspace', _parent_tenant_id)`.
4. `perform res_fn.register_resource(_tenant.id, _tenant.id, 'app', 'tenant');`
5. `perform app_fn.subscribe_tenant_to_license_pack(_tenant.id, 'workspace');` — **only** the
   workspace pack; no auto_subscribe loop.
6. Creator residency + license: `perform app_fn.invite_user(_tenant.id, _creator_email, 'admin');`
   — creates a `guest` resident (creator's email already exists elsewhere) with the `app-admin`
   license, then skip the invitation ceremony:
   ```sql
   update app.resident set status = 'inactive', updated_at = current_timestamp
   where tenant_id = _tenant.id and email = _creator_email and status = 'invited';
   ```
7. Return the tenant.

### `app_api.create_workspace(_name citext, _identifier citext default null) returns app.tenant`
`SECURITY INVOKER`, standard guard + delegate:
```sql
perform jwt.enforce_permission('p:app-admin');
_tenant := app_fn.create_workspace(jwt.tenant_id(), _name, jwt.email(), _identifier);
```

### `app_api.child_workspaces() returns setof app.tenant`
`SECURITY INVOKER`, `STABLE`. Guard `p:app-admin`, then
`select * from app.tenant where parent_tenant_id = jwt.tenant_id() order by name` (rows arrive
via the `view_child_workspaces` policy). Exposed by PostGraphile as `childWorkspacesList`.

## Functions — `db/fnb-app/deploy/00000000010243_app_fn_support.sql` (in-place)

### `app_fn.deactivate_workspace(_tenant_id uuid, _parent_tenant_id uuid) returns app.tenant`
`SECURITY DEFINER` (the invoker-run `app_fn.deactivate_tenant` updates child rows the parent
admin cannot write under RLS). Verifies parentage then delegates:
```sql
select * into _tenant from app.tenant
  where id = _tenant_id and parent_tenant_id = _parent_tenant_id and type = 'workspace';
if _tenant.id is null then raise exception '30000: NOT AUTHORIZED'; end if;
return app_fn.deactivate_tenant(_tenant_id);
```
`app_fn.activate_workspace(_tenant_id uuid, _parent_tenant_id uuid)` — identical shape over
`app_fn.activate_tenant`.

Note: deactivation does **not** cascade to grandchildren (known gap, see README).

### `app_api.deactivate_workspace(_tenant_id uuid)` / `app_api.activate_workspace(_tenant_id uuid)`
`SECURITY INVOKER`; guard `p:app-admin`; delegate with `jwt.tenant_id()` as the parent.

## RLS Policies — `db/fnb-app/deploy/00000000010250_app_policies.sql` (in-place)

All four are **SELECT-only** and keyed on direct children of the active tenant:

```sql
------ tenant: parent admins see direct-child workspaces
CREATE POLICY view_child_workspaces ON app.tenant
  FOR SELECT
  USING (jwt.has_permission('p:app-admin') and parent_tenant_id = jwt.tenant_id());

------ resident / tenant_subscription / license: rows of direct-child workspaces
CREATE POLICY view_child_workspace_residents ON app.resident
  FOR SELECT
  USING (jwt.has_permission('p:app-admin') and tenant_id in
    (select id from app.tenant t where t.parent_tenant_id = jwt.tenant_id()));

CREATE POLICY view_child_workspace_subscriptions ON app.tenant_subscription
  FOR SELECT
  USING (jwt.has_permission('p:app-admin') and tenant_id in
    (select id from app.tenant t where t.parent_tenant_id = jwt.tenant_id()));

CREATE POLICY view_child_workspace_licenses ON app.license
  FOR SELECT
  USING (jwt.has_permission('p:app-admin') and tenant_id in
    (select id from app.tenant t where t.parent_tenant_id = jwt.tenant_id()));
```
(The subselect against `app.tenant` resolves under the caller's own tenant policies; no
recursion — no tenant policy references `app.tenant` itself.)

## Types

### `packages/fnb-types/src/tenant.ts`
```ts
export type TenantType = 'ANCHOR' | 'CUSTOMER' | 'DEMO' | 'TEST' | 'TRIAL' | 'WORKSPACE'
// enum values copied verbatim from the GraphQL enum (UPPERCASE)

export interface Tenant {
  // …existing fields…
  parentTenantId: string | null
}
```
`graphql-client-api` mapper `src/mappers/tenant.ts` (`toTenant`) passes `parentTenantId` through.

### Fragment: `packages/graphql-client-api/src/graphql/app/fragment/Tenant.graphql`
Add `parentTenantId` (fragments select every field — house rule). Ripples to every consumer of
the fragment via codegen; no other fragment changes.

## GraphQL Operations (new)

Files under `packages/graphql-client-api/src/graphql/app/`:

| Operation | File | Generated hook | Variables |
|---|---|---|---|
| `ChildWorkspaces` (query) | `query/childWorkspaces.graphql` — `childWorkspacesList { ...Tenant }` | `useChildWorkspacesQuery()` | none |
| `WorkspaceById` (query) | `query/workspaceById.graphql` — `tenant(id:) { ...Tenant, residents { … }, tenantSubscriptions { ...TenantSubscription } }` | `useWorkspaceByIdQuery()` | `{ tenantId: UUID! }` |
| `CreateWorkspace` (mutation) | `mutation/createWorkspace.graphql` | `useCreateWorkspaceMutation()` | `{ name: String!, identifier: String }` |
| `DeactivateWorkspace` (mutation) | `mutation/deactivateWorkspace.graphql` | `useDeactivateWorkspaceMutation()` | `{ tenantId: UUID! }` |
| `ActivateWorkspace` (mutation) | `mutation/activateWorkspace.graphql` | `useActivateWorkspaceMutation()` | `{ tenantId: UUID! }` |

Existing operations reused: `MyProfileResidencies` (which child tenants the current user can
enter), `AssumeResident` (enter).

## Composables

**Source:** `packages/graphql-client-api/src/composables/useWorkspaces.ts`
**Re-export:** `apps/tenant-app/app/composables/useWorkspaces.ts` (single line)
**Package index:** add exports in `packages/graphql-client-api/src/index.ts`

### `useWorkspaces()`
| Return | Shape | Notes |
|---|---|---|
| `workspaces` | `computed<WorkspaceView[]>` | `Tenant` + `myResidentId: string \| null` (joined from `fetchMyProfileResidencies` by `tenantId`) + `canEnter: boolean` |
| `fetching` / `error` / `executeQuery` | urql standard | re-query with `{ requestPolicy: 'network-only' }` after mutations |
| `createWorkspace(name, identifier?)` | `Promise<Tenant>` | throws on `res.error`; re-runs list + residencies |
| `enterWorkspace(residentId)` | `Promise<void>` | `assumeResidency(client, residentId)` then caller runs `useAuth().refreshClaims()` + `navigateTo('/tenant')` (same contract as the existing residency switcher) |

`WorkspaceView` (R4 — lives in the composable file):
```ts
export type WorkspaceView = Tenant & {
  myResidentId: string | null
  myResidentStatus: ResidentStatus | null
  canEnter: boolean // residency exists and status not blocked/declined, workspace active
}
```

### `useWorkspaceDetail(tenantId)`
| Return | Shape |
|---|---|
| `workspace` | `Ref<Tenant \| null>` |
| `residents` | `computed<Resident[]>` (from `fnb-types`) |
| `subscriptions` | `computed<TenantSubscription[]>` |
| `fetching` / `error` / `executeQuery` | urql standard |
| `deactivateWorkspace(id)` / `activateWorkspace(id)` | mutation wrappers, re-query on success |

## Enter-Workspace Flow (existing machinery, documented here)

1. `enterWorkspace(myResidentId)` → `AssumeResident` mutation (`app_api.assume_residency`,
   SECURITY DEFINER, email-matched) — deactivates the current residency, activates the target.
2. `useAuth().refreshClaims()` — claims/permissions now belong to the workspace.
3. `navigateTo('/tenant')` — nav re-derives from `available_modules` under the new claims.
4. Switching back happens through the existing residency switcher (parent residency is now
   `inactive` and remains in `myProfileResidencies`).

## Open Questions
- [ ] None blocking. Deferred items (join-workspace for non-creator admins, deactivation
      cascade) tracked in README → Remaining Open Questions.
