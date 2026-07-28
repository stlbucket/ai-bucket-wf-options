# admin/user/index — User List Data

## Status
Implemented — GraphQL (list + **Manage Residents**, 2026-07-22; **subtree roll-up 2026-07-27**).
Full roll-up contract in `_shared.data.md` → "Subtree Roll-up".

## Route
`/tenant/admin/user` — see `index.ui.md` for UI details

## GraphQL

### Query on load — CHANGED (roll-up)
- **Query name**: `TenantSubtreeResidents` (replaces `TenantResidents` as the page's list source)
- **File**: `packages/graphql-client-api/src/graphql/app/query/tenantSubtreeResidents.graphql`
- **Generated hook**: `useTenantSubtreeResidentsQuery()` (no variables)
- **Returns**: `tenantSubtreeResidentsList[]` — one row per residency across the current tenant +
  all descendant tenants (`app_api.tenant_subtree_residents`, `p:app-admin`, DEFINER; no
  `support`/`removed` rows)
- The old `TenantResidents` op (`appTenantResidents.graphql`, RLS-scoped) is no longer used by
  this page; keep it only if another consumer remains, else delete at implementation time.

### Mutations
None on this page. Block/unblock actions are on the user detail page (current-tenant residents only).

## Composable

**Source**: `packages/graphql-client-api/src/composables/useAdminResidents.ts`
**Re-export**: `apps/tenant-app/app/composables/useAdminResidents.ts`

```ts
// re-export file (single line)
export { useAdminResidents, useSubtreeResidents } from '@function-bucket/fnb-graphql-client-api'
```

| Export | Shape | Usage |
|---|---|---|
| `useSubtreeResidents(currentTenantId)` | `{ users: ComputedRef<SubtreeUserView[]>, fetching, error, executeQuery }` | called in index.vue; `currentTenantId` from `useAuth()` claims |

`users` groups the flat residency rows into **one row per person** (`SubtreeUserView`, see
`_shared.data.md`): dedupe by `profileId`; pending profile-less invites stay individual rows;
`tenancies` ordered current-tenant-first. The page refreshes via
`executeQuery({ requestPolicy: 'network-only' })` after `WorkspaceResidentsModal` emits `changed`
(replacing the old `useAdminResidents().executeQuery` wiring).

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
