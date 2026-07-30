# admin/subscription/index — Subscription List Data

## Status
Implemented — GraphQL

## Route
`/tenant/admin/subscription` — see `index.ui.md` for UI details

## GraphQL

### Query on load
- **Query name**: `TenantSubscriptions`
- **File**: `packages/graphql-client-api/src/graphql/app/query/appTenantSubscriptions.graphql`
- **Generated hook**: `useTenantSubscriptionsQuery({ variables: { tenantId } })`
- **Variables**: `{ tenantId: UUID! }` — sourced from `useProfileClaims()` (or equivalent claims composable) in the composable
- **Returns**: `tenantSubscriptions[]` — each includes:
  - `TenantSubscription` fragment (id, licensePackKey, status)
  - `tenant { ...Tenant }`
  - `licenses { totalCount }`
  - `licensePack { ...LicensePack, licensePackLicenseTypes: [...LicensePackLicenseType + LicenseType + permissions] }`
- **Auth**: RLS enforces tenant scoping; PostGraphile uses claims set in pgSettings

### Mutations

| Mutation | Generated hook | Variables | Permission |
|---|---|---|---|
| `DeactivateTenantSubscription` | `useDeactivateTenantSubscriptionMutation()` | `{ tenantSubscriptionId: UUID! }` | `p:app-admin-super` |
| `ReactivateTenantSubscription` | `useReactivateTenantSubscriptionMutation()` | `{ tenantSubscriptionId: UUID! }` | `p:app-admin-super` |

After each mutation the composable calls `executeQuery({ requestPolicy: 'network-only' })` to re-fetch the subscriptions list.

## Composable

**Source**: `packages/graphql-client-api/src/composables/useAdminSubscriptions.ts`
**Re-export**: `apps/tenant-app/app/composables/useAdminSubscriptions.ts`

```ts
// re-export file (single line)
export { useAdminSubscriptions } from '@function-bucket/fnb-graphql-client-api'
```

| Export | Shape | Usage |
|---|---|---|
| `useAdminSubscriptions(tenantId: string)` | `{ data, fetching, error, deactivateSubscription, reactivateSubscription }` | called in index.vue on mount |

`data` is a `ComputedRef` of mapped subscription objects from `useTenantSubscriptionsQuery`. The GraphQL response already includes licensePack and licensePackLicenseTypes nested, replacing the former `SubscriptionPackDetail` composite type.

Mutation functions return `Promise<void>` and trigger a re-fetch on success.

## Types
See `_shared.data.md` → TenantSubscription, LicensePack, LicensePackLicenseType, LicenseType, GraphQL Queries, GraphQL Mutations
