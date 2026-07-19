# loc/index — Location List UI

## Status
Ready to implement.

## Route
`/tenant/loc` → `apps/tenant-app/app/pages/loc/index.vue`

## Required Permission
`p:app-user` or `p:app-admin` (matches nav registration)

## Layout
Table (consistent with admin/user, support/tickets). Columns: Name, City, State, Country, Actions.
Wrap in `<UCard>` with `max-w-5xl mx-auto` (UC4, UC12).

## Search / Filter
None for v1 — full list for the current tenant (RLS enforces tenant scope).

## Components
No map. Display is text-only.

## User Interactions
- "New Location" button → `/loc/new`
- Each row's Name cell is a `<NuxtLink>` → `/loc/{id}`
- Delete icon button on each row (with confirmation toast) → calls `deleteLocation(id)` from composable, then `refresh()`
- `<UEmpty>` when list is empty (UC8)

## Navigation
Registered in DB with icon `i-lucide-map-pin` (fix from `i-lucide-messages-square` copy-paste).
Path: `/tenant/loc`. Permissions: `p:app-user`, `p:app-admin`.
