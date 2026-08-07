# Admin — Invite User (UI)

## Status
Implemented (Phase 1, verified live 2026-07-22; send-immediately checkbox extension built
2026-07-27 via plan `0160` — build gate passed, manual e2e pending). Adds an invite action to
the existing **Residents** page (`apps/tenant-app/app/pages/admin/user/index.vue`,
`/tenant/admin/user`). No new route.

> The checkbox rides the invite-contract **link mode** (workflow `lastNode` + `mode` payload +
> `TriggerWorkflowResult.result`) spec'd in `../tenant-app/site-admin/tenant/[id].data.md`
> (built together in plan `0160`).

## Layout changes

`admin/user/index.vue` today renders `PageHeader` + `ResidentList`. Add an **Invite User** action
in the header and an `InviteUserModal`.

```
PageHeader  title="Residents"  subtitle="{n} residents"
   └─ #right (or trailing slot):  <UButton icon="i-lucide-user-plus" label="Invite User" />   ← p:app-admin only
InviteUserModal  (UModal)   ← opened by the button
ResidentList (unchanged)
```

- The button is gated on `p:app-admin` (the same gate the workflow enforces). Use the app's
  permission helper (`useAuth()` claims / the existing `can`-style check used elsewhere in admin) —
  hide, don't just disable, when the admin lacks it. **[FILL IN]** the exact helper name from a
  sibling admin page.
- `PageHeader` — confirm it exposes a trailing/actions slot; if not, place the `UButton` in a
  `flex justify-between` row next to it (UC3/UC5 — Nuxt UI + responsive).

## `InviteUserModal` (new component — `apps/tenant-app/app/components/admin/InviteUserModal.vue`)

`UModal` wrapping a `UForm` (Nuxt UI 4, UC3/UC4). **Extended U10 (2026-08-07)** — the popup now
collects first name, last name, display name, email, and phone; **only email is required**, the
other four are optional:

| Field | Component | Rules |
|---|---|---|
| First name | `UInput` (`i-lucide-user`) | optional, trimmed |
| Last name | `UInput` (`i-lucide-user`) | optional, trimmed |
| Display name | `UInput` (`i-lucide-id-card`) | **optional** (was required); trimmed. Server-unique — a collision returns `31020` → mapped error toast (see Interactions) |
| Email | `UInput type="email"` (`i-lucide-mail`) | **required**, valid email — domain labels must be non-empty dot-separated runs (`example..com` is rejected client-side; ZITADEL 400s it otherwise) |
| Phone | `UInput type="tel"` (`i-lucide-phone`) | optional, trimmed |
| Send invite immediately | `UCheckbox` | default = last-used value (see Persistence below); first-ever use → checked |

- First name + Last name may share one responsive two-column row (`grid grid-cols-1 sm:grid-cols-2
  gap-4`, UC5); the remaining fields stack full-width.
- `canSubmit` gates on **email validity only** now (display name is no longer required). All other
  fields are free-text optional. Blank optional fields are sent omitted / empty and land as `null`
  server-side (`app_fn.invite_user` normalizes `'' → null`, fill-only-blanks on re-invite).
- Footer: a single **Save** submit `UButton` (`loading` while submitting) + a Cancel/close
  button. The label is constant (user directive 2026-07-27 — "a simple save button", replacing
  the earlier dynamic Send invitation / Create invite link label); the checkbox alone conveys
  the mode.
- Submit → `useInviteUser().invite({ email, firstName, lastName, displayName, phone, mode })` —
  `mode: 'email'` when the checkbox is checked, `mode: 'link'` when not (see `admin-invite.data.md`);
  optional fields are trimmed and dropped when blank.
- **Success (checked / email mode — unchanged)**: `useToast().add({ title: 'Invitation sent', description: '<email> will get an email to set up their account.', color: 'success' })` (UC7 — toast for transient success); close the modal; reset the form.
- **Success (unchecked / link mode)**: no email is sent — the workflow returns the onboarding
  ceremony URL (`InviteUserResult.link`). The modal **stays open** and swaps the form for the
  link result: a readonly `UInput` holding the URL + a copy `UButton` (`i-lucide-copy`) that
  `navigator.clipboard.writeText(link)`s it (readonly input is the clipboard-denied fallback —
  same pattern as `SendInviteModal`'s Copy-link), toast "Invite created — link ready", and the
  single-use security caption (muted): *"The link is single-use and lets the holder set this
  account's password — share it directly with the invitee only."* A **Done** button closes +
  resets.
- **Error**: `useToast().add({ color: 'error', title: 'Could not send invitation', description: <mapped message> })`; keep the modal open so the admin can retry.
- The residents list is **not** refetched on success — the resident row is created async by the
  workflow and lands `invited`; a manual refresh or the next navigation shows it. (Optional Phase 4:
  optimistic add / poll. Note it, don't build it.) On the site-admin tenant detail page the
  `invited` emit (see `../tenant-app/site-admin/tenant/[id].ui.md`) fires on **both** modes.

## Persistence — the checkbox remembers the last invite

The checkbox default is the value used on the admin's **previous successful invite** (user
directive 2026-07-27):

- localStorage key **`invite-user-send-immediately`** (`'true' | 'false'`) — plain
  `localStorage` + kebab-case key, matching the `todo-detail-rail-open` /
  `ticket-detail-rail-open` precedent.
- **Written only on a successful submit** (not on toggle) — "remember the last time I invited
  someone", not the last flip of the checkbox.
- **Read client-side only** (`import.meta.client` guard or on-mount) when the component sets up;
  missing key → `true` (send immediately).
- UI-only concern — no DB/preference surface (locked: localStorage over a DB preference,
  2026-07-27).

## Reactive state

```ts
const open = ref(false)
const form = reactive({ firstName: '', lastName: '', displayName: '', email: '', phone: '' }) // U10
const submitting = ref(false)
const sendImmediately = ref(true) // seeded from localStorage 'invite-user-send-immediately' (client-only)
const inviteLink = ref<string | null>(null) // link-mode result; non-null switches the body to the link view
// canSubmit = emailValid.value (display name no longer gates — U10). reset() clears all five fields.
```

## Interactions

| Action | Result |
|---|---|
| Click **Invite User** | opens the modal (all five fields blank; checkbox seeded from localStorage) |
| Submit with a **valid email**, checkbox **checked** | `submitting=true` → `invite({ …, mode: 'email' })` → toast + close on success; persist `true`; error toast on failure |
| Submit with a **valid email**, checkbox **unchecked** | `submitting=true` → `invite({ …, mode: 'link' })` → modal shows the copyable ceremony link; persist `false`; error toast on failure |
| Submit a **display name already in use** | **link mode** (checkbox unchecked, `responseMode: lastNode`): the invite **fails synchronously** — the DB raises `31020`, the workflow errors, and the webhook returns **HTTP 500**. But n8n masks the node error (`{"message":"Error in workflow"}`), so the plugin throws a generic `workflow trigger failed: 500` and the **`31020` text does not reach the client** (verified 2026-08-07). The admin therefore sees the generic *"The invite could not be processed. Check the email address, and if you set a display name, it may already be taken — try a different one."* toast; the modal stays open. **email mode** (respond-immediately): the client has `accepted: true` before the DB node runs, so `31020` lands only in the n8n run log — no admin-visible error (caveat below). |
| Click copy button (link view) | `navigator.clipboard.writeText(link)` + toast "Link copied" |
| **Done** (link view) / Cancel / close | resets the form + `inviteLink`, closes |

## Notes
- Icons: `i-lucide-user-plus`, `i-lucide-user`, `i-lucide-id-card`, `i-lucide-mail`,
  `i-lucide-phone`, `i-lucide-copy` (UC11 — verified lucide names).
- No status badge / color mapping here (fire-and-forget action, not a status view).
- **Display-name-collision caveat (U10, verified 2026-08-07):** the DB always rejects an explicit
  collision (`31020` — no bad data is written), but the *reason* never reaches the admin. In **link
  mode** the invite fails with a generic webhook 500 (n8n masks the node error → the client sees
  `workflow trigger failed`, mapped to a copy that mentions both a bad email and a taken display
  name). In **email mode** the failure is only in the n8n run log (respond-immediately). To surface
  the specific reason, a follow-up would need one of: (a) a pre-check GraphQL query on display-name
  availability before submit (also fixes email mode); (b) the invite-user workflow catching the DB
  error and responding with the `31020` message (link mode only); or (c) resident-creation before
  the webhook responds. v1 accepts the caveat (matches the existing "resident appears a beat later"
  async model) — the important guarantee (no duplicate/overwritten display name) holds at the DB.
- Link mode blocks ~1–2 s on the ZITADEL round-trip (webhook `lastNode`) — the submit button's
  `loading` covers it.
