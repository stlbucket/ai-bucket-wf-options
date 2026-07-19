# site-admin/tenant/index — Tenant List Data

## Status
Implemented — GraphQL

## Route
`/tenant/site-admin/tenant` — see `index.ui.md` for UI details

## GraphQL

### Query: `SearchTenants`
- File: `packages/graphql-client-api/src/graphql/app/query/searchTenants.graphql`
- Generated hook: `useSearchTenantsQuery()` in `src/generated/fnb-graphql-api.ts`
- Variable: `$searchTerm: String` — pass `null` / empty string to fetch all tenants
- Fetches: all tenants with their subscriptions and license packs

### Mutation: BecomeSupport (pure GraphQL)
- File: `packages/graphql-client-api/src/graphql/app/mutation/becomeSupport.graphql`
- Generated hook: `useBecomeSupportMutation()`; composable `useBecomeSupport().becomeSupportForTenant(tenantId)`
- After the mutation, the client calls `useAuth().refreshClaims()` (re-fetches claims via GraphQL
  into localStorage) and navigates to `/admin`. There is no Nitro route (tenant-app has no `server/`).

## Composable

**Source:** `packages/graphql-client-api/src/composables/useSiteAdminTenants.ts`
**Re-export:** `apps/tenant-app/app/composables/useSiteAdminTenants.ts`

| Export | Return shape | Usage |
|---|---|---|
| `useSiteAdminTenants()` | `{ tenants: Ref<TenantSummary[]>, fetching, error }` (from `useSearchTenantsQuery`) | called in index.vue setup |
| `useBecomeSupport()` | `{ becomeSupportForTenant(id) }` (runs `useBecomeSupportMutation`) | support button handler |

## Types
See `_shared.data.md` → Tenant, GraphQL Operations, Support Mode Flow (GraphQL).
