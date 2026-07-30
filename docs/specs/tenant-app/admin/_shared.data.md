# admin — Shared Data Types & Permissions

Referenced by all `admin/*.data.md` files. Do not duplicate these here.

## Status
Implemented — GraphQL

## Navigation

Registered in DB (`db/fnb-app/deploy/00000000010240_app_fn.sql`):
```
Module: 'admin' / 'Administration' / icon: i-lucide-shield / permission: p:app-admin / ordinal: 10
  'tenant-admin-users'        → /tenant/admin/user         i-lucide-users  p:app-admin
  'tenant-admin-licenses'     → /tenant/admin/license      i-lucide-users  p:app-admin
  'tenant-admin-subscription' → /tenant/admin/subscription i-lucide-users  p:app-admin
  'tenant-admin-workspaces'   → /tenant/admin/workspace    i-lucide-network p:app-admin
```

The workspaces tool (nested workspace tenants) has its own spec dir: `admin/workspace/`.

## Permission Model

| Action | Required |
|---|---|
| Access admin pages | `p:app-admin` |
| Block/unblock residents | `p:app-admin` or `p:app-admin-super` |
| Grant/revoke licenses | `p:app-admin` or `p:app-admin-super` |
| Deactivate/reactivate subscriptions | `p:app-admin-super` only |

Enforcement: `app_api.*` PL/pgSQL functions check permissions at the DB layer; PostGraphile enforces via RLS + `pgSettings` claims.

License types that grant `p:app-admin`:
- `app-admin` (scope: admin) — `p:app-admin`, `p:todo`, `p:todo-admin`, `p:discussions`, `p:discussions-admin`
- `app-admin-super` (scope: superadmin) — all above + `p:app-admin-super`, `p:app-admin-support`
- `app-admin-support` (scope: support) — `p:app-admin-support`, `p:exit-support`, `p:todo`, `p:discussions`

## GraphQL Client Setup

- **urql plugin**: `apps/tenant-app/app/plugins/urql.ts`
  - `url: pub.graphqlApiUrl`, `preferGetMethod: false`
  - exchanges: `cacheExchange → mapExchange(onError) → fetchExchange`
- **Composable source**: `packages/graphql-client-api/src/composables/`
- **Generated hooks**: `packages/graphql-client-api/src/generated/fnb-graphql-api.ts`
- **Re-export location**: `apps/tenant-app/app/composables/useAdmin*.ts` (single-line re-export from `@function-bucket/fnb-graphql-client-api`)
- **Package index**: `packages/graphql-client-api/src/index.ts` — add admin composable exports here

## Data Types

Types are derived from the PostGraphile schema via `packages/graphql-client-api/src/generated/fnb-graphql-api.ts`. Field shapes match the fragments defined in `packages/graphql-client-api/src/graphql/app/fragment/`.

### Resident (fragment: `app/fragment/Resident.graphql`)
| Field | Type | Notes |
|---|---|---|
| id | string (UUID) | |
| profileId | string \| null | |
| tenantId | string | |
| tenantName | string \| null | |
| status | string | invited, declined, active, inactive, blocked_individual, blocked_tenant, supporting |
| type | string | home, guest, support |
| displayName | string \| null | |
| email | string | |

### License (fragment: `app/fragment/License.graphql`)
| Field | Type | Notes |
|---|---|---|
| id | string (UUID) | |
| tenantId / residentId / profileId | string | |
| tenantSubscriptionId | string | |
| licenseTypeKey | string | |
| status | string | active, inactive, expired |
| expiresAt | string \| null | ISO date string |
| createdAt / updatedAt | string | ISO date strings |

### TenantSubscription (fragment: `app/fragment/TenantSubscription.graphql`)
| Field | Type | Notes |
|---|---|---|
| id | string (UUID) | |
| licensePackKey | string | |
| status | string | active, inactive |

### LicensePack (fragment: `app/fragment/LicensePack.graphql`)
| Field | Type |
|---|---|
| key | string |
| displayName | string |
| description | string \| null |
| autoSubscribe | boolean |

### LicensePackLicenseType (fragment: `app/fragment/LicensePackLicenseType.graphql`)
| Field | Type |
|---|---|
| id | string |
| licensePackKey | string |
| licenseTypeKey | string |
| numberOfLicenses | number |
| expirationIntervalType / expirationIntervalMultiplier | — |

### LicenseType (fragment: `app/fragment/LicenseType.graphql`)
| Field | Type |
|---|---|
| key | string |
| displayName | string |
| applicationKey | string |
| assignmentScope | string — user, admin, superadmin, support, none, all |

## GraphQL Queries (app module)

All query `.graphql` files live in `packages/graphql-client-api/src/graphql/app/query/`.

| Query name | File | Generated hook | Variables |
|---|---|---|---|
| `TenantResidents` | `appTenantResidents.graphql` | `useTenantResidentsQuery()` | none |
| `ResidentById` | `residentById.graphql` | `useResidentByIdQuery()` | `{ residentId: UUID! }` |
| `TenantLicenses` | `appTenantLicenses.graphql` | `useTenantLicensesQuery()` | none |
| `TenantSubscriptions` | `appTenantSubscriptions.graphql` | `useTenantSubscriptionsQuery()` | `{ tenantId: UUID! }` |

## GraphQL Mutations (app module)

All mutation `.graphql` files live in `packages/graphql-client-api/src/graphql/app/mutation/`.

| Mutation name | File | Generated hook | Variables | Permission |
|---|---|---|---|---|
| `BlockResident` | `blockResidency.graphql` | `useBlockResidentMutation()` | `{ residentId: UUID! }` | `p:app-admin` |
| `UnblockResident` | `unblockResidency.graphql` | `useUnblockResidentMutation()` | `{ residentId: UUID! }` | `p:app-admin` |
| `GrantUserLicense` | `grantUserLicense.graphql` | `useGrantUserLicenseMutation()` | `{ residentId: UUID!, licenseTypeKey: String! }` | `p:app-admin` |
| `RevokeUserLicense` | `revokeUserLicense.graphql` | `useRevokeUserLicenseMutation()` | `{ licenseId: UUID! }` | `p:app-admin` |
| `DeactivateTenantSubscription` | `deactivateTenantSubscription.graphql` | `useDeactivateTenantSubscriptionMutation()` | `{ tenantSubscriptionId: UUID! }` | `p:app-admin-super` |
| `ReactivateTenantSubscription` | `reactivateTenantSubscription.graphql` | `useReactivateTenantSubscriptionMutation()` | `{ tenantSubscriptionId: UUID! }` | `p:app-admin-super` |

## Known Gaps

- **Activate/deactivate license status**: The REST layer used `updateLicenseStatus(db, id, 'active'|'inactive')` via `app_api`. This mutation is not currently exposed in the PostGraphile schema. Until a `updateLicenseStatus` mutation is added, the license page cannot toggle individual license status.
- **Subscription detail by ID**: No `subscriptionById` query exists. The subscription detail page must either filter the `TenantSubscriptions` result client-side by ID, or a new focused query must be added.
- **ResidentDetail subscriptionPacks**: The `ResidentById` query returns the resident + their licenses but not `subscriptionPacks`. The resident detail composable sources subscription pack data via a separate `TenantSubscriptions` query and joins client-side.
