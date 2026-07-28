# site-admin/tenant/[id] — Tenant Detail UI

## Status
Implemented — GraphQL (detail card + read-only users / subscriptions cards, built 2026-07-27 via
plan `0160`; the same-day **reversal** removed every invite affordance from this page — see the
README's Reversal note. `pnpm build` gate passed, manual e2e pending).

## Route
`/tenant/site-admin/tenant/[id]` → `apps/tenant-app/app/pages/site-admin/tenant/[id].vue`

## Required Permission
`p:app-admin-super`

## Layout

Container widens from `max-w-2xl` to `max-w-4xl` (the users table needs the room; still centered,
`space-y-4`). Three stacked `UCard`s (UC4):

1. **Tenant detail card** — existing, unchanged (view/edit toggle).
2. **Users card** — NEW: all residents of this tenant.
3. **Subscriptions card** — NEW: read-only subscription list.

### Card 1 — Tenant detail (existing, unchanged)

**View mode fields:** name, identifier, type, status badge, ID (uuid), created, updated timestamps

**Edit mode fields:** name, identifier, type (`USelect` — context-aware per
`../../admin/nestable-tenant-types/`: roots offer anchor | customer | demo | test | trial)

### Card 2 — Users (read-only)

Header row: `<h2>` "Users" + subtle count badge (`residents.length`). **No actions** — inviting
and re-inviting happen from inside the tenant via support mode (reversal 2026-07-27), never from
this page.

Body: `UTable`-style listing inside `overflow-x-auto` (UC5). One row per resident
(`type !== 'SUPPORT'` filtered out — support residencies are plumbing, not tenant users).

| Column | Content |
|---|---|
| User | `displayName` (fallback: email local-part) + `email` on a second muted line |
| Status | `UBadge` — `statusColor('resident', status)` / `statusLabel(status)` (auth-layer util) |
| Licenses | One subtle `UBadge` per **active** license's `licenseTypeKey`; `—` when none |

Empty state: `UEmpty` "No users yet — enter support mode to invite one." Fetching: existing
card-level `fetching` (the residents ride the same `AppTenantById` query — no separate spinner).

### Card 3 — Subscriptions (read-only)

Header: `<h2>` "Subscriptions". No actions (locked decision — management stays on the
admin/subscription pages via support mode).

| Column | Content |
|---|---|
| Pack | license pack `displayName` (fallback `licensePackKey`) |
| Status | `UBadge` — `statusColor('subscription', status)` / `statusLabel(status)` |
| Licenses | issued-license count for the subscription |

Empty state: muted "No subscriptions."

## Components

### `InviteUserModal.vue` — NOT used on this page (reversal 2026-07-27)
The `targetTenantId` prop this spec originally added was removed with the reversal; the modal is
tenant-admin only again (its `invited` emit and the U9 send-immediately checkbox remain — spec:
`user-invitation/admin-invite.ui.md`).

### `SendInviteModal.vue` — NOT used on this page (reversal 2026-07-27)
`apps/tenant-app/app/components/SendInviteModal.vue` was created by this spec and survives, but
its only consumer is now the tenant-admin `admin/user/[id]` **Resend invitation** flow. Its
`targetTenantId` prop was removed — the trigger plugin always injects the acting admin's claims
tenant. Props today:

| Prop | Type | Notes |
|---|---|---|
| `resident` | `{ displayName: string \| null; email: string }` | the row being re-invited |

Modal body — two explicit choices (locked decision):

| Action | Button | Behavior |
|---|---|---|
| Send email | primary, `i-lucide-mail` | dispatches the invite in **email mode** (fire the workflow, email #1 lands in the invitee's inbox). Success → `useToast` "Invitation sent" (UC7), modal closes. |
| Copy link | outline, `i-lucide-link` | dispatches in **link mode** (synchronous — the workflow returns the onboarding ceremony URL, no email sent). On return: `navigator.clipboard.writeText(link)`, the URL is also shown read-only in the modal (`UInput` readonly + copy icon) as a fallback for clipboard-denied contexts, toast "Link copied". |

Loading: per-button `loading` while the trigger is in flight (link mode blocks ~1–2 s on the
ZITADEL round-trip). Error → error toast (UC7), modal stays open for retry.

Security note shown as muted caption under the Copy-link button: *"The link is single-use and
lets the holder set this account's password — share it directly with the invitee only."*

## Status Badge Colors

Tenant (existing): active → success, paused → warning, other → neutral.
Resident + subscription badges use the shared `statusColor` maps in
`packages/auth-layer/app/utils/status.ts` (resident: invited → warning, active/supporting →
success, blocked_* → error, declined/inactive → neutral; subscription: active → success,
inactive → neutral). No new color mappings.

## Action Buttons (card 1 — existing)
| Button | Condition |
|---|---|
| Edit / Save | Always visible; toggles edit mode |
| Activate | `status !== 'ACTIVE'` |
| Deactivate | `status === 'ACTIVE'` |
| Support | `canSupport` (`p:app-admin-support` or `p:app-admin-super`) |

Support button opens a confirmation modal (same flow as list page).

## User Interactions
| Action | Trigger |
|---|---|
| Toggle edit mode | Edit button |
| Save changes | Save button in edit mode |
| Activate / deactivate tenant | Activate / Deactivate buttons |
| Enter support mode | Support button → confirm |
| Invite / re-invite a user | **Not on this page** (reversal 2026-07-27) — enter support mode, then use the tenant's own admin pages (`/tenant/admin/user`) |
