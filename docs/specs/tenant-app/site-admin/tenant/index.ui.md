# site-admin/tenant/index — Tenant List UI

## Status
Implemented (New Tenant modal built 2026-07-27; admin-identity extension — first/last name +
optional phone — built 2026-07-30, plan `0650`; manual e2e verification pending).

## Route
`/tenant/site-admin/tenant` → `apps/tenant-app/app/pages/site-admin/tenant/index.vue`

## Required Permission
`p:app-admin-super`

## Layout
- `PageHeader` row with a **New Tenant** action button (right-aligned)
- `TenantList.vue` table

## Component: `TenantList.vue`
Props: `tenants: Tenant[]`, `canSupport?: boolean`
Emits: `support(tenant)`

- Columns: name (link to `/site-admin/tenant/{id}`), status badge, type, identifier
- Support button per row (visible only if `canSupport`)
- Support button click → confirmation modal → `support` event emitted

**Status badge colors:**
| Status | Color |
|---|---|
| active | success |
| paused | warning |
| other | neutral |

## New Tenant Button + Modal

Follows the house modal precedent `WorkspaceCreateModal.vue` + `admin/workspace/index.vue`
(the modal owns its trigger button and `open` state; the parent owns the mutation, toasts,
and navigation).

**Component: `NewTenantModal.vue`** (`apps/tenant-app/app/components/`)
Props: `creating?: boolean`. Emits: `create(payload: NewTenantPayload)` where

```ts
interface NewTenantPayload {
  name: string
  email: string
  firstName: string
  lastName: string
  phone: string | null // E.164 (+1XXXXXXXXXX) or null
}
```

(admin-identity extension 2026-07-30 — replaces the original two-positional-arg
`create(name, email)` emit; the page is the only consumer).
Exposes: `reset()` (closes + clears the form — parent calls it via template ref on success).

Renders its own trigger `UButton` — label "New Tenant", icon `i-lucide-plus`, `size="sm"` —
placed in the header row via the page's flex-wrap header layout (workspace-page pattern; the
`PageHeader` `#actions` slot is an equivalent alternative). No extra visibility gate — the page
itself is already `p:app-admin-super`.

`UModal` (title "New Tenant", description noting the email is invited as the tenant admin
and license packs auto-subscribe) with `UFormField` fields:
| Field | Component | Rules |
|---|---|---|
| Name | `UFormField required` + `UInput` | required, non-empty (trimmed) — the tenant name |
| Admin first name | `UFormField required` + `UInput` | required, non-empty (trimmed) |
| Admin last name | `UFormField required` + `UInput` | required, non-empty (trimmed) |
| Admin email | `UFormField required` + `UInput type="email"` | required, valid email — this address is invited as the tenant **admin** |
| Admin phone | `UFormField` (not required) + `PhoneSegments` | optional — the shared segmented E.164 input from `packages/auth-layer/app/components/PhoneSegments.vue` (same pattern as the profile-page notification preferences + SMS-Test). v-models `+1XXXXXXXXXX`, `''` while incomplete → emit `null` |

First/last name and phone land on the admin's pre-created `app.profile` row (see
`index.data.md` — the initialize_anchor precedent; existing profiles are only blank-filled).

Submit disabled until name, first/last name, and email validate (a partially-entered phone —
`PhoneSegments` still `''` — does **not** block submit but should be visually incomplete;
treat `''` as "not provided"); `@keyup.enter` submits from the text inputs.

The tenant type is **not** collected — always `'customer'` in this context (DB default; locked
decision, see README). Identifier is not collected either (stays `null`).

Footer: **Create** (`primary`, `:loading="creating"`, disabled until valid) · **Cancel**
(ghost/`neutral`, calls the internal reset).

**Outcomes (handled in the page, workspace-page pattern):**
- Success → `createModal.value?.reset()`, success toast (UC7), then
  `navigateTo('/site-admin/tenant/${tenant.id}')` (locked decision: land on the detail page to
  review subscriptions + the invited admin)
- DB error `30002` (duplicate root-tenant name — detected via `e.message.includes('30002')`,
  workspace precedent) → error toast "A tenant with this name already exists"; modal stays open
  with input preserved
- Any other error → generic error toast; modal stays open

## Support Mode Entry
Support button visible when `p:app-admin-support` OR `p:app-admin-super`.
Opens a confirmation modal before proceeding. On confirm, calls become-support API (see data file).

## User Interactions
| Action | Trigger | Condition |
|---|---|---|
| View tenant detail | Click name | — |
| Enter support mode | Support button → confirm modal | `canSupport` |
| Create tenant | New Tenant button → modal form → Create | — (page is `p:app-admin-super`) |
