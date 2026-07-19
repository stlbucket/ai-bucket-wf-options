# loc/index — Location List Data

## Status
Implemented — GraphQL

## Route
`/tenant/loc` — see `index.ui.md` for UI details

## Data Model
See `_shared.data.md` — `Location` type and `LocationInfoInput`.

## GraphQL

### Query: AllLocations
- **File**: `packages/graphql-client-api/src/graphql/locations/query/allLocations.graphql`
- **Generated hook**: `useAllLocationsQuery` in `packages/graphql-client-api/src/generated/fnb-graphql-api.ts`
- **Variables**: none
- **Returns**: `{ locations: Location[] }` — all locations for the current tenant (RLS enforces tenant scope)

```graphql
query AllLocations {
  locations: locationsList {
    ...Location
  }
}
```

### Mutation: CreateLocation
- **File**: `packages/graphql-client-api/src/graphql/locations/mutation/createLocation.graphql`
- **Generated hook**: `useCreateLocationMutation` in `packages/graphql-client-api/src/generated/fnb-graphql-api.ts`
- **Variables**: `{ locationInfo: LocationInfoInput }` (no `id` field — create path)
- **Returns**: `{ createLocation: { location: Location } }`

### Mutation: DeleteLocation
- **File**: `packages/graphql-client-api/src/graphql/locations/mutation/deleteLocation.graphql`
- **Generated hook**: `useDeleteLocationMutation` in `packages/graphql-client-api/src/generated/fnb-graphql-api.ts`
- **Variables**: `{ locationId: UUID }`
- **Returns**: `{ deleteLocation: { boolean: boolean } }`

## Composable

**Source**: `packages/graphql-client-api/src/composables/useLocations.ts`
**Re-export**: `apps/tenant-app/app/composables/useLocations.ts`

```typescript
export function useLocations() {
  const { data, fetching, error, executeQuery } = useAllLocationsQuery()
  const { executeMutation: execCreate } = useCreateLocationMutation()
  const { executeMutation: execDelete } = useDeleteLocationMutation()

  function refresh() {
    executeQuery({ requestPolicy: 'network-only' })
  }

  const locations = computed(() => {
    return (data.value?.locations ?? []).filter(
      (l): l is NonNullable<typeof l> => l != null
    )
  })

  async function createLocation(locationInfo: Omit<LocationInfoInput, 'id'>) {
    await execCreate({ locationInfo })
    refresh()
  }

  async function deleteLocation(locationId: string) {
    await execDelete({ locationId })
    refresh()
  }

  return { locations, fetching, error, createLocation, deleteLocation }
}
```

Return shape notes:
- `fetching` replaces `pending` (urql naming)
- `refresh()` uses `executeQuery({ requestPolicy: 'network-only' })` instead of Nuxt's `refresh()`
- `locations` is `computed(() => ...)` — reactive, auto-updates when cache changes

## Out of Scope
- Map/geography display (lat/lon shown as plain text)
- Search / filter
- Pagination
