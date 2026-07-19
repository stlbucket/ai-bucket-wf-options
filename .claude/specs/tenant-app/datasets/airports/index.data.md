---
name: tenant-app-datasets-airports-index-data
description: Airports landing page data contract — searchAirports/airportMapPoints/airportSyncStatus queries, useAirports/useAirportMapPoints composables, and queueSync via the existing wf machinery.
metadata:
  type: reference
---

# /tenant/datasets/airports — List/Map Page (Data)

Shared model: `_shared.data.md` (types, functions, mappers). Workflow:
`sync-workflow.data.md`. Breweries precedent:
`.claude/specs/tenant-app/datasets/breweries/index.data.md`.

## Status
Implemented — GraphQL (2026-07-10). The predicted breweries inflections recurred exactly:
input type `SearchAirportsOptionInput` (singularized), arg name `_options`, paging
`PagingOptionInput { itemOffset, pageOffset, itemLimit }` — all verified in GraphiQL before
the documents were written. tenant-app `routeRules` `'/datasets/**': { ssr: false }` already
covered these pages (no change needed). The unfiltered `UPagination` total comes from
`syncStatus.airportCount` (85,716); under filters the page uses the breweries optimistic-total
pattern.

---

## GraphQL

All in `packages/graphql-client-api/src/graphql/airports/query/`; hooks generate into
`src/generated/fnb-graphql-api.ts`.

| Operation | Backs | Variables | Notes |
|---|---|---|---|
| `SearchAirports` | list view | `options: SearchAirportsOptionInput` (searchText, airportType, continent, isoCountry, isoRegion, scheduledService, pagingOptions) | Calls `airports_api.search_airports`; selects the full `Airport` fragment (airport fields + nested `location`) |
| `AirportMapPoints` | map view | `options: AirportMapPointOptionInput` (includeClosed) | Calls `airports_api.airport_map_points`; `AirportMapPoint` fragment only (id, ident, name, type, iataCode, lat, lon) — ~72k rows, keep the payload minimal |
| `AirportSyncStatus` | header status + button state | — | Calls `airports_api.airport_sync_status` |

Sync mutation: **none new** — reuse the existing wf `queueWorkflow` operation/hook exactly as
breweries does.

## Composables

### `useAirports()` — `packages/graphql-client-api/src/composables/useAirports.ts`
Re-export: `apps/tenant-app/app/composables/useAirports.ts`.

```ts
{
  airports: ComputedRef<Airport[]>           // mapped via toAirport
  fetching: Ref<boolean>
  error: Ref<CombinedError | undefined>
  options: Ref<SearchAirportsOptions>        // reactive variables (search/filters/paging)
  syncStatus: ComputedRef<AirportSyncStatus | null>
  queueSync: () => Promise<void>             // p:app-admin-super; wraps queueWorkflow('sync-airports')
  refreshSyncStatus: () => void              // executeQuery({ requestPolicy: 'network-only' })
}
```

- `queueSync()` throws on mutation error (page shows error toast); on success calls
  `refreshSyncStatus()`.
- While `syncStatus.inProgress`, poll `refreshSyncStatus()` (~10s) inside the composable
  (R1 — page stays transport-free); when it flips false, `executeQuery` the list network-only
  so new rows appear. Note the airports sync runs longer than breweries (several minutes) —
  same polling machinery, just more iterations.
- `UPagination` total: exact only when unfiltered (`syncStatus.airportCount`); under filters
  use the breweries optimistic-total pattern (keep the pager open while full pages return).

### `useAirportMapPoints()` — `src/composables/useAirportMapPoints.ts`
Re-export: `apps/tenant-app/app/composables/useAirportMapPoints.ts`.

```ts
{
  points: ComputedRef<AirportMapPoint[]>     // toAirportMapPoint; lat/lon parsed to numbers
  fetching: Ref<boolean>
  error: Ref<CombinedError | undefined>
  includeClosed: Ref<boolean>                // reactive variable; default false
  activate: () => void                       // unpauses the query (page calls on first map toggle)
  executeQuery
}
```

- Query is `pause`d until the map view is first activated via `activate()` — never fetch ~72k
  rows for users who stay on the list.

## Auth requirements

| Data | Requirement |
|---|---|
| All three queries | signed-in (`p:app-user` or `p:app-admin`) — enforced in `_api` functions (`jwt.enforce_any_permission`) + RLS |
| `queueSync` | `p:app-admin-super` — UI-gated (API-level wf gate deferred to issue 0030) |

## Response transformation

- `search_airports` returns a flat setof; `toAirport` nests `location` per the fragment shape,
  converts timestamps to `Date`, and passes enum values through verbatim (R3, UPPERCASE).
- `airport_map_points` lat/lon arrive as strings (loc stores text) — `toAirportMapPoint`
  parses to `number`; the `_api` function never returns null coordinates (airports are 100%
  geocoded, and the function selects from the location join).
