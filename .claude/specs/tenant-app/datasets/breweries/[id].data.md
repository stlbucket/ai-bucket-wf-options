---
name: tenant-app-datasets-breweries-id-data
description: Brewery detail page data contract — single Brewery query by id via the PostGraphile root field and the useBrewery composable.
metadata:
  type: reference
---

# /tenant/datasets/breweries/[id] — Detail Page (Data)

Shared model: `_shared.data.md`.

## Status
Implemented — GraphQL (2026-07-09).

---

## GraphQL

| Operation | File | Variables | Notes |
|---|---|---|---|
| `Brewery` | `packages/graphql-client-api/src/graphql/locationDatasets/query/brewery.graphql` | `id: UUID!` | PostGraphile root field for `location_datasets.brewery` by pk (RLS `view_all` exposes it); selects the full `Brewery` fragment incl. nested `location` fields |

Generated hook: `useBreweryQuery` in `src/generated/fnb-graphql-api.ts`.

## Composable

### `useBrewery(id)` — `packages/graphql-client-api/src/composables/useBrewery.ts`
Re-export: `apps/tenant-app/app/composables/useBrewery.ts`.

```ts
{
  brewery: ComputedRef<Brewery | null>   // toBrewery mapper; null while loading / when not found
  fetching: Ref<boolean>
  error: Ref<CombinedError | undefined>
}
```

- `id` comes from `useRoute().params.id` in the page and is passed in — the composable does not
  read the route.
- Not-found: query returns null data with no error → page renders the not-found `UAlert`.

## Auth requirements
Signed-in (`p:app-user` or `p:app-admin`) — RLS read policy; no mutations exist for this page.

## Response transformation
`toBrewery`: timestamps → `Date`; `breweryType` passes through verbatim (UPPERCASE enum);
`location.lat`/`lon` stay strings on the `Location` type — the page parses to numbers only for
the mini-map center.
