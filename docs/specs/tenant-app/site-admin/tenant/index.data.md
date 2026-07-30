# site-admin/tenant/index — Tenant List Data

## Status
Implemented — GraphQL (CreateTenant wiring built 2026-07-27; manual e2e verification pending)

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

### Mutation: `CreateTenant`
- File: `packages/graphql-client-api/src/graphql/app/mutation/createAppTenant.graphql` (pre-existing,
  unused until the New Tenant modal — its first consumer)
- Generated hook: `useCreateTenantMutation()` in `src/generated/fnb-graphql-api.ts`
- Variables: `$name: String!`, `$email: String!` → `createTenant(input: { _name, _email })`,
  returns `tenant { ...Tenant }`
- Backing function: `app_api.create_tenant(_name, _identifier = null, _email = null, _type = 'customer')`
  → `app_fn.create_tenant` (`db/fnb-app/deploy/00000000010240_app_fn.sql`). The GraphQL doc
  deliberately passes only name + email — identifier stays `null`, type defaults to `'customer'`
  (locked decision).
- What the DB does: uniqueness check on root-tenant name/identifier (raises `30002` on conflict),
  inserts `app.tenant`, registers the URN resource (`res_fn.register_resource`), subscribes every
  `auto_subscribe = true` license pack, and invites `_email` as tenant **admin**
  (`app_fn.invite_user(..., 'admin')` — creates the `app.resident` row, so email is effectively
  **required** even though the SQL parameter is nullable).
- Auth: no `jwt.enforce_permission` call in `app_api.create_tenant` — enforcement is the RLS
  `manage_tenant` policy on `app.tenant` (`p:app-admin-super`). See Known Gaps.

## Composable

**Source:** `packages/graphql-client-api/src/composables/useSiteAdminTenants.ts`
**Re-export:** `apps/tenant-app/app/composables/useSiteAdminTenants.ts`

| Export | Return shape | Usage |
|---|---|---|
| `useSiteAdminTenants()` | `{ tenants: Ref<TenantSummary[]>, fetching, error }` (from `useSearchTenantsQuery`) | called in index.vue setup |
| `useBecomeSupport()` | `{ becomeSupportForTenant(id) }` (runs `useBecomeSupportMutation`) | support button handler |
| `useCreateTenant()` | `{ createTenant(name, email): Promise<Tenant> }` — runs `useCreateTenantMutation`, throws on `res.error`, returns the mapped `Tenant` (page needs `id` for navigation) | New Tenant modal Create handler |

`useCreateTenant` lives in the same `useSiteAdminTenants.ts` source file (and its existing
tenant-app re-export). After a successful create the page navigates to the detail route —
no list re-fetch needed on this page (`SearchTenants` re-runs naturally on return).

## Types
See `_shared.data.md` → Tenant, GraphQL Operations, Support Mode Flow (GraphQL).

## Known Gaps
- `app_api.create_tenant` is the only site-admin mutation without an explicit
  `jwt.enforce_permission` gate — it relies solely on the RLS `manage_tenant` policy
  (`p:app-admin-super`, `db/fnb-app/deploy/00000000010250_app_policies.sql`). Effective
  enforcement is equivalent, but it diverges from the `app_api.*` convention documented in
  `_shared.data.md`. No DB change is in scope for the New Tenant modal (it calls existing
  infrastructure as-is).
