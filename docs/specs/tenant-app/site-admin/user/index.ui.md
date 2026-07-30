# site-admin/user/index — User List UI

## Status
Implemented (search + pagination, 2026-07-27 — see `README.md`).

## Route
`/tenant/site-admin/user` → `apps/tenant-app/app/pages/site-admin/user/index.vue`

## Required Permission
`p:app-admin-super`

## Layout
- `PageHeader` title "Users", subtitle = `${totalCount} platform users` (from
  `searchProfilesCount` — not the page's row count)
- **Search bar** (below the header, above the table): `UInput` with `icon="i-lucide-search"`,
  placeholder `Search by name, email, or identifier`, clearable. The raw input is **debounced
  300 ms** into the composable's `searchTerm` ref; any change resets `page` to 1.
- `UserList.vue` table (unchanged component) inside the standard bordered container
- **`UPagination`** (below the table, right-aligned, hidden when `pageCount <= 1`):
  `v-model:page`, `:total="totalCount"`, `:items-per-page="25"`
- While `fetching`, keep the current rows and dim/skeleton (no layout jump); empty state when
  `users.length === 0` — muted `No users match "{term}"` (or `No users` with no term)

## Component: `UserList.vue`
Props: `users: Profile[]`

- Columns: displayName (link to `/site-admin/user/{id}`), email, status badge, identifier
- Status badge: active=success, blocked=error, other=neutral

## User Interactions
- Type in search → debounced server-side re-query (page resets to 1)
- Change page → re-query with new offset
- Click display name → navigate to `/site-admin/user/{id}`
