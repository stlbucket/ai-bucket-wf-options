# admin/user/[id] — User Detail UI

## Status
Implemented

## Route
`/tenant/admin/user/[id]` → `apps/tenant-app/app/pages/admin/user/[id].vue`

## Required Permission
`p:app-admin`

## Layout
- Back button → `/admin/user`
- **Resident info card**: name, email, type, ID, status badge, block/unblock button
- **`LicenseAssignment.vue` card** — one card per subscription pack

## Status Badge Colors
| Status | Color |
|---|---|
| active, supporting | success (green) |
| blocked_individual, blocked_tenant | error (red) |
| invited | warning (yellow) |
| other | neutral |

## Component: `LicenseAssignment.vue`
Props:
- `subscriptionPack: SubscriptionPackDetail` (view type shaped by `useAdminSubscription` in `packages/graphql-client-api/src/composables/useAdminSubscriptions.ts`)
- `residentLicenses: License[]`

Emits: `grant(licenseTypeKey)`, `revoke(licenseId)`

**Scoped types** (user / admin / superadmin / support): radio buttons — exclusive per subscription.
**Unscoped types** (none / all): checkboxes — multiple allowed.
Constant: `UNSCOPED = ['none', 'all']`

## User Interactions
| Action | Trigger | Condition |
|---|---|---|
| Block | "Block" button | resident is not blocked |
| Unblock | "Unblock" button | resident is blocked |
| Grant license | Select radio / check checkbox in LicenseAssignment | license type not yet held |
| Revoke license | Deselect in LicenseAssignment | license currently held |

After each mutation the page calls `refresh()` and shows a toast.
