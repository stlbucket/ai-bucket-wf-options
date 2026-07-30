# admin/workspace/index — Workspace List Data

## Status
Implemented — GraphQL (2026-07-10). Divergences from the draft are recorded in README.md → Implementation corrections.

## Route
`/tenant/admin/workspace` — see `index.ui.md` for UI details.

## GraphQL

### Query: `ChildWorkspaces`
- File: `packages/graphql-client-api/src/graphql/app/query/childWorkspaces.graphql`
- Generated hook: `useChildWorkspacesQuery()` in `src/generated/fnb-graphql-api.ts`
- Variables: none — `app_api.child_workspaces()` derives the parent from `jwt.tenant_id()`
- Selection: `childWorkspacesList { ...Tenant }`
- Backing: SECURITY INVOKER set-returning function; rows arrive via the
  `view_child_workspaces` RLS policy (see `_shared.data.md`)

### Query: `MyProfileResidencies` (existing, reused)
- Fetched imperatively via `fetchMyProfileResidencies(client)` (`useResidency.ts`) to join
  `myResidentId` / `canEnter` onto each workspace row.

### Mutation: `CreateWorkspace`
- File: `packages/graphql-client-api/src/graphql/app/mutation/createWorkspace.graphql`
- Generated hook: `useCreateWorkspaceMutation()`
- Variables: `{ name: String!, identifier: String }`
- Backing: `app_api.create_workspace` — guard `p:app-admin`; creates the child tenant,
  subscribes it to the `workspace` pack, creates the caller's `inactive` guest residency with
  an `app-admin` license
- Errors surfaced to UI: `30002` (sibling name duplicate), `31001` (parent not active),
  `30000` (not authorized)

### Mutation: `AssumeResident` (existing, reused)
- Via `assumeResidency(client, residentId)` from `useResidency.ts`; follow with
  `useAuth().refreshClaims()` then `navigateTo('/tenant')`.

## Composable

**Source:** `packages/graphql-client-api/src/composables/useWorkspaces.ts` (`useWorkspaces`)
**Re-export:** `apps/tenant-app/app/composables/useWorkspaces.ts`

| Export | Return shape | Usage |
|---|---|---|
| `workspaces` | `computed<WorkspaceView[]>` | table rows |
| `fetching` / `error` | urql standard (no `pending`, no `refresh`) | loading/error states |
| `executeQuery` | re-run with `{ requestPolicy: 'network-only' }` | after create |
| `createWorkspace(name, identifier?)` | `Promise<Tenant>`; throws `res.error` | modal submit |
| `enterWorkspace(residentId)` | `Promise<void>` | Enter action (caller refreshes claims + navigates) |

Response transformation: `childWorkspacesList` filtered non-null → `toTenant` mapper → joined
with residencies by `tenantId` into `WorkspaceView` (type in `_shared.data.md`).

## Auth Requirements
`p:app-admin` in the current (parent) tenant. All reads RLS-scoped to direct children; the
create mutation re-checks in `app_api`.
