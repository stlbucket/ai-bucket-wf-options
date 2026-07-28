# admin/user/[id] — User Detail UI

## Status
Implemented (incl. the **read-only mode for child-tenant residents**, subtree roll-up 2026-07-27).

## Route
`/tenant/admin/user/[id]` → `apps/tenant-app/app/pages/admin/user/[id].vue`

## Required Permission
`p:app-admin`

## Layout
- Back button → `/admin/user`
- **Resident info card**: name, email, type, ID, status badge; header actions (flex-wrap):
  **Resend invitation** (only when status `INVITED` — opens the shared `SendInviteModal`
  with *Send email* / *Copy link*, no `targetTenantId` — the trigger plugin injects the
  admin's claims tenant), **Send password reset** (disabled unless status `ACTIVE` — the
  forgot-password flow requires an existing credentialed user, so it does nothing useful for
  invited/inactive/blocked residents), block/unblock button
- **`LicenseAssignment.vue` card** — one card per subscription pack

Status gates compare the GraphQL enum casing (UPPERCASE — `'ACTIVE'`, `'INVITED'`,
`'BLOCKED_*'`); normalized once in the page (`status` computed). The original lowercase
`isBlocked` comparison was a bug (never matched), fixed 2026-07-27.

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
| Resend invitation | "Resend invitation" button → `SendInviteModal` (send email / copy link) | resident status is `INVITED` |
| Send password reset | "Send password reset" button → confirm modal | button disabled unless status is `ACTIVE` |
| Block | "Block" button | resident is not blocked |
| Unblock | "Unblock" button | resident is blocked |
| Grant license | Select radio / check checkbox in LicenseAssignment | license type not yet held |
| Revoke license | Deselect in LicenseAssignment | license currently held |

After each mutation the page calls `refresh()` and shows a toast.

## NEW — Read-only mode (child-tenant resident, subtree roll-up)

Entered when `ResidentById` settles null and the `SubtreeResidentDetail` fallback resolves
(see `[id].data.md`). Renders:
- Back button → `/admin/user` (unchanged)
- A persistent `UAlert` (UC7 — persistent, not a toast): neutral/info,
  `Read-only — this person is a resident of {tenantName}, not this tenant. Manage them from that tenant.`
- **Resident info card**: same fields (name, email, type, ID, status badge — normalize the
  lowercase pg enum strings before feeding the shared badge map) but **no header actions** — no
  resend-invitation, no password reset, no block/unblock
- **Residencies card** (replaces the `LicenseAssignment` cards): one row per subtree residency —
  `tenantName` badge (status-colored, same map), resident type, status, and a muted read-only
  list of that residency's license type keys. No interactions.
- If the fallback itself errors with `30000` (id outside the subtree) → the standard error state
  (`UAlert`, error color) — do not retry.
