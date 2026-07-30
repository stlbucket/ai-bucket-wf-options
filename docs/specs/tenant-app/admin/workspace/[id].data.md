# admin/workspace/[id] — Workspace Detail Data

## Status
Implemented — GraphQL (2026-07-10). Divergences from the draft are recorded in README.md → Implementation corrections.

## Route
`/tenant/admin/workspace/[id]` — see `[id].ui.md` for UI details.

## GraphQL

### Query: `WorkspaceById`
- File: `packages/graphql-client-api/src/graphql/app/query/workspaceById.graphql`
- Generated hook: `useWorkspaceByIdQuery()` in `src/generated/fnb-graphql-api.ts`
- Variables: `{ tenantId: UUID! }`
- Selection: `tenant(id: $tenantId) { ...Tenant, residents { ...Resident, licenses { ...License } }, tenantSubscriptions { ...TenantSubscription } }`
  (exact nested field names follow the PostGraphile relation names; verify at codegen time)
- Returns null (not 404) when the id is not a direct child of the active tenant — the
  `view_child_workspace_*` SELECT policies gate every level (tenant, residents, subscriptions,
  licenses); composable surfaces the not-found state

### Mutations

| Operation | GraphQL | Generated hook | Backing |
|---|---|---|---|
| Deactivate workspace | `DeactivateWorkspace($tenantId)` | `useDeactivateWorkspaceMutation()` | `app_api.deactivate_workspace` — guard `p:app-admin`, parentage verified in `app_fn` (DEFINER), delegates to `app_fn.deactivate_tenant` (residents → `blocked_tenant`) |
| Reactivate workspace | `ActivateWorkspace($tenantId)` | `useActivateWorkspaceMutation()` | `app_api.activate_workspace` — same shape over `app_fn.activate_tenant` (residents → `inactive`/`invited`) |
| Enter workspace | `AssumeResident($residentId)` (existing) | via `assumeResidency(client, residentId)` | `app_api.assume_residency` + `useAuth().refreshClaims()` + `navigateTo('/tenant')` |

## Composable

**Source:** `packages/graphql-client-api/src/composables/useWorkspaces.ts` (`useWorkspaceDetail`)
**Re-export:** `apps/tenant-app/app/composables/useWorkspaces.ts`

| Export | Return shape | Usage |
|---|---|---|
| `useWorkspaceDetail(tenantId)` | `{ workspace: Ref<Tenant \| null>, residents: computed<Resident[]>, subscriptions: computed<TenantSubscription[]>, fetching, error, executeQuery }` | page setup |
| `deactivateWorkspace(tenantId)` | throws `res.error`; network-only re-query on success | confirm modal handler |
| `activateWorkspace(tenantId)` | same | confirm modal handler |

Response transformation: nested lists filtered non-null and mapped through the existing
`toTenant` / `toResident` / license mappers (`fnb-types` shapes; enum values verbatim
UPPERCASE). The current user's own residency in this workspace (for the Enter button) is
resolved from the residents list by claims email — no extra query.

## Auth Requirements
`p:app-admin` in the parent tenant. Lifecycle mutations re-verify parentage server-side;
visibility is entirely policy-driven (see `_shared.data.md` → RLS Policies).
