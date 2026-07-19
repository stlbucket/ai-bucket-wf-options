# admin/license/index — License List UI

## Status
Implemented

## Route
`/tenant/admin/license` → `apps/tenant-app/app/pages/admin/license/index.vue`

## Required Permission
`p:app-admin`

## Layout
- Back button → `/admin`
- Title: "Licenses"
- Filter bar (above table):
  - Text search input (by resident name or email)
  - Multi-select status checkboxes — dynamic from data; includes "All" toggle
  - Multi-select license type checkboxes — dynamic from data; includes "All" toggle
- `LicenseList.vue` table (filtered results)

## Component: `LicenseList.vue`
Props: `licenses: License[]`, `residents: Resident[]`
Emits: `activate(licenseId)`, `deactivate(licenseId)`

- Sortable table via `@tanstack/vue-table`
- Columns: User (resolved from residents map), License Type, Status badge, Expires, Actions
- Resident lookup: map built from `residents` prop keyed by id

**Status badge colors:**
| Status | Color |
|---|---|
| active | success |
| expired | error |
| other | neutral |

**Action button:** toggles based on current license status (activate ↔ deactivate)

## Reactive State
- `search: string` — text filter
- `selectedStatuses: Set` — initialized to all status values
- `selectedTypes: Set` — initialized to all license type keys
- `filteredLicenses: computed` — combines all three filters

## User Interactions
| Action | Trigger |
|---|---|
| Filter | Type in search, toggle checkboxes |
| Activate license | "Activate" row button |
| Deactivate license | "Deactivate" row button |
