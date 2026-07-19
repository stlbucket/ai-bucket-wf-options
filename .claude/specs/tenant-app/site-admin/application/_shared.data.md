# site-admin/application — Shared Data

## Status
Implemented — GraphQL

## Permission Gate
`p:app-admin-super` — required on all pages in this module.

## GraphQL Client Setup

All data in this module is fetched via urql (GraphQL), not REST.

**urql plugin:** `apps/tenant-app/app/plugins/urql.client.ts`
- Client points at `runtimeConfig.public.graphqlApiUrl` (default: `http://localhost:4000/graphql-api/api/graphql`)
- Exchanges: `cacheExchange`, `mapExchange` (error logging), `fetchExchange`
- `preferGetMethod: false` — all operations use POST; provides `$urqlClient`

**Composable source package:** `packages/graphql-client-api`
- GraphQL operation files: `src/graphql/app/query/*.graphql`
- Generated urql hooks: `src/generated/fnb-graphql-api.ts` (auto-generated — do not edit)
- Composable wrappers: `src/composables/useSiteAdminApplication*.ts`
- Barrel: `src/index.ts` exports all wrappers

**Tenant-app re-export:** `apps/tenant-app/app/composables/useSiteAdminApplications.ts`
Re-exports both composables from the package so Nuxt auto-import picks them up.

## Types (from PostGraphile schema)

```typescript
// Application — app.application table
type Application = {
  key: string
  name: string
}

// Module — app.module table
type Module = {
  key: string
  name: string
  ordinal: number
  tools: Tool[]
}

// Tool — app.tool table
type Tool = {
  key: string
  name: string
  route: string
  moduleKey: string
  permissionKeys: (string | null)[]
}

// LicenseType — as returned by the detail composable
type LicenseTypeDetail = {
  key: string
  displayName: string
  assignmentScope: LicenseTypeAssignmentScope
  permissions: string[]  // mapped from LicenseTypePermission.permissionKey
}

// ApplicationDetail — shape returned by useSiteAdminApplication().data
type ApplicationDetail = {
  application: Application
  modules: Module[]           // ordered by ordinal
  tools: Tool[]               // flat list, flattened from modules[].tools
  licenseTypes: LicenseTypeDetail[]
}
```

All types originate from `packages/graphql-client-api/src/generated/fnb-graphql-api.ts`
(auto-generated from the PostGraphile schema). Do not re-declare them locally.
