# admin/user — Shared Data, Schema & Permissions (Manage Residents)

## Status
Draft — build-ready (no `[FILL IN]`). Covers **only** the new Manage-Residents feature. Existing
Resident/License/query shapes live in `../_shared.data.md` (the admin-module shared file) — do
not duplicate them here.

> **Extended by `../nestable-tenant-types/`** (2026-07-23): the button gate broadens from
> `tenantType === 'WORKSPACE'` to `∈ {WORKSPACE, CLIENT, ORGANIZATION}`, and the pool scope
> narrows from whole-tree to the **spine** (ancestors + self + own subtree, via
> `app_fn.tenant_spine_ids`). That spec is authoritative for both deltas.

## Permission Model

| Action | Required | Enforced by |
|---|---|---|
| See the **Manage Residents** button | `p:app-admin` **and** current tenant is a `workspace` | client gate on claims (`permissions` + `tenantType`); button is a hint (R13) |
| Read the tree-wide resident pool | `p:app-admin` | `app_api.workspace_resident_pool` guard + `SECURITY DEFINER` body |
| Add / remove a workspace member | `p:app-admin` | `app_api.set_workspace_membership` guard + `SECURITY DEFINER` body |
| (cannot) remove **yourself** | — | `app_fn.set_workspace_membership` raises `31010` |

`jwt.has_permission('p:app-admin')` is true only for the **active residency's** tenant, i.e. the
workspace the admin is currently in. All reach into ancestor/sibling/descendant tenants is
therefore inside `SECURITY DEFINER` `app_fn` bodies (keyed on the tree computed from
`jwt.tenant_id()`), never through 2-arg `has_permission` against another tenant id — same rule
as `../workspace/_shared.data.md`.

---

## DB Schema Changes — `db/fnb-app/deploy/00000000010220_app.sql` (in-place)

### `app.resident_status` — add one value
```sql
create type app.resident_status as enum (
    'invited'
    ,'declined'
    ,'active'
    ,'inactive'
    ,'blocked_individual'
    ,'blocked_tenant'
    ,'supporting'
    ,'removed'          -- NEW: soft-removed from a workspace roster (reversible)
  );
```
`'removed'` is distinct from `'inactive'` (a dormant but valid membership — the state every
not-currently-entered member sits at, per `idx_uq_resident ... where status = 'active'`) and from
the `'blocked_*'` states (the separate block/unblock feature). Update the change's **revert** and
**verify** files accordingly.

No table/column/index changes: membership reuses `app.resident` rows; `uq_resident
(tenant_id, profile_id, type)` guarantees one guest row per (workspace, person), so re-adding is a
status flip, not a new row.

---

## Type Changes — `db/fnb-app/deploy/00000000010230_app_fn_types.sql` (in-place)

### `app_fn.profile_claims` — add `tenant_type`
```sql
create type app_fn.profile_claims as (
  profile_id uuid
  ,tenant_id uuid
  ,resident_id uuid
  ,actual_resident_id uuid
  ,profile_status app.profile_status
  ,permissions citext[]
  ,email citext
  ,display_name citext
  ,tenant_name citext
  ,tenant_type app.tenant_type      -- NEW
  ,modules app_fn.module_info[]
);
```
Every constructor of this composite must set the new field. Grep for assignments to a
`profile_claims`-typed variable — at minimum `app_fn.current_profile_claims`
(`00000000010240_app_fn.sql`); confirm `app_fn.profile_claims_for_user`
(`00000000010260_app_bootstrap.sql`, the pre-claims raw-pg path) is updated too so the db-access
and GraphQL claim paths agree.

### New composite — `app_fn.workspace_resident_candidate`
```sql
create type app_fn.workspace_resident_candidate as (
  profile_id            uuid
  ,email                citext
  ,display_name         citext
  ,full_name            citext
  ,home_tenant_name     citext        -- the person's home tenant, for disambiguation in the list
  ,workspace_resident_id uuid         -- their resident row in THIS workspace, or null
  ,workspace_status     app.resident_status
  ,is_member            boolean       -- resident row exists AND status <> 'removed'
);
```

---

## Claims population — `app_fn.current_profile_claims` (`00000000010240_app_fn.sql`, in-place)

Join the active tenant and set `tenant_type`:
```sql
-- when assembling _profile_claims, alongside tenant_name:
,(select type from app.tenant where id = _tenant_id)   -- tenant_type
```
(Mirror the same addition in `app_fn.profile_claims_for_user` so both claim paths carry it.)

---

## Functions — `db/fnb-app/deploy/00000000010242_app_fn_definers.sql` (in-place)

All four helpers are `SECURITY DEFINER` (they read/write tenants and residents across the tree,
which the caller cannot touch under RLS). The two `app_api` wrappers are `SECURITY INVOKER` and
hold the `p:app-admin` guard.

### `app_fn.tenant_tree_root(_tenant_id uuid) returns uuid` — DEFINER, STABLE
Walk up `parent_tenant_id` to the ancestor with none:
```sql
with recursive up as (
    select id, parent_tenant_id from app.tenant where id = _tenant_id
  union all
    select t.id, t.parent_tenant_id
    from app.tenant t join up on t.id = up.parent_tenant_id
)
select id from up where parent_tenant_id is null limit 1;
```

### `app_fn.tenant_tree_ids(_root_id uuid) returns setof uuid` — DEFINER, STABLE
All tenants in the tree rooted at `_root_id` (root + every descendant workspace):
```sql
with recursive down as (
    select id from app.tenant where id = _root_id
  union all
    select t.id from app.tenant t join down on t.parent_tenant_id = down.id
)
select id from down;
```

### `app_fn.workspace_resident_pool(_workspace_tenant_id uuid) returns setof app_fn.workspace_resident_candidate` — DEFINER, STABLE
```
1. _root := app_fn.tenant_tree_root(_workspace_tenant_id);
   (if the caller's tenant is not a workspace this still returns the tenant itself as root; the
    api guard below is what restricts use — but callers only invoke it for workspaces.)
2. return query:
   with tree as (select id from app_fn.tenant_tree_ids(_root)),
   pool as (
     select distinct r.profile_id
     from app.resident r
     where r.tenant_id in (select id from tree)
       and r.profile_id is not null          -- real people only (skip pending invites)
       and r.type <> 'support'               -- exclude support residents
   )
   select
     p.id,
     p.email,
     coalesce(p.display_name, split_part(p.email,'@',1))::citext,
     p.full_name,
     home_t.name,
     wr.id,
     wr.status,
     (wr.id is not null and wr.status <> 'removed')
   from pool
   join app.profile p               on p.id = pool.profile_id
   left join app.resident home_r    on home_r.profile_id = p.id and home_r.type = 'home'
   left join app.tenant   home_t    on home_t.id = home_r.tenant_id
   left join app.resident wr        on wr.profile_id = p.id
                                    and wr.tenant_id = _workspace_tenant_id
                                    and wr.type in ('home','guest')
   order by 3;   -- display_name
```

### `app_api.workspace_resident_pool() returns setof app_fn.workspace_resident_candidate` — INVOKER, STABLE
```sql
perform jwt.enforce_permission('p:app-admin');
return query select * from app_fn.workspace_resident_pool(jwt.tenant_id());
```
PostGraphile exposes this as **`workspaceResidentPoolList`**.

### `app_fn.set_workspace_membership(_workspace_tenant_id uuid, _profile_id uuid, _member boolean, _actor_profile_id uuid) returns app.resident` — DEFINER
```
1. Guard workspace:  select * into _ws from app.tenant where id = _workspace_tenant_id;
   if _ws.parent_tenant_id is null then raise exception '30000: NOT AUTHORIZED'; end if;
2. Guard pool membership: the target must hold a resident somewhere in the tree
   (select 1 from app.resident r where r.profile_id = _profile_id
      and r.tenant_id in (select app_fn.tenant_tree_ids(app_fn.tenant_tree_root(_workspace_tenant_id))));
   if not found → raise exception '30000: NOT AUTHORIZED';
3. Guard self-remove: if not _member and _profile_id = _actor_profile_id
      then raise exception '31010: CANNOT REMOVE SELF FROM WORKSPACE'; end if;
4. _email := (select email from app.profile where id = _profile_id);
   select * into _wr from app.resident
     where profile_id = _profile_id and tenant_id = _workspace_tenant_id and type in ('home','guest');

5. if _member then                                   -- ADD / re-activate
     if _wr.id is null then
       _wr := app_fn.invite_user(_workspace_tenant_id, _email, 'user');   -- guest + app-user license
     end if;
     -- dormant membership: entered later via assume_residency (matches create_workspace creator)
     update app.resident set status = 'inactive', updated_at = current_timestamp
       where id = _wr.id returning * into _wr;
     update app.license set status = 'active', updated_at = current_timestamp
       where resident_id = _wr.id and status = 'inactive';
   else                                               -- REMOVE (soft)
     update app.resident set status = 'removed', updated_at = current_timestamp
       where id = _wr.id returning * into _wr;
     update app.license set status = 'inactive', updated_at = current_timestamp
       where resident_id = _wr.id and status = 'active';
   end if;
6. return _wr;
```
Note: removing a member who is *currently entered* (`status='active'`) flips them to `'removed'`;
their live claims keep the stale residency until their next `refreshClaims`, same as the existing
block flow — acceptable, documented.

### `app_api.set_workspace_membership(_profile_id uuid, _member boolean) returns app.resident` — INVOKER
```sql
perform jwt.enforce_permission('p:app-admin');
return app_fn.set_workspace_membership(jwt.tenant_id(), _profile_id, _member, jwt.profile_id());
```
PostGraphile exposes this as the **`setWorkspaceMembership`** mutation; the payload's `resident`
is readable by the caller under the existing `view_all_for_tenant` / `manage_own_tenant_residencies`
policies (the row is in the caller's own tenant). **No new RLS policy required.**

---

## Deactivation cascade — remove from all tree workspaces

**Requirement:** deactivating (blocking) a resident in the tenant removes them from **every**
workspace in that tenant's tree.

### `app_fn.remove_profile_from_tree_workspaces(_profile_id uuid, _from_tenant_id uuid) returns void` — DEFINER
`00000000010242_app_fn_definers.sql`. Soft-`removed` on the profile's resident rows in all
`type='workspace'` tenants of the tree, and deactivate those workspace licenses:
```sql
_root := app_fn.tenant_tree_root(_from_tenant_id);

update app.resident r
  set status = 'removed', updated_at = current_timestamp
  where r.profile_id = _profile_id
    and r.status not in ('blocked_individual','blocked_tenant','removed')
    and r.tenant_id in (
      select id from app.tenant
      where type = 'workspace' and id in (select app_fn.tenant_tree_ids(_root)));

update app.license l
  set status = 'inactive', updated_at = current_timestamp
  from app.resident r
  where l.resident_id = r.id
    and r.profile_id = _profile_id
    and r.status = 'removed'
    and l.status = 'active'
    and r.tenant_id in (select app_fn.tenant_tree_ids(_root));
```

### Hook into `app_fn.block_resident` (`00000000010240_app_fn.sql`, in-place)
After the existing `update app.resident set status='blocked_individual' … returning * into _resident;`:
```sql
if _resident.profile_id is not null then
  perform app_fn.remove_profile_from_tree_workspaces(_resident.profile_id, _resident.tenant_id);
end if;
```
`block_resident` stays `SECURITY INVOKER`; the cascade's cross-tree writes happen inside the
`SECURITY DEFINER` helper. **`app_fn.unblock_resident` is unchanged** — it restores the tenant
residency to `'invited'` but does **not** re-add workspace memberships (they remain `'removed'`;
an admin re-adds via Manage Residents). If a separate "deactivate profile" path is ever added,
call the same helper from it.

## Types (client)

### `packages/fnb-types/src/profile-claims.ts`
```ts
import type { TenantType } from '@/tenant'   // 'ANCHOR' | 'CUSTOMER' | 'DEMO' | 'TEST' | 'TRIAL' | 'WORKSPACE'

export interface ProfileClaims {
  // …existing…
  tenantName: string | null
  tenantType: TenantType | null    // NEW
  modules: ModuleInfo[] | null
  residencies: ResidencyTreeNode[] | null
}
```
Populate it in the claims mapper/normalizer for **both** paths: the GraphQL
`current_profile_claims` selection (add `tenantType`) and the db-access raw-pg
`normalizeClaims` (`packages/db-access/src/utils/normalize-claims.ts`).

### View type (R4 — lives in the composable file, not `fnb-types`)
```ts
// packages/graphql-client-api/src/composables/useWorkspaceResidents.ts
export interface WorkspaceResidentCandidate {
  profileId: string
  email: string
  displayName: string
  fullName: string | null
  homeTenantName: string | null
  workspaceResidentId: string | null
  isMember: boolean
}
```

---

## GraphQL Operations (new)

Files under `packages/graphql-client-api/src/graphql/app/`:

| Operation | File | Generated hook | Variables |
|---|---|---|---|
| `WorkspaceResidentPool` (query) | `query/workspaceResidentPool.graphql` — `workspaceResidentPoolList { profileId email displayName fullName homeTenantName workspaceResidentId isMember }` | `useWorkspaceResidentPoolQuery()` | none |
| `SetWorkspaceMembership` (mutation) | `mutation/setWorkspaceMembership.graphql` — `setWorkspaceMembership(input: { profileId, member }) { resident { ...Resident } }` | `useSetWorkspaceMembershipMutation()` | `{ profileId: UUID!, member: Boolean! }` |

Claims op change: add `tenantType` to the existing `current_profile_claims` selection used by
`fetchProfileClaims` (auth-ui / graphql-client-api).

Smart tags: confirm PostGraphile names the mutation `setWorkspaceMembership` and the input arg
keys `profileId` / `member` (V5 inflection of `_profile_id` / `_member`). Add a tag in
`apps/graphql-api-app/postgraphile.tags.json5` only if inflection needs a nudge.

---

## Composable

**Source:** `packages/graphql-client-api/src/composables/useWorkspaceResidents.ts`
**Re-export:** `apps/tenant-app/app/composables/useWorkspaceResidents.ts` (single line)
**Package index:** add exports in `packages/graphql-client-api/src/index.ts`

### `useWorkspaceResidents()`
| Return | Shape | Notes |
|---|---|---|
| `candidates` | `computed<WorkspaceResidentCandidate[]>` | from `workspaceResidentPoolList`, `.filter(Boolean)` |
| `fetching` / `error` / `executeQuery` | urql standard | re-run with `{ requestPolicy: 'network-only' }` after each toggle |
| `setMembership(profileId, member)` | `Promise<void>` | `useSetWorkspaceMembershipMutation`; throws on `res.error`; re-runs the pool query |

Also expose `executeQuery` from `useAdminResidents` (currently returns `{ data, fetching, error }`
only) so the page can refresh the workspace's resident list after the modal makes changes.

## Open Questions
- [ ] None blocking.
