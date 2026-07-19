# site-admin/user/index — User List UI

## Status
Implemented

## Route
`/tenant/site-admin/user` → `apps/tenant-app/app/pages/site-admin/user/index.vue`

## Required Permission
`p:app-admin-super`

## Layout
`UserList.vue` table

## Component: `UserList.vue`
Props: `users: Profile[]`

- Columns: displayName (link to `/site-admin/user/{id}`), email, status badge, identifier
- Status badge: active=success, blocked=error, other=neutral

## User Interactions
- Click display name → navigate to `/site-admin/user/{id}`

## Known Gap
No search or pagination.
