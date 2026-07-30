# site-admin — Shared Data Types & Permissions

## Status
Implemented — GraphQL (queries); partial Known Gaps for mutations (see individual data files)

Referenced by all `site-admin/*.data.md` files.

## GraphQL Client Setup

All data fetching in this module uses urql + PostGraphile. urql plugin:
`apps/tenant-app/app/plugins/urql.client.ts` (`preferGetMethod: false`, provides `$urqlClient`).

**Composable source package:** `packages/graphql-client-api`
- GraphQL operations: `src/graphql/app/query/` and `src/graphql/app/mutation/`
- Generated urql hooks: `src/generated/fnb-graphql-api.ts` (auto-generated — do not edit)
- Composable wrappers: `src/composables/useSiteAdmin*.ts`

**Tenant-app re-export files:**
- `apps/tenant-app/app/composables/useSiteAdminTenants.ts` — tenant composables (+ `useBecomeSupport`)
- `apps/tenant-app/app/composables/useSiteAdminUsers.ts` — user composables
- `apps/tenant-app/app/composables/useSiteAdminApplications.ts` — application composables

**BecomeSupport is pure GraphQL now.** `useBecomeSupport().becomeSupportForTenant(tenantId)` runs
the `BecomeSupport` mutation (`useBecomeSupportMutation`) directly — there is no Nitro endpoint and
no `auth.user` cookie. Claims are re-derived server-side from the `session` cookie per request, and
the client refreshes its localStorage claims via GraphQL (`useAuth().refreshClaims()`).

## Navigation
```
Module: 'site-admin' / 'Super Admin' / icon: i-lucide-shield-check / permission: p:app-admin-super / ordinal: 9
  'tenant-site-admin-tenants'      → /tenant/site-admin/tenant      i-lucide-building-2  p:app-admin-super
  'tenant-site-admin-users'        → /tenant/site-admin/user         i-lucide-building-2  p:app-admin-super
  'tenant-site-admin-applications' → /tenant/site-admin/application  i-lucide-building-2  p:app-admin-super
```
Known gap: all three tools share the same icon `i-lucide-building-2`.

## Permission Model
| Action | Required |
|---|---|
| Access site-admin | `p:app-admin-super` |
| Enter support mode | `p:app-admin-support` OR `p:app-admin-super` |
| Activate/deactivate tenants | `p:app-admin-super` (DB enforced) |
| Create tenant | `p:app-admin-super` (RLS `manage_tenant` policy only — `app_api.create_tenant` has no `jwt.enforce_permission` call; see `tenant/index.data.md` Known Gaps) |
| Edit profiles/residents | `p:app-admin-super` (DB enforced via `updateProfileAdmin`) |
| Read any tenant's residents / licenses / subscriptions | `p:app-admin-super` (existing RLS read policies — `00000000010250_app_policies.sql:58/106/90`) |
| Search platform users (`app_api.search_profiles` + `_count`) | `p:app-admin-support` (fn guard — matches the sibling `search_tenants`/`search_residents`; page nav stays `p:app-admin-super`) |
| Invite a user into **another** tenant | **Not possible directly** (reversal 2026-07-27) — enter support mode, then invite as that tenant's admin (`p:app-admin` via supporting claims). The `targetTenantId` pass-through was removed. |

`canSupport` computed in pages:
```ts
user.value?.permissions?.includes('p:app-admin-support') ||
user.value?.permissions?.includes('p:app-admin-super')
```

Enforcement: client gates button visibility; DB enforces via RLS (fired through PostGraphile's
`pgSettings`) and `app_api.*` `jwt.enforce_permission` gates.

## Data Types (from PostGraphile codegen — `packages/graphql-client-api/src/generated/fnb-graphql-api.ts`)

Types below are the GraphQL schema shapes (generated); the field tables are kept as reference.

### Tenant
| Field | Type | Notes |
|---|---|---|
| id | TenantId | |
| name | string | |
| identifier | string \| null | |
| type | TenantType | anchor, customer, demo, test, trial |
| status | TenantStatus | active, inactive, paused |
| createdAt / updatedAt | Date | |

### Profile
| Field | Type | Notes |
|---|---|---|
| id | ProfileId | |
| email | string | |
| firstName / lastName / fullName | string \| null | fullName is computed, read-only |
| displayName / phone / identifier | string \| null | |
| avatarKey | string \| null | |
| isPublic | boolean | |
| status | ProfileStatus | active, inactive, blocked |
| createdAt / updatedAt | Date | |

### AuthUser (from `auth.user`)
```ts
{ id, email, role, emailConfirmedAt, lastSignInAt, createdAt, updatedAt }
```

### Application / Module / Tool / LicenseType
GraphQL types generated from the PostGraphile schema; fragments in `src/graphql/app/fragment/`.

## GraphQL Operations (site-admin)

| Operation | `.graphql` file | Generated hook | Composable |
|---|---|---|---|
| `SearchTenants($searchTerm)` | `app/query/searchTenants.graphql` | `useSearchTenantsQuery()` | `useSiteAdminTenants()` |
| `AppTenantById($tenantId)` | `app/query/appTenantById.graphql` | `useTenantByIdQuery()` | `useSiteAdminTenant(id)` |
| `SearchProfiles($searchTerm, $limit, $offset)` | `app/query/searchProfiles.graphql` — list + `searchProfilesCount` (2026-07-27, replaced `AllAppProfiles` — see `user/README.md`) | `useSearchProfilesQuery()` | `useSiteAdminUsers(opts)` |
| `SiteUserById($id)` | `app/query/siteUserById.graphql` | `useSiteUserByIdQuery()` | `useSiteAdminUser(id)` |
| `AllApplications` | `app/query/allApplications.graphql` | `useAllApplicationsQuery()` | `useSiteAdminApplications()` |
| `ApplicationByKey($key)` | `app/query/applicationByKey.graphql` | `useApplicationByKeyQuery()` | `useSiteAdminApplication(key)` |
| `ActivateAppTenant` / `DeactivateAppTenant` | `app/mutation/{activate,deactivate}AppTenant.graphql` | `useActivateTenantMutation()` / `useDeactivateTenantMutation()` | `useSiteAdminTenant` |
| `UpdateTenant` | `app/mutation/updateTenant.graphql` | `useUpdateTenantMutation()` | `useSiteAdminTenant` |
| `UpdateUser` / `UpdateUserStatus` | `app/mutation/updateUser*.graphql` | `useUpdateUserMutation()` / `useUpdateUserStatusMutation()` | `useSiteAdminUser` |
| `UpdateResidentStatus` | `app/mutation/updateResidentStatus.graphql` | `useUpdateResidentStatusMutation()` | `useSiteAdminUser` |
| `BecomeSupport` | `app/mutation/becomeSupport.graphql` | `useBecomeSupportMutation()` | `useBecomeSupport()` |
| `CreateTenant($name, $email, $firstName, $lastName, $phone)` | `app/mutation/createAppTenant.graphql` | `useCreateTenantMutation()` | `useCreateTenant()` (New Tenant modal — see `tenant/index.data.md`; `$firstName`/`$lastName`/`$phone` are the admin-identity extension built 2026-07-30, pre-creating the admin's `app.profile`) |

`AppTenantById` is extended (`tenant/[id].data.md`) to return the tenant's residents (with
licenses) and subscriptions (with pack + license counts) — read-only. The tenant detail page
does **not** dispatch invites (reversal 2026-07-27: the `targetTenantId` pass-through was
removed; super admins enter support mode and invite from the tenant's own admin pages). The
sync **link mode** on the `invite-user` workflow survives for the tenant-admin resend + U9
checkbox (`tenant/[id].data.md` Delta 2, extends `docs/specs/user-invitation/`).

Composables shape the raw GraphQL response into view types (e.g. `TenantSummary` in
`useSiteAdminTenants.ts`, `UserDetail`-like objects in `useSiteAdminUser`). View types are declared
in the composable files (R4), not in a db-types package. All mutations go through `app_api.*`
(SECURITY INVOKER, `jwt.enforce_permission`) → `app_fn.*`.

## Support Mode Flow (GraphQL)
1. Client: `useBecomeSupport().becomeSupportForTenant(tenantId)` → `BecomeSupport` mutation →
   `app_api.become_support` → tenant-scoped claims in the DB.
2. Client: `useAuth().refreshClaims()` re-fetches `ProfileClaims` via GraphQL into localStorage,
   then navigate (e.g. to `/admin`). The `session` cookie is unchanged — claims are re-derived per request.
3. Exit: `useAuth().exitSupport()` → `exitSupportMode` GraphQL mutation → `refreshClaims()` → home.

Detection: `claims.residentId !== claims.actualResidentId` (or `permissions.includes('p:exit-support')`).
