# site-admin/tenant/[id] — Tenant Detail Data

## Status
Implemented — GraphQL

## Route
`/tenant/site-admin/tenant/[id]` — see `[id].ui.md` for UI details

## GraphQL

### Query: `AppTenantById`
- File: `packages/graphql-client-api/src/graphql/app/query/appTenantById.graphql`
- Generated hook: `useTenantByIdQuery()` in `src/generated/fnb-graphql-api.ts`
- Variable: `$tenantId: UUID!`
- Fetches: tenant with resident count and subscription list (with license totals)
- Returns null (not 404) if tenant not found — composable handles gracefully

### Mutations (all GraphQL — tenant-app has no `server/`)

| Operation | GraphQL | Generated hook |
|---|---|---|
| Activate tenant | `ActivateAppTenant($tenantId)` | `useActivateTenantMutation()` |
| Deactivate tenant | `DeactivateAppTenant($tenantId)` | `useDeactivateTenantMutation()` |
| Update tenant name/identifier/type | `UpdateTenant` | `useUpdateTenantMutation()` |
| Enter support mode | `BecomeSupport` | `useBecomeSupportMutation()` (via `useBecomeSupport()`) |

`BecomeSupport` is a pure GraphQL mutation followed by `useAuth().refreshClaims()` — see
`_shared.data.md` → Support Mode Flow (GraphQL).

## Composable

**Source:** `packages/graphql-client-api/src/composables/useSiteAdminTenants.ts` (`useSiteAdminTenant`)
**Re-export:** `apps/tenant-app/app/composables/useSiteAdminTenants.ts`

| Export | Return shape | Usage |
|---|---|---|
| `useSiteAdminTenant(id)` | `{ tenant: Ref<Tenant \| null>, fetching, error, executeQuery }` | called in [id].vue setup |
| `activateTenant(id)` | `useActivateTenantMutation` | activate handler |
| `deactivateTenant(id)` | `useDeactivateTenantMutation` | deactivate handler |
| `updateTenant(id, values)` | `useUpdateTenantMutation` | save handler |

## Types
See `_shared.data.md` → Tenant, GraphQL Operations, Support Mode Flow (GraphQL).
