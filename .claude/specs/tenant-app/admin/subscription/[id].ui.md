# admin/subscription/[id] — Subscription Detail UI

## Status
Implemented

## Route
`/tenant/admin/subscription/[id]` → `apps/tenant-app/app/pages/admin/subscription/[id].vue`

## Required Permission
`p:app-admin`

## Layout
Three cards:

### 1. Summary Card
- License pack display name / key
- Status badge
- Deactivate / Reactivate button (conditional on status)
- Fields: key, description, auto-subscribe (yes/no), ID, created, updated timestamps

### 2. License Types Card
One row per license type:
- License type name and key
- "Issued / Allowed" count
  - Warning color when issued = allowed (at capacity)
- Assignment scope badge

### 3. License Holders Card
One row per active license:
- Link to resident detail page (`/admin/user/{residentId}`)
- License type key
- Expiration date (if set)
- Status badge

## Computed State
- `licenseTypeSummaries` — derives issued count per type from the licenses array

## User Interactions
| Action | Condition |
|---|---|
| Deactivate | Status is `active` |
| Reactivate | Status is `inactive` |
| Navigate to resident | Click resident link in License Holders card |
