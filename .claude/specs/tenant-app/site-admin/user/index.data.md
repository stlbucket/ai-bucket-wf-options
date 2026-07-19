# site-admin/user/index — User List Data

## Status
Implemented — GraphQL

## Route
`/tenant/site-admin/user` — see `index.ui.md` for UI details

## GraphQL

### Query: `AllAppProfiles`
- File: `packages/graphql-client-api/src/graphql/app/query/allAppProfiles.graphql`
- Generated hook: `useAllAppProfilesQuery()` in `src/generated/fnb-graphql-api.ts`
- No variables
- Fetches: all profiles with their residents (including licenses per resident)

## Composable

**Source:** `packages/graphql-client-api/src/composables/useSiteAdminUsers.ts` *(to be created)*
**Re-export:** `apps/tenant-app/app/composables/useSiteAdminUsers.ts`

| Export | Return shape | Usage |
|---|---|---|
| `useSiteAdminUsers()` | `{ data: Ref<Profile[] \| null>, fetching, error }` | called in index.vue setup |

## Types
See `_shared.data.md` → Profile, GraphQL Client Setup
