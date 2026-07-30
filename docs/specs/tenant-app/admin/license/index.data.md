# admin/license/index — License List Data

## Status
Implemented — GraphQL

## Route
`/tenant/admin/license` — see `index.ui.md` for UI details

## GraphQL

### Query on load
- **Query name**: `TenantLicenses`
- **File**: `packages/graphql-client-api/src/graphql/app/query/appTenantLicenses.graphql`
- **Generated hook**: `useTenantLicensesQuery()` (no variables)
- **Returns**: `tenantLicenses[]` — array of `License` fragment objects, each with a nested `resident { ...Resident }` (already the right shape — no separate resident batch fetch needed)
- **Auth**: RLS enforces tenant scoping via claims

### Mutations

Activate/deactivate individual license status is not yet exposed in the PostGraphile schema. See Known Gaps in `_shared.data.md`.

| Mutation | Status |
|---|---|
| Activate license | **Not available** — `updateLicenseStatus` not in PostGraphile schema |
| Deactivate license | **Not available** — `updateLicenseStatus` not in PostGraphile schema |

Grant and revoke are handled on the user detail page, not here.

## Composable

**Source**: `packages/graphql-client-api/src/composables/useAdminLicenses.ts`
**Re-export**: `apps/tenant-app/app/composables/useAdminLicenses.ts`

```ts
// re-export file (single line)
export { useAdminLicenses } from '@function-bucket/fnb-graphql-client-api'
```

| Export | Shape | Usage |
|---|---|---|
| `useAdminLicenses()` | `{ data: ComputedRef<LicenseWithResident[] \| null>, fetching: Ref<boolean>, error: Ref }` | called in index.vue on mount |

`data` is computed from `useTenantLicensesQuery().data.value?.tenantLicenses`. The GraphQL response nests the resident directly on each license, replacing the former `LicenseListResponse` composite type.

```ts
type LicenseWithResident = License & { resident: Resident | null }
```

Activate/deactivate buttons should be hidden or disabled until the PostGraphile mutation is available.

## Known Gaps
- Activate/deactivate license status mutations are not in the PostGraphile schema. UI actions for these are non-functional until `updateLicenseStatus` is exposed.

## Types
See `_shared.data.md` → License, Resident, GraphQL Queries
