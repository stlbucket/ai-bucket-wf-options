---
name: tenant-app-datasets-airports-id-data
description: Airport detail page data contract — single Airport query by id with runway/frequency/navaid child relations and the useAirport composable.
metadata:
  type: reference
---

# /tenant/datasets/airports/[id] — Detail Page (Data)

Shared model: `_shared.data.md`.

## Status
Implemented — GraphQL (2026-07-10). Actual inflected child-relation fields (GraphiQL-verified):
`runwaysList`, `airportFrequenciesList`, `navaidsByAssociatedAirportIdList` —
PgSimplifyInflection drops the `ByAirportId` suffix on the unambiguous FK relations. Ordering
uses the generated orderBy enums: `LE_IDENT_ASC`, `[TYPE_ASC, FREQUENCY_MHZ_ASC]`, `IDENT_ASC`.

---

## GraphQL

| Operation | File | Variables | Notes |
|---|---|---|---|
| `Airport` | `packages/graphql-client-api/src/graphql/airports/query/airport.graphql` | `id: UUID!` | PostGraphile root field for `airports.airport` by pk (RLS `view_all` exposes it); selects the full `Airport` fragment incl. nested `location`, plus the child relation list fields `runwaysList` / `airportFrequenciesList` / `navaidsByAssociatedAirportIdList` (GraphiQL-verified — `_shared.data.md` Open Question 2) with the `Runway` / `AirportFrequency` / `Navaid` fragments |

Generated hook: `useAirportQuery` in `src/generated/fnb-graphql-api.ts`.

Child-list ordering (in the query): runways by `leIdent`, frequencies by `type` then
`frequencyMhz`, navaids by `ident`. Volumes per airport are tiny (a handful each) — no paging.

## Composable

### `useAirport(id)` — `packages/graphql-client-api/src/composables/useAirport.ts`
Re-export: `apps/tenant-app/app/composables/useAirport.ts`.

```ts
{
  airport: ComputedRef<Airport | null>            // toAirport; null while loading / not found
  runways: ComputedRef<Runway[]>                  // toRunway
  frequencies: ComputedRef<AirportFrequency[]>    // toAirportFrequency
  navaids: ComputedRef<Navaid[]>                  // toNavaid
  fetching: Ref<boolean>
  error: Ref<CombinedError | undefined>
}
```

- `id` comes from `useRoute().params.id` in the page and is passed in — the composable does
  not read the route.
- Child lists are exposed as separate computeds (not nested on `Airport`) so the fnb-types
  `Airport` entity stays flat; all four map from the single query's response.
- Not-found: query returns null data with no error → page renders the not-found `UAlert`.

## Auth requirements
Signed-in (`p:app-user` or `p:app-admin`) — RLS read policies; no mutations exist for this
page.

## Response transformation
`toAirport`: timestamps → `Date`; enum values pass through verbatim (UPPERCASE, R3);
`location.lat`/`lon` stay strings on the `Location` type — the page parses to numbers only for
the mini-map center. `toRunway`/`toAirportFrequency`/`toNavaid`: numeric-ish fields arrive as
numbers-or-null from PostGraphile (int/numeric columns) — pass through; no string parsing
needed here.
