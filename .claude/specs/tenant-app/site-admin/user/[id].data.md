# site-admin/user/[id] — User Detail Data

## Status
Implemented — GraphQL

## Route
`/tenant/site-admin/user/[id]` — see `[id].ui.md` for UI details

## GraphQL

### Query: `SiteUserById`
- File: `packages/graphql-client-api/src/graphql/app/query/siteUserById.graphql`
- Generated hook: `useSiteUserByIdQuery()` in `src/generated/fnb-graphql-api.ts`
- Variable: `$id: UUID!`
- The server-side `siteUserById` returns a composite (profile + authUser + residents); the
  composable shapes it into a `UserDetail`-like view object.
- Returns null if not found — composable treats as 404

### Mutations (all GraphQL — tenant-app has no `server/`)

| Operation | GraphQL | Generated hook |
|---|---|---|
| Update profile fields | `UpdateUser` | `useUpdateUserMutation()` |
| Update profile status (activate/deactivate/block) | `UpdateUserStatus` | `useUpdateUserStatusMutation()` |
| Update resident status (block/unblock/activate/deactivate) | `UpdateResidentStatus` | `useUpdateResidentStatusMutation()` |

(`updateProfile`, `blockResidency`/`unblockResidency` documents also exist in
`src/graphql/app/mutation/`; the current composable drives status changes through the unified
`UpdateUserStatus` / `UpdateResidentStatus` mutations.)

## Composable

**Source:** `packages/graphql-client-api/src/composables/useSiteAdminUsers.ts` (`useSiteAdminUser`)
**Re-export:** `apps/tenant-app/app/composables/useSiteAdminUsers.ts`

| Export | Return shape | Usage |
|---|---|---|
| `useSiteAdminUser(id)` | `{ user: Ref<UserDetail \| null>, fetching, error, executeQuery }` | called in [id].vue setup |
| `updateUser(id, values)` | `useUpdateUserMutation` | save handler |
| `setUserStatus(id, status)` | `useUpdateUserStatusMutation` | profile status buttons |
| `setResidentStatus(residentId, status)` | `useUpdateResidentStatusMutation` | residency action buttons |

## Types
See `_shared.data.md` → GraphQL Operations, Profile, AuthUser, Resident.
