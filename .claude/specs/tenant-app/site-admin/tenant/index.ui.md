# site-admin/tenant/index — Tenant List UI

## Status
Implemented

## Route
`/tenant/site-admin/tenant` → `apps/tenant-app/app/pages/site-admin/tenant/index.vue`

## Required Permission
`p:app-admin-super`

## Layout
`TenantList.vue` table

## Component: `TenantList.vue`
Props: `tenants: Tenant[]`, `canSupport?: boolean`
Emits: `support(tenant)`

- Columns: name (link to `/site-admin/tenant/{id}`), status badge, type, identifier
- Support button per row (visible only if `canSupport`)
- Support button click → confirmation modal → `support` event emitted

**Status badge colors:**
| Status | Color |
|---|---|
| active | success |
| paused | warning |
| other | neutral |

## Support Mode Entry
Support button visible when `p:app-admin-support` OR `p:app-admin-super`.
Opens a confirmation modal before proceeding. On confirm, calls become-support API (see data file).

## User Interactions
| Action | Trigger | Condition |
|---|---|---|
| View tenant detail | Click name | — |
| Enter support mode | Support button → confirm modal | `canSupport` |
