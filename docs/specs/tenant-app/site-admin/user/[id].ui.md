# site-admin/user/[id] — User Detail UI

## Status
Implemented

## Route
`/tenant/site-admin/user/[id]` → `apps/tenant-app/app/pages/site-admin/user/[id].vue`

## Required Permission
`p:app-admin-super`

## Layout
Two-column responsive layout.

### Left Column

**Profile Card** (view + edit toggle)

View fields: email, full name, display name, identifier, phone, isPublic (yes/no), ID, created, updated

Edit fields: firstName, lastName, displayName, identifier, phone, isPublic (checkbox)

Status badge + conditional action buttons:
| Profile Status | Buttons Available |
|---|---|
| `active` | Deactivate, Block |
| `inactive` | Activate, Block |
| `blocked` | Activate, Deactivate |

**Auth Account Card** (read-only — no edit)
Fields: email, role, email confirmed (yes/no badge), last sign in, ID, created.
If no auth account: "No auth account found for this profile."

### Right Column

**Residencies Card**
- Count badge showing number of residencies
- Per-resident row: tenant name, resident ID, status badge, action button

Status badge colors:
| Status | Color |
|---|---|
| active, supporting | success |
| blocked_individual, blocked_tenant | error |
| invited | warning |
| other | neutral |

Resident action buttons:
| Resident Status | Button |
|---|---|
| inactive, blocked_individual, invited | Activate |
| active, supporting | Deactivate |

## User Interactions
| Action | Trigger |
|---|---|
| Toggle edit | Edit button on Profile Card |
| Save profile | Save button (PATCH) |
| Activate / Deactivate / Block profile | Status action buttons |
| Activate / Deactivate resident | Per-resident action buttons |
