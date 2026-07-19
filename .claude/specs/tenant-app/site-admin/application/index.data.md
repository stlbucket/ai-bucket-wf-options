# site-admin/application/index — Application List Data

## Status
Implemented — GraphQL

## Route
`/tenant/site-admin/application` — see `index.ui.md` for UI details

## GraphQL

### Query: `AllApplications`
- File: `packages/graphql-client-api/src/graphql/app/query/allApplications.graphql`
- Generated hook: `useAllApplicationsQuery()` in `src/generated/fnb-graphql-api.ts`
- Fetches: all applications with their license types, permissions, and license counts
- No variables

## Composable

**Source:** `packages/graphql-client-api/src/composables/useSiteAdminApplications.ts`
**Re-export:** `apps/tenant-app/app/composables/useSiteAdminApplications.ts`

| Export | Return shape | Usage |
|---|---|---|
| `useSiteAdminApplications()` | `{ data: Ref<Application[] \| null>, fetching: Ref<boolean>, error }` | called in `index.vue` setup |

`data` is a computed ref extracting `AllApplicationsQuery.applications` from the raw urql response.

## Types
See `_shared.data.md` → Application
