# site-admin/user/index — User List Data

## Status
Implemented — GraphQL (search + pagination, 2026-07-27 — see `README.md`).

## Route
`/tenant/site-admin/user` — see `index.ui.md` for UI details

## GraphQL

### Query: `SearchProfiles` — NEW (replaces `AllAppProfiles` as this page's source)
- File: `packages/graphql-client-api/src/graphql/app/query/searchProfiles.graphql`
- Generated hook: `useSearchProfilesQuery({ variables })` in `src/generated/fnb-graphql-api.ts`
- Variables: `{ searchTerm: String, limit: Int, offset: Int }`
- Shape:
  ```graphql
  query SearchProfiles($searchTerm: String, $limit: Int, $offset: Int) {
    searchProfilesList(
      _options: {
        searchTerm: $searchTerm
        pagingOptions: { itemLimit: $limit, itemOffset: $offset }
      }
    ) {
      ...Profile
    }
    searchProfilesCount(_options: { searchTerm: $searchTerm })
  }
  ```
  (Confirm codegen field names after rebuild — if PostGraphile exposes only the connection form,
  mirror `SearchTenants`: `searchProfiles(_options: …) { nodes { ...Profile } }`.)
- Backed by: `app_api.search_profiles` / `app_api.search_profiles_count`
  (`db/fnb-app/deploy/00000000010243_app_fn_support.sql`) — both `p:app-admin-support`-guarded,
  `SECURITY DEFINER` bodies; predicate = citext `like` over email / display_name / full_name /
  identifier, ordered `display_name nulls last, email`; limit default 25, offset default 0
- `AllAppProfiles` (`allAppProfiles.graphql`) is retired from this page — delete the op if no
  other consumer remains.

## Composable

**Source:** `packages/graphql-client-api/src/composables/useSiteAdminUsers.ts` (rewrite of the
existing `useSiteAdminUsers`)
**Re-export:** `apps/tenant-app/app/composables/useSiteAdminUsers.ts` (unchanged single line)

| Export | Return shape | Usage |
|---|---|---|
| `useSiteAdminUsers(opts)` | `{ users: ComputedRef<Profile[]>, totalCount: ComputedRef<number>, pageCount: ComputedRef<number>, fetching, error }` | called in index.vue setup |

`opts = { searchTerm: Ref<string>, page: Ref<number>, pageSize?: number /* default 25 */ }`.
The query variables are a `computed` over the refs (`limit = pageSize`,
`offset = (page - 1) * pageSize`; empty `searchTerm` → `null`), so urql re-executes reactively —
no manual `executeQuery` needed. `users` maps nodes through `toProfile` (existing mapper);
`pageCount = ceil(totalCount / pageSize)`. Debouncing the raw input into `searchTerm` is the
page's job (see `index.ui.md`).

## Types
See `../_shared.data.md` → Profile, GraphQL Client Setup
