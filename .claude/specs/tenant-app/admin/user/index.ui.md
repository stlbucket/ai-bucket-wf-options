# admin/user/index — User List UI

## Status
Implemented

## Route
`/tenant/admin/user` → `apps/tenant-app/app/pages/admin/user/index.vue`

## Required Permission
`p:app-admin`

## Layout
- Title: "Users"
- `ResidentList.vue` table

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
