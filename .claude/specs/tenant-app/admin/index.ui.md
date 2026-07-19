# admin/index — Hub Page UI

## Status
Implemented

## Route
`/tenant/admin` → `apps/tenant-app/app/pages/admin/index.vue`

## Required Permission
`p:app-admin`

## Layout
Grid (1–3 columns, responsive) of navigation cards — one per admin sub-section.

## Data Source
`useAppNav().availableSections` filtered to sections whose key contains `"admin"`.
Sections are sorted by ordinal descending.

## User Interactions
- Click a card → navigate to that sub-section's index route

## No data file
This page has no API calls — it reads only from the nav composable populated at auth time.
