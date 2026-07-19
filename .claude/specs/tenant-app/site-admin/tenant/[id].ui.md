# site-admin/tenant/[id] — Tenant Detail UI

## Status
Implemented

## Route
`/tenant/site-admin/tenant/[id]` → `apps/tenant-app/app/pages/site-admin/tenant/[id].vue`

## Required Permission
`p:app-admin-super`

## Layout
Single detail card with view/edit toggle.

**View mode fields:** name, identifier, type, status badge, ID (uuid), created, updated timestamps

**Edit mode fields:** name, identifier, type (dropdown: anchor | customer | demo | test | trial)

## Status Badge Colors
| Status | Color |
|---|---|
| active | success |
| paused | warning |
| other | neutral |

## Action Buttons
| Button | Condition |
|---|---|
| Edit / Save | Always visible; toggles edit mode |
| Activate | `status !== 'active'` |
| Deactivate | `status === 'active'` |
| Support | `canSupport` (`p:app-admin-support` or `p:app-admin-super`) |

Support button opens a confirmation modal (same flow as list page).

## User Interactions
| Action | Trigger |
|---|---|
| Toggle edit mode | Edit button |
| Save changes | Save button in edit mode (PATCH) |
| Activate tenant | Activate button |
| Deactivate tenant | Deactivate button |
| Enter support mode | Support button → confirm |
