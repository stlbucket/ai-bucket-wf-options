# admin/subscription/[id] — Subscription Detail Data

## Status
Implemented — GraphQL

## Route
`/tenant/admin/subscription/[id]` — see `[id].ui.md` for UI details

## GraphQL

### Query on load
- **Query name**: `TenantSubscriptions` (reused from index)
- **File**: `packages/graphql-client-api/src/graphql/app/query/appTenantSubscriptions.graphql`
- **Generated hook**: `useTenantSubscriptionsQuery({ variables: { tenantId } })`
- **Variables**: `{ tenantId: UUID! }` — sourced from claims in the composable
- **Returns**: full subscription list (same shape as index page); the composable filters client-side by `id` to extract the single subscription
- **Auth**: RLS enforces tenant scoping

No dedicated `subscriptionById` query exists. See Known Gaps in `_shared.data.md`.

The `TenantSubscriptions` query returns licensePack + licensePackLicenseTypes + licenseType nested per subscription, which covers the former `SubscriptionDetail.licensePack / licensePackLicenseTypes / licenseTypes` fields. However, **licenses with residents** (the `SubscriptionDetail.licenses` + `SubscriptionDetail.residents` fields) are not returned by this query — only `licenses.totalCount` is available. A query extension or new query is needed to show the license holder list on the detail page.

### Mutations

| Mutation | Generated hook | Variables | Permission |
|---|---|---|---|
| `DeactivateTenantSubscription` | `useDeactivateTenantSubscriptionMutation()` | `{ tenantSubscriptionId: UUID! }` | `p:app-admin-super` |
| `ReactivateTenantSubscription` | `useReactivateTenantSubscriptionMutation()` | `{ tenantSubscriptionId: UUID! }` | `p:app-admin-super` |

After each mutation the composable calls `executeQuery({ requestPolicy: 'network-only' })`.

## Composable

**Source**: `packages/graphql-client-api/src/composables/useAdminSubscriptions.ts`
**Re-export**: `apps/tenant-app/app/composables/useAdminSubscriptions.ts`

```ts
// re-export file (single line)
export { useAdminSubscriptions, useAdminSubscription } from '@function-bucket/fnb-graphql-client-api'
```

| Export | Shape | Usage |
|---|---|---|
| `useAdminSubscription(id: string, tenantId: string)` | `{ data, fetching, error, deactivateSubscription, reactivateSubscription }` | called in [id].vue on mount |

`data` is a `ComputedRef` that runs `useTenantSubscriptionsQuery` and filters the result by `id`. Returns `null` if the subscription is not found. Does not include license holders (see Known Gaps).

Mutation functions return `Promise<void>` and trigger a re-fetch on success.

## Known Gaps
- No `subscriptionById` query — the composable fetches all tenant subscriptions and filters client-side. This is acceptable for the admin use case (subscription counts are small) but a dedicated query would be more efficient.
- License holders (residents) for the subscription are not available from the `TenantSubscriptions` query — only `licenses.totalCount`. The detail page cannot list individual license holders until the query is extended or a new query is added (e.g. add `licensesList { ...License resident { ...Resident } }` to the `TenantSubscriptions` query or create a `SubscriptionById` query).

## Types
See `_shared.data.md` → TenantSubscription, LicensePack, LicensePackLicenseType, LicenseType, Resident, License, GraphQL Queries, GraphQL Mutations
