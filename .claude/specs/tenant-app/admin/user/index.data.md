# admin/user/index — User List Data

## Status
Implemented — GraphQL

## Route
`/tenant/admin/user` — see `index.ui.md` for UI details

## GraphQL

### Query on load
- **Query name**: `TenantResidents`
- **File**: `packages/graphql-client-api/src/graphql/app/query/appTenantResidents.graphql`
- **Generated hook**: `useTenantResidentsQuery()` (no variables)
- **Returns**: `residents[]` — array of `Resident` fragment objects (id, profileId, tenantId, tenantName, status, type, displayName, email)
- **Auth**: RLS enforces tenant scoping; claims set via urql plugin headers

### Mutations
None on this page. Block/unblock actions are on the user detail page.

## Composable

**Source**: `packages/graphql-client-api/src/composables/useAdminResidents.ts`
**Re-export**: `apps/tenant-app/app/composables/useAdminResidents.ts`

```ts
// re-export file (single line)
export { useAdminResidents } from '@function-bucket/fnb-graphql-client-api'
```

| Export | Shape | Usage |
|---|---|---|
| `useAdminResidents()` | `{ data: ComputedRef<Resident[] \| null>, fetching: Ref<boolean>, error: Ref }` | called in index.vue on mount |

`data` is computed from `useTenantResidentsQuery().data.value?.residents`. Returns `null` until loaded.

## Types
See `_shared.data.md` → Resident, GraphQL Queries
