# site-admin/application/[key] — Application Detail Data

## Status
Implemented — GraphQL

## Route
`/tenant/site-admin/application/[key]` — see `[key].ui.md` for UI details

## GraphQL

### Query: `ApplicationByKey`
- File: `packages/graphql-client-api/src/graphql/app/query/applicationByKey.graphql`
- Generated hook: `useApplicationByKeyQuery({ variables: { key } })` in `src/generated/fnb-graphql-api.ts`
- Variable: `$key: String!`
- Fetches in a single request:
  - Application (key, name)
  - License types with nested permissions
  - Modules with nested tools

No mutations — this page is read-only.

## Composable

**Source:** `packages/graphql-client-api/src/composables/useSiteAdminApplication.ts`
**Re-export:** `apps/tenant-app/app/composables/useSiteAdminApplications.ts`

| Export | Return shape | Usage |
|---|---|---|
| `useSiteAdminApplication(key)` | `{ data: Ref<ApplicationDetail \| null>, fetching: Ref<boolean>, error }` | called in `[key].vue` setup |

**Composable transformations applied before returning `data`:**
- `tools` — flattened from `modules[].tools` into a single array (preserving `moduleKey` for grouping in template)
- `licenseTypes[].permissions` — mapped from `{ licenseTypeKey, permissionKey }[]` to `string[]` of permission keys only

## Types
See `_shared.data.md` → ApplicationDetail, Application, Module, Tool, LicenseTypeDetail
