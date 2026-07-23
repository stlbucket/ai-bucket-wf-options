# admin/user/index — User List Data

## Status
Implemented — GraphQL (list + **Manage Residents**, workspace-only, 2026-07-22). Full DB/GraphQL/
composable contract in `_shared.data.md`.

## Route
`/tenant/admin/user` — see `index.ui.md` for UI details

## GraphQL

### Query on load
- **Query name**: `TenantResidents`
- **File**: `packages/graphql-client-api/src/graphql/app/query/appTenantResidents.graphql`
- **Generated hook**: `useTenantResidentsQuery()` (no variables)
- **Returns**: `residents[]` — array of `Resident` fragment objects (id, profileId, tenantId, tenantName, status, type, displayName, email)
- **Auth**: RLS enforces tenant scoping; claims set via urql plugin headers

### Mutations
None on this page. Block/unblock actions are on the user detail page.

## Composable

**Source**: `packages/graphql-client-api/src/composables/useAdminResidents.ts`
**Re-export**: `apps/tenant-app/app/composables/useAdminResidents.ts`

```ts
// re-export file (single line)
export { useAdminResidents } from '@function-bucket/fnb-graphql-client-api'
```

| Export | Shape | Usage |
|---|---|---|
| `useAdminResidents()` | `{ data: ComputedRef<Resident[] \| null>, fetching: Ref<boolean>, error: Ref }` | called in index.vue on mount |

`data` is computed from `useTenantResidentsQuery().data.value?.residents`. Returns `null` until loaded.
**Change:** also expose `executeQuery` (currently unreturned) so the page can refresh the list
after `WorkspaceResidentsModal` emits `changed`.

## NEW — Manage Residents (workspace tenants only)

Full contract in `_shared.data.md`. Summary:

### GraphQL
- **Query** `WorkspaceResidentPool` → `workspaceResidentPoolList { profileId email displayName
  fullName homeTenantName workspaceResidentId isMember }` (no variables) — `app_api.workspace_resident_pool`,
  `p:app-admin`, returns the whole-tree candidate pool with per-person `isMember`.
- **Mutation** `SetWorkspaceMembership` → `setWorkspaceMembership(input: { profileId, member }) {
  resident { ...Resident } }` — `app_api.set_workspace_membership`, `p:app-admin`. `member=true`
  adds (guest + `app-user` license, dormant); `member=false` soft-removes (`status='removed'`).

### Composable
- **Source** `packages/graphql-client-api/src/composables/useWorkspaceResidents.ts`;
  **re-export** `apps/tenant-app/app/composables/useWorkspaceResidents.ts`.
- `useWorkspaceResidents()` → `{ candidates, fetching, error, executeQuery, setMembership }`.
  `setMembership(profileId, member)` runs the mutation and re-queries the pool network-only.

### Page wiring
`index.vue` renders `WorkspaceResidentsModal` when `canInvite && claims.tenantType === 'WORKSPACE'`
and, on its `changed` emit, calls `useAdminResidents().executeQuery({ requestPolicy: 'network-only' })`
to refresh the visible resident list.

## Types
See `_shared.data.md` → Resident, GraphQL Queries, and the Manage-Residents contract
(`WorkspaceResidentCandidate` view type, `ProfileClaims.tenantType`).
