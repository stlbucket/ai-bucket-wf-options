# admin/user/index — User List UI

## Status
Implemented (list + **Manage Residents**, workspace-only, 2026-07-22). See `README.md` +
`_shared.data.md`.

## Route
`/tenant/admin/user` → `apps/tenant-app/app/pages/admin/user/index.vue`

## Required Permission
`p:app-admin`

## Layout
- Title: "Residents" (`PageHeader`, subtitle = resident count)
- `#actions`: `InviteUserModal` (shown when `canInvite`), and — **NEW** —
  `WorkspaceResidentsModal` (shown when `canInvite && claims.tenantType === 'WORKSPACE'`)
- `ResidentList.vue` table

## NEW — Manage Residents (workspace tenants only)

### Gate
Rendered only when both hold (client hint; the DB re-enforces — R13):
- `canInvite` → `useAuth().user.permissions` includes `p:app-admin`
- `useAuth().user.tenantType === 'WORKSPACE'` (new claim — see `_shared.data.md`)

### Component: `WorkspaceResidentsModal.vue`
Self-contained, matching `WorkspaceCreateModal.vue`: owns its own `open` ref and renders its own
trigger button (`UButton` label "Manage Residents", `i-lucide-users-round`). No props.
Emits `changed` when at least one membership toggled (so the page can refresh the list).

- On open → `useWorkspaceResidents()` runs `WorkspaceResidentPool`. Show a skeleton/spinner while
  `fetching`; `UAlert` on `error` (UC7).
- Body: a scrollable list (`overflow-y-auto`, capped height) of candidates. Each row:
  `UCheckbox` (`v-model` = `isMember`) + display name (bold) + email (muted) + a subtle
  `home_tenant_name` badge for disambiguation.
- The acting admin's own row (`profileId === claims.profileId`): checkbox **checked + disabled**.
- Toggling a checkbox → `setMembership(profileId, next)`; per-row `pending` disables that row
  until it resolves. `useToast` success ("Added …"/"Removed …") / error (UC7). On success set
  `changed = true` and let the composable re-query the pool (`isMember` reflects the new state).
- Optional search `UInput` filtering by name/email when the list is long (nice-to-have).

**Checkbox state → meaning**
| Checked | Meaning |
|---|---|
| ✓ | Person is a member of this workspace (`is_member` — resident exists, status ≠ `removed`) |
| ☐ | Not a member (no row, or soft-`removed`) |

## Component: `ResidentList.vue`
Props: `residents: Resident[]`
- Columns: name (link to `/admin/user/{id}`), email, status badge, type
- No emits — navigation only

**Status badge colors:**
| Status | Color |
|---|---|
| active, supporting | success (green) |
| blocked_individual, blocked_tenant | error (red) |
| invited | warning (yellow) |
| other | neutral |

## User Interactions
- Click resident name → navigate to `/admin/user/{id}`
