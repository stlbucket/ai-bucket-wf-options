---
name: tenant-app-datasets-breweries-index-data
description: Breweries landing page data contract — searchBreweries/breweryMapPoints/brewerySyncStatus queries, useBreweries/useBreweryMapPoints composables, and queueSync via the existing wf machinery.
metadata:
  type: reference
---

# /tenant/datasets/breweries — List/Map Page (Data)

Shared model: `_shared.data.md` (types, functions, mappers). Workflow: `sync-workflow.data.md`.

## Status
Implemented — GraphQL (2026-07-09). Implementation notes: the PostGraphile-inflected input type
is **`SearchBreweriesOptionInput`** (singularized) with arg name **`_options`**, and paging is
**`PagingOptionInput`** `{ itemOffset, pageOffset, itemLimit }`. tenant-app `routeRules` needs
`'/datasets/**': { ssr: false }` (the urql plugin is client-only — house pattern for every data
page). `UPagination` total: exact only when unfiltered (`syncStatus.breweryCount`); under
filters the page computes an optimistic total that keeps the pager open while full pages return.

---

## GraphQL

All in `packages/graphql-client-api/src/graphql/locationDatasets/query/`; hooks generate into
`src/generated/fnb-graphql-api.ts`.

| Operation | Backs | Variables | Notes |
|---|---|---|---|
| `SearchBreweries` | list view | `options: SearchBreweriesOptionInput` (searchText, breweryType, state, country, isGeolocated, pagingOptions) | Calls `location_datasets_api.search_breweries`; selects the full `Brewery` fragment (brewery fields + nested `location`) |
| `BreweryMapPoints` | map view | — | Calls `location_datasets_api.brewery_map_points`; `BreweryMapPoint` fragment only (id, name, breweryType, lat, lon) — keep the payload light, ~11.7k rows |
| `BrewerySyncStatus` | header status + button state | — | Calls `location_datasets_api.brewery_sync_status` |

Sync mutation: **none new** — reuse the existing wf `queueWorkflow` operation/hook exactly as
the workflow dashboard does.

## Composables

### `useBreweries()` — `packages/graphql-client-api/src/composables/useBreweries.ts`
Re-export: `apps/tenant-app/app/composables/useBreweries.ts`.

```ts
{
  breweries: ComputedRef<Brewery[]>          // mapped via toBrewery
  fetching: Ref<boolean>
  error: Ref<CombinedError | undefined>
  options: Ref<SearchBreweriesOptions>       // reactive variables (search/filters/paging)
  syncStatus: ComputedRef<BrewerySyncStatus | null>
  queueSync: () => Promise<void>             // p:app-admin-super; wraps queueWorkflow('sync-breweries')
  refreshSyncStatus: () => void              // executeQuery({ requestPolicy: 'network-only' })
}
```

- `queueSync()` throws on mutation error (page shows error toast); on success calls
  `refreshSyncStatus()`.
- While `syncStatus.inProgress`, the page polls `refreshSyncStatus()` on a modest interval
  (~10s) and once more after the workflow should have finished; stop polling when it flips
  false, then `executeQuery` the list network-only so new rows appear. Keep the polling inside
  the composable so the page stays transport-free (R1).
- Ungeocoded count for the map footer: `syncStatus.breweryCount - points.length` (no extra
  query).

### `useBreweryMapPoints()` — `src/composables/useBreweryMapPoints.ts`
Re-export: `apps/tenant-app/app/composables/useBreweryMapPoints.ts`.

```ts
{
  points: ComputedRef<BreweryMapPoint[]>     // toBreweryMapPoint; lat/lon parsed to numbers
  fetching: Ref<boolean>
  error: Ref<CombinedError | undefined>
  activate: () => void                       // unpauses the query (page calls on first map toggle)
  executeQuery
}
```

- Query is `pause`d until the map view is first activated via `activate()` (don't fetch 11.7k
  rows for users who never leave the list).

## Auth requirements

| Data | Requirement |
|---|---|
| All three queries | signed-in (`p:app-user` or `p:app-admin`) — enforced in `_api` functions (`jwt.enforce_any_permission`) + RLS |
| `queueSync` | `p:app-admin-super` — UI-gated + see `_shared.data.md` Open Question 2 for the API-level gate |

## Response transformation
- `search_breweries` returns a flat setof; mapper nests/passes through `location` fields per
  the `Brewery` fragment shape and converts timestamps to `Date` (R3).
- `brewery_map_points` lat/lon arrive as strings (loc stores text) — mapper parses to `number`
  and the `_api` function already excludes nulls.
