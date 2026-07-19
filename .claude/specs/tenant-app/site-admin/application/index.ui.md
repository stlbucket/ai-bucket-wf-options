# site-admin/application/index — Application List UI

## Status
Implemented

## Route
`/tenant/site-admin/application` → `apps/tenant-app/app/pages/site-admin/application/index.vue`

## Required Permission
`p:app-admin-super`

## Layout
`ApplicationList.vue` table — read-only

## Component: `ApplicationList.vue`
Props: `applications: Application[]`

- Columns: key (monospace, link to `/site-admin/application/{key}`), name
- No actions — navigation only

## User Interactions
- Click application key → navigate to `/site-admin/application/{key}`
