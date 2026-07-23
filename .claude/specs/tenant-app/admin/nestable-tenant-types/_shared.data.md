# admin/nestable-tenant-types — Shared Data, Schema & Permissions

## Status
Draft — build-ready (no `[FILL IN]`). Authoritative delta for the `client`/`organization` node
types, the spine pool scope, and the `p:app-admin` type-editing path. Existing tenant/resident
shapes live in `../_shared.data.md` and `../workspace/_shared.data.md` — not duplicated here.

## Permission Model

| Action | Required | Enforced by |
|---|---|---|
| See **Manage Residents** button | `p:app-admin` **and** `tenantType ∈ {WORKSPACE, CLIENT, ORGANIZATION}` | client gate on claims (`permissions` + `tenantType`); button is a hint (R13) |
| Read the spine resident pool | `p:app-admin` | `app_api.workspace_resident_pool` guard + `SECURITY DEFINER` body |
| Set a **root** tenant's type | `p:app-admin-super` | `app_api.update_tenant` (existing) |
| Set a **nested** tenant's type (direct child) | `p:app-admin` | `app_api.set_nested_tenant_type` guard + `SECURITY DEFINER` body (validates direct-child + nestable type) |

All cross-tenant reach stays inside `SECURITY DEFINER` `app_fn` bodies keyed off `jwt.tenant_id()`
— same rule as `../workspace/_shared.data.md` and `../user/_shared.data.md`.

---

## DB Schema Changes — `db/fnb-app/deploy/00000000010220_app.sql` (in-place)

### `app.tenant_type` — add two values
```sql
create type app.tenant_type as enum (
    'anchor'
    ,'client'          -- NEW: nested node type (child-only)
    ,'customer'
    ,'demo'
    ,'organization'    -- NEW: nested node type (child-only)
    ,'test'
    ,'trial'
    ,'workspace'
  );
```

### Constraint — generalize `chk_workspace_parent` → `chk_nested_parent`
```sql
create table if not exists app.tenant (
    ...
    ,type app.tenant_type not null default 'customer'
    ,status app.tenant_status not null default 'active'
    ,parent_tenant_id uuid null references app.tenant(id)
    -- the nestable node types carry a parent; every other (root) type does not
    ,constraint chk_nested_parent check (
       (type in ('workspace','client','organization')) = (parent_tenant_id is not null)
     )
  );
```
`default 'customer'` (root) and the name-uniqueness partial indexes are unchanged. Update the
change's **revert** (`revert/00000000010220_app.sql`) and **verify**
(`verify/00000000010220_app.sql` — the constraint existence check) to the new name/predicate and
new enum values.

No other table/column/index changes. `client`/`organization` are new values, so no existing row
violates the child-only rule.

---

## DB Function Changes

### Spine helper — `00000000010242_app_fn_definers.sql` (new, DEFINER)
Ancestors + self + own subtree, in one recursive query. Replaces the `tenant_tree_root` + whole-
tree pattern for the pool.
```sql
CREATE OR REPLACE FUNCTION app_fn.tenant_spine_ids(_tenant_id uuid)
  RETURNS setof uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  AS $function$
    with recursive up as (          -- self + ancestors (walk to root)
        select id, parent_tenant_id from app.tenant where id = _tenant_id
      union all
        select t.id, t.parent_tenant_id
        from app.tenant t join up on t.id = up.parent_tenant_id
    ),
    down as (                        -- self + descendants (walk the subtree)
        select id from app.tenant where id = _tenant_id
      union all
        select t.id from app.tenant t join down on t.parent_tenant_id = down.id
    )
    select id from up
    union
    select id from down;             -- union dedupes the shared self row
  $function$
  ;
```
`app_fn.tenant_tree_root` / `app_fn.tenant_tree_ids` stay (still used by the block cascade). Only
the pool stops calling them.

### Pool rewrite — `app_fn.workspace_resident_pool` (`00000000010242_app_fn_definers.sql`, in-place)
Scope on the spine instead of the whole tree. The profile join + membership annotation are
**unchanged** — only the candidate `where` clause and the removed `_root` variable differ.
```sql
CREATE OR REPLACE FUNCTION app_fn.workspace_resident_pool(_workspace_tenant_id uuid)
  RETURNS setof app_fn.workspace_resident_candidate
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  AS $function$
  BEGIN
    return query
    with pool as (
      select distinct r.profile_id
      from app.resident r
      where r.tenant_id in (select app_fn.tenant_spine_ids(_workspace_tenant_id))  -- CHANGED
        and r.profile_id is not null       -- real people only
        and r.type <> 'support'            -- exclude support residents
    )
    select
      p.id
      ,p.email
      ,coalesce(p.display_name, split_part(p.email,'@',1))::citext
      ,p.full_name
      ,home_t.name
      ,wr.id
      ,wr.status
      ,(wr.id is not null and wr.status <> 'removed')
    from pool
    join app.profile p        on p.id = pool.profile_id
    left join app.resident home_r on home_r.profile_id = p.id and home_r.type = 'home'
    left join app.tenant   home_t on home_t.id = home_r.tenant_id
    left join app.resident wr on wr.profile_id = p.id
                             and wr.tenant_id = _workspace_tenant_id
                             and wr.type in ('home','guest')
    order by 3;
  END;
  $function$
  ;
```
`app_api.workspace_resident_pool` (INVOKER, `p:app-admin` guard) is **unchanged**.

### Block cascade — `app_fn.remove_profile_from_tree_workspaces` (`00000000010240_app_fn.sql`, in-place)
Stays **whole-tree**; only the type filter broadens.
```sql
    -- both the resident soft-remove and the license-inactivate use this filter:
    where type in ('workspace','client','organization')   -- was: type = 'workspace'
      and id in (select app_fn.tenant_tree_ids(_root))
```
`_root := app_fn.tenant_tree_root(_from_tenant_id)` is retained (whole-tree scope).

### New — nested tenant type editor (`00000000010240_app_fn.sql`)
`p:app-admin`-scoped path so a tenant admin can relabel a **direct child** among the nestable
trio. `update_tenant` (super-only) still owns root-type edits.
```sql
CREATE OR REPLACE FUNCTION app_fn.set_nested_tenant_type(_tenant_id uuid, _type app.tenant_type)
    RETURNS app.tenant
    LANGUAGE plpgsql
    VOLATILE
    SECURITY DEFINER
  AS $$
  DECLARE
    _tenant app.tenant;
  BEGIN
    IF _type NOT IN ('workspace','client','organization') THEN
      RAISE EXCEPTION 'not a nestable tenant type: %', _type USING ERRCODE = '22023';
    END IF;

    UPDATE app.tenant
      SET type = _type, updated_at = now()
      WHERE id = _tenant_id
        AND parent_tenant_id = jwt.tenant_id()   -- direct child of the acting tenant only
      RETURNING * INTO _tenant;

    IF _tenant IS NULL THEN
      RAISE EXCEPTION 'not a direct child of the current tenant: %', _tenant_id
        USING ERRCODE = '42501';
    END IF;

    RETURN _tenant;
  END;
  $$;

CREATE OR REPLACE FUNCTION app_api.set_nested_tenant_type(_tenant_id uuid, _type app.tenant_type)
    RETURNS app.tenant
    LANGUAGE plpgsql
    VOLATILE
    SECURITY INVOKER
  AS $$
  BEGIN
    PERFORM jwt.enforce_permission('p:app-admin');
    RETURN app_fn.set_nested_tenant_type(_tenant_id, _type);
  END;
  $$;
```
The target is already a child (has a parent), so the `chk_nested_parent` constraint is satisfied
by any nestable type — no root-type can be assigned here.

> Grant note: mirror the `EXECUTE` grant pattern used by the existing `app_api.*` functions for
> `set_nested_tenant_type` in `00000000010242_app_fn_definers.sql`'s grant block (follow
> `app_api.workspace_resident_pool` / `deactivate_workspace`).

---

## Type Changes — `packages/fnb-types/src/tenant.ts`
```ts
export type TenantType =
  | 'ANCHOR' | 'CLIENT' | 'CUSTOMER' | 'DEMO'
  | 'ORGANIZATION' | 'TEST' | 'TRIAL' | 'WORKSPACE'
```
`ProfileClaims.tenantType` already exists (`src/profile-claims.ts`); no shape change — the union
just gains two members. `normalizeClaims` (db-access) already uppercases the raw-pg value, so
`CLIENT`/`ORGANIZATION` flow through unchanged.

---

## GraphQL

### Existing — `workspaceResidentPool` (query)
`packages/graphql-client-api/src/graphql/app/query/workspaceResidentPool.graphql` — **unchanged**.
The scope narrowing is entirely server-side (`tenant_spine_ids`); the operation, variables, and
`workspace_resident_candidate` shape are identical.

### New — `setNestedTenantType` (mutation)
`packages/graphql-client-api/src/graphql/app/mutation/setNestedTenantType.graphql`
```graphql
mutation SetNestedTenantType($tenantId: UUID!, $type: TenantType!) {
  setNestedTenantType(input: { tenantId: $tenantId, type: $type }) {
    tenant { id name type parentTenantId status }
  }
}
```
> Confirm the exact PostGraphile field/input inflection against the live schema after rebuild
> (mirror how `updateTenant` / `deactivateWorkspace` are shaped in existing `.graphql` files).

### Composable
Add to the real impl `packages/graphql-client-api/src/composables/useWorkspaces.ts` (consumed by
`useWorkspaceDetail`), re-exported unchanged via `apps/tenant-app/app/composables/useWorkspaces.ts`:
```ts
const { executeMutation: execSetType } = useSetNestedTenantTypeMutation()

async function setNestedType(tenantId: string, type: TenantType) {
  const res = await execSetType({ tenantId, type })
  if (res.error) throw res.error
  executeQuery({ requestPolicy: 'network-only' })   // refresh the detail
}
```
Return `setNestedType` from `useWorkspaceDetail`.

For the **site-admin** path no new op is needed — `updateTenant` already carries `type`; ensure
the tenant **detail query** selects `parentTenantId` so the page can pick nested-vs-root options
(see `ui.md`).

---

## Open Questions
- None blocking.
