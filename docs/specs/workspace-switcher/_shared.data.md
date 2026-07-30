# workspace-switcher — Shared Data, Schema & Permissions

Referenced by `switcher.data.md` and `switcher.ui.md`. Do not duplicate here.

## Status
Implemented — GraphQL (claims delivery), 2026-07-10. Decisions locked 2026-07-10 (revised same
day: delivery via `ProfileClaims.residencies`). Corrections: README §Implementation corrections.

## Permission Model

| Action | Required | Enforced by |
|---|---|---|
| See the switcher trigger | logged in (claims present) | component `v-if` on `isLoggedIn` |
| Fetch the residency tree (rides the claims document) | any authenticated profile | `app_api.my_residency_tree()` keys on `jwt.email()` — anon (null email) gets an empty set, matching `my_profile_residencies` |
| Switch to a residency | a residency of your own in the target tenant | existing `app_api.assume_residency` (SECURITY DEFINER, email-matched) |
| Switch while in support mode | **not offered** | trigger renders static when claims include `p:exit-support` |

**The claims `residencies` tree is never the gate (R13).** The server-side authority for a switch
is the `app.resident` row itself: `app_fn.assume_residency`
(`00000000010242_app_fn_definers.sql:87`) requires `id = _resident_id AND email = _email`, where
`_email` is `jwt.email()` — rebuilt per request from the sealed httpOnly session cookie
(`claims_for_session`), never from localStorage. A tampered localStorage `residencies` entry can
change what the modal *displays*, but the corresponding `assume_residency` call raises
`NO RESIDENT FOR EMAIL`. This is also why `residencies` is excluded from `buildJwtPayload` —
it never rides `request.jwt.claims`, so no RLS policy or `_api` guard can come to depend on it.

No RLS policy changes. The tree function is SECURITY DEFINER (it must read `app.tenant` rows —
name, status, parentage — for tenants where the caller's residency is inactive and for ghost
ancestors, which RLS hides from the invoker). It exposes only: tenant id/name/type/status/parent
and the caller's own resident id/status/type. This mirrors what `my_profile_residencies` +
`ResidencySelectModal` already leak by design (tenant names of your own residencies), plus
ancestor tenant names — acceptable: an ancestor's name is visible to anyone invited into a
descendant workspace.

## Composite Type — `db/fnb-app/deploy/00000000010230_app_fn_types.sql` (in-place)

Follows the `app_fn.profile_claims` precedent (composite types live in `<module>_fn`):

```sql
create type app_fn.residency_tree_node as (
  tenant_id uuid
  ,tenant_name citext
  ,tenant_type app.tenant_type
  ,tenant_status app.tenant_status
  ,parent_tenant_id uuid
  ,resident_id uuid              -- null ⇒ ghost ancestor node (no residency)
  ,resident_status app.resident_status
  ,resident_type app.resident_type
);
```

## Functions — `db/fnb-app/deploy/00000000010240_app_fn.sql` (in-place, next to `my_profile_residencies`)

### `app_fn.my_residency_tree(_email citext) returns setof app_fn.residency_tree_node`
`SECURITY DEFINER`, `STABLE`. One recursive CTE: seed with the tenants of every residency the
email holds, walk up `parent_tenant_id` (plain `union` dedupes shared ancestors), then left-join
the caller's resident row back on:

```sql
return query
with recursive residency_tenants as (
  select t.id, t.name, t.type, t.status, t.parent_tenant_id
  from app.tenant t
  where t.id in (select r.tenant_id from app.resident r where r.email = _email)
  union
  select p.id, p.name, p.type, p.status, p.parent_tenant_id
  from app.tenant p
  join residency_tenants c on p.id = c.parent_tenant_id
)
select rt.id, rt.name, rt.type, rt.status, rt.parent_tenant_id,
       r.id, r.status, r.type
from residency_tenants rt
left join app.resident r on r.tenant_id = rt.id and r.email = _email
order by rt.name;
```

Notes:
- Ghost ancestor rows come out with `resident_id/resident_status/resident_type` null.
- No pre-claims usage — a normal DEFINER helper like `my_profile_residencies`; no `search_path`
  pinning beyond the file's existing conventions.
- Ordering is cosmetic; the client builds the tree from `(tenant_id, parent_tenant_id)` pairs
  and sorts siblings by name itself.

### `app_api.my_residency_tree() returns setof app_fn.residency_tree_node`
`SECURITY INVOKER`, `STABLE`. No explicit permission guard — matches `my_profile_residencies`
(`jwt.email()` is null for anon → empty result):

```sql
return query select * from app_fn.my_residency_tree(jwt.email());
```

PostGraphile exposes this as the query field `myResidencyTreeList` returning a generated record
type (the `app_fn.profile_claims` / `currentProfileClaims` precedent shows composite returns
from non-exposed schemas work).

**Delivery:** `myResidencyTreeList` is **not** queried by a standalone switcher operation — it is
selected inside the existing `CurrentProfileClaims` document and mapped into
`ProfileClaims.residencies` by `fetchProfileClaims`, exactly the way `availableModules` becomes
`ProfileClaims.modules`. The `app_fn.profile_claims` composite is deliberately **not** extended
(`claims_for_session` rebuilds server claims every request; nothing server-side reads
residencies — `buildJwtPayload` forwards neither `modules` nor `residencies`). See
`switcher.data.md`.

## Types — `packages/fnb-types/src/residency-tree.ts` (new)

```ts
// Node of the residency-switcher tree (app_api.my_residency_tree). resident* fields are null on
// ghost ancestor nodes — tenants the user can see in the hierarchy but holds no residency in.
// Enum unions mirror the GraphQL enum values verbatim (UPPERCASE) per R3.

import type { TenantType, TenantStatus } from '@/tenant'
import type { ResidentStatus, ResidentType } from '@/resident'

export interface ResidencyTreeNode {
  tenantId: string
  tenantName: string
  tenantType: TenantType
  tenantStatus: TenantStatus
  parentTenantId: string | null
  residentId: string | null
  residentStatus: ResidentStatus | null
  residentType: ResidentType | null
}
```

Barrel-export from `packages/fnb-types/src/index.ts`. (Adjust the import paths to the actual
alias style used by neighboring files in `fnb-types` — verified style: `from '@/tenant'`.)

### `ProfileClaims` — `packages/fnb-types/src/profile-claims.ts` (extend)

```ts
export interface ProfileClaims {
  // …existing fields…
  residencies: ResidencyTreeNode[] | null
}
```

Nullable by design: the **GraphQL claims path populates it** (`fetchProfileClaims`); the
**raw-pg server path leaves it `null`** (`db-access` `currentProfileClaims` /
`profileClaimsForUser` — the composite has no such field, and `camelCaseKeys`' output simply
never carries the key; the mapper should default it to `null` explicitly). This mirrors the
existing asymmetry where server claims carry composite `modules` while client claims assemble
them from `availableModules`. `buildJwtPayload` (`db-access/src/jwt.ts`) is **not** touched —
residencies never ride `request.jwt.claims`.

## Shared constant — `ENTERABLE_STATUSES`

`packages/graphql-client-api/src/composables/useWorkspaces.ts` currently holds a private
`ENTERABLE_STATUSES: ResidentStatus[] = ['INVITED', 'ACTIVE', 'INACTIVE', 'SUPPORTING']`.
Export it (from `useResidency.ts`, its natural home, re-imported by `useWorkspaces`) so the
switcher logic in `auth-ui` (which already depends on `graphql-client-api`) and the workspace
list share one definition of "can assume this residency".
