# loc/[id] — Location Detail Data

## Status
Implemented — GraphQL

## Route
`/tenant/loc/[id]` — see `[id].ui.md` for UI details

## Data Model
See `_shared.data.md` — `Location` type and `LocationInfoInput`.

## GraphQL

### Query: AllLocations (filtered client-side for single item)
- **File**: `packages/graphql-client-api/src/graphql/locations/query/allLocations.graphql`
- **Generated hook**: `useAllLocationsQuery` in `packages/graphql-client-api/src/generated/fnb-graphql-api.ts`
- **Variables**: none
- **Returns**: full list; the composable filters by `id` from the route param
- Client-side filtering is used because no `locationById` query is needed — all locations are already tenant-scoped by RLS and the list is small

### Mutation: UpdateLocation
- **File**: `packages/graphql-client-api/src/graphql/locations/mutation/updateLocation.graphql`
- **Generated hook**: `useUpdateLocationMutation` in `packages/graphql-client-api/src/generated/fnb-graphql-api.ts`
- **Variables**: `{ locationInfo: LocationInfoInput }` (must include `id` field — update path)
- **Returns**: `{ updateLocation: { location: Location } }`

### Mutation: DeleteLocation
- **File**: `packages/graphql-client-api/src/graphql/locations/mutation/deleteLocation.graphql`
- **Generated hook**: `useDeleteLocationMutation` in `packages/graphql-client-api/src/generated/fnb-graphql-api.ts`
- **Variables**: `{ locationId: UUID }`
- **Returns**: `{ deleteLocation: { boolean: boolean } }`

## Composable

**Source**: `packages/graphql-client-api/src/composables/useLocations.ts` (same file as `useLocations`)
**Re-export**: `apps/tenant-app/app/composables/useLocations.ts`

```typescript
export function useLocation(id: MaybeRef<string>) {
  const { data, fetching, error, executeQuery } = useAllLocationsQuery()
  const { executeMutation: execUpdate } = useUpdateLocationMutation()
  const { executeMutation: execDelete } = useDeleteLocationMutation()

  function refresh() {
    executeQuery({ requestPolicy: 'network-only' })
  }

  const location = computed(() => {
    const list = data.value?.locations ?? []
    return list.find((l) => l != null && String(l.id) === String(unref(id))) ?? null
  })

  async function updateLocation(fields: Omit<LocationInfoInput, 'id'>) {
    await execUpdate({ locationInfo: { id: unref(id), ...fields } })
    refresh()
  }

  async function deleteLocation() {
    await execDelete({ locationId: unref(id) })
  }

  return { location, fetching, error, updateLocation, deleteLocation }
}
```

Return shape notes:
- `fetching` replaces `pending`
- `location` is `computed` — derives a single item from the list query response
- `deleteLocation()` on the detail page does not call `refresh()` — the page navigates away after deletion
- After `deleteLocation()`, the page calls `navigateTo('/loc')`
- After `updateLocation()`, `refresh()` is called to re-fetch from the server
