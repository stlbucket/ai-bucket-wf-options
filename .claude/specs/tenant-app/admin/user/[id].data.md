# admin/user/[id] — User Detail Data

## Status
Implemented — GraphQL

## Route
`/tenant/admin/user/[id]` — see `[id].ui.md` for UI details

## GraphQL

### Query on load
- **Query name**: `ResidentById`
- **File**: `packages/graphql-client-api/src/graphql/app/query/residentById.graphql`
- **Generated hook**: `useResidentByIdQuery({ variables: { residentId: id } })`
- **Variables**: `{ residentId: UUID! }`
- **Returns**: `resident` — `Resident` fragment + `licenses: licensesList { ...License }`
- **Auth**: RLS enforces tenant scoping; returns null if resident does not belong to calling tenant

Subscription pack context (needed to populate grant-license options) is sourced from a parallel `useTenantSubscriptionsQuery` call and joined client-side in the composable. See Known Gaps in `_shared.data.md`.

### Mutations

| Mutation | Generated hook | Variables | Trigger |
|---|---|---|---|
| `BlockResident` | `useBlockResidentMutation()` | `{ residentId }` | block button |
| `UnblockResident` | `useUnblockResidentMutation()` | `{ residentId }` | unblock button |
| `GrantUserLicense` | `useGrantUserLicenseMutation()` | `{ residentId, licenseTypeKey }` | grant dialog confirm |
| `RevokeUserLicense` | `useRevokeUserLicenseMutation()` | `{ licenseId }` | revoke button |

After each mutation the composable calls `executeQuery({ requestPolicy: 'network-only' })` to re-fetch the resident.

## Composable

**Source**: `packages/graphql-client-api/src/composables/useAdminResidents.ts`
**Re-export**: `apps/tenant-app/app/composables/useAdminResidents.ts`

```ts
// re-export file (single line)
export { useAdminResidents, useAdminResident } from '@function-bucket/fnb-graphql-client-api'
```

| Export | Shape | Usage |
|---|---|---|
| `useAdminResident(id: string)` | `{ data, fetching, error, blockResident, unblockResident, grantResidentLicense, revokeResidentLicense }` | called in [id].vue on mount |

`data` is a `ComputedRef` that merges the `ResidentById` result with subscription pack data from `TenantSubscriptions`, producing a shape equivalent to the former `ResidentDetail`:
```ts
{
  resident: Resident
  licenses: License[]
  subscriptionPacks: SubscriptionPack[]  // joined client-side from TenantSubscriptions
}
```

Mutation functions return `Promise<void>` and trigger a re-fetch on success.

## Types
See `_shared.data.md` → Resident, License, LicensePack, LicensePackLicenseType, LicenseType, GraphQL Queries, GraphQL Mutations
