# admin/user/index — User List UI

## Status
Implemented (list + **Manage Residents**, 2026-07-22; **one-row-per-person subtree roll-up
2026-07-27**, `SubtreeResidentList.vue` — `ResidentList.vue` deleted, no consumers remained).
See `README.md` + `_shared.data.md`.

## Route
`/tenant/admin/user` → `apps/tenant-app/app/pages/admin/user/index.vue`

## Required Permission
`p:app-admin`

## Layout
- Title: "Residents" (`PageHeader`, subtitle = **people count**, e.g. `12 people across 4 tenants`
  — tenant count = distinct `tenantId`s in the loaded rows; omit the suffix when it is 1)
- `#actions` (stacked column, right-aligned): `InviteUserModal` (shown when `canInvite`), and
  `WorkspaceResidentsModal` (shown when `canInvite && claims.tenantType ∈ {WORKSPACE, CLIENT,
  ORGANIZATION}`); below the buttons, a **color legend** — one sample `UBadge` per category —
  `Active / Supporting` (success), `Invited` (warning), `Blocked` (error),
  `Inactive` (**info — blue**), `Declined` (neutral). Mirrors the shared resident color map
  (UC1). **`Inactive` is its own blue category** (2026-08-04) — split out from the old combined
  `Declined / Inactive` neutral entry.
- **`SubtreeResidentList.vue` table (replaces `ResidentList.vue` on this page)**

## Component: `SubtreeResidentList.vue` — NEW (roll-up)
Props: `users: SubtreeUserView[]` (see `_shared.data.md`)
- Columns (responsive, `overflow-x-auto` — UC5):
  - **Name** — link to `/admin/user/{linkResidentId}`; bold; pending invites show the email stem
  - **Email** — muted
  - **Status** — badge of `currentStatus` (colors below); `—` (neutral, no badge) when the person
    has no residency in the current tenant
  - **Tenants** — one `UBadge` per tenancy (label = `tenantName`, current tenant first;
    badge color = that tenancy's status color; `variant="subtle"`); flex-wrap
- No emits — navigation only (the color legend lives in the page header actions, not here)

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

## Component: `ResidentList.vue` — no longer used by this page after the roll-up
Props: `residents: Resident[]`
- Columns: name (link to `/admin/user/{id}`), email, status badge, type
- Keep the component only if another page still consumes it; otherwise delete at implementation time.

**Status badge colors** (shared by `SubtreeResidentList` status + tenancy badges; canonical map is
the `resident` entry in `packages/auth-layer/app/utils/status.ts` — UC1):
| Status | Color |
|---|---|
| active, supporting | success (green) |
| blocked_individual, blocked_tenant | error (red) |
| invited | warning (yellow) |
| inactive | **info (blue)** — 2026-08-04, own category |
| declined, other | neutral |

> **Shared-map change (2026-08-04):** `resident.inactive` moves `neutral → info` in
> `packages/auth-layer/app/utils/status.ts`. `resident.declined` stays `neutral`. Because
> `SubtreeResidentList` and every other resident badge read this shared map, `inactive` residents
> render blue everywhere resident status is shown — intended, keeps the legend and the table in sync.

## User Interactions
- Click person's name → navigate to `/admin/user/{linkResidentId}` (current-tenant residency when
  one exists → full management detail; otherwise a child-tenant residency → read-only detail, see
  `[id].ui.md`)
