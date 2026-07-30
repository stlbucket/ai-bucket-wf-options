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

`UModal` wrapping a `UForm` (Nuxt UI 4, UC3/UC4):

| Field | Component | Rules |
|---|---|---|
| Display name | `UInput` (`i-lucide-user`) | required, trimmed, non-empty |
| Email | `UInput type="email"` (`i-lucide-mail`) | required, valid email — domain labels must be non-empty dot-separated runs (`example..com` is rejected client-side; ZITADEL 400s it otherwise) |
| Send invite immediately | `UCheckbox` | default = last-used value (see Persistence below); first-ever use → checked |

- Footer: a single **Save** submit `UButton` (`loading` while submitting) + a Cancel/close
  button. The label is constant (user directive 2026-07-27 — "a simple save button", replacing
  the earlier dynamic Send invitation / Create invite link label); the checkbox alone conveys
  the mode.
- Submit → `useInviteUser().invite({ displayName, email, mode })` — `mode: 'email'` when the
  checkbox is checked, `mode: 'link'` when not (see `admin-invite.data.md`).
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
const form = reactive({ displayName: '', email: '' })
const submitting = ref(false)
const sendImmediately = ref(true) // seeded from localStorage 'invite-user-send-immediately' (client-only)
const inviteLink = ref<string | null>(null) // link-mode result; non-null switches the body to the link view
```

## Interactions

| Action | Result |
|---|---|
| Click **Invite User** | opens the modal (blank form; checkbox seeded from localStorage) |
| Submit valid form, checkbox **checked** | `submitting=true` → `invite({ …, mode: 'email' })` → toast + close on success; persist `true`; error toast on failure |
| Submit valid form, checkbox **unchecked** | `submitting=true` → `invite({ …, mode: 'link' })` → modal shows the copyable ceremony link; persist `false`; error toast on failure |
| Click copy button (link view) | `navigator.clipboard.writeText(link)` + toast "Link copied" |
| **Done** (link view) / Cancel / close | resets the form + `inviteLink`, closes |

## Notes
- Icons: `i-lucide-user-plus`, `i-lucide-user`, `i-lucide-mail`, `i-lucide-copy` (UC11 —
  verified lucide names).
- No status badge / color mapping here (fire-and-forget action, not a status view).
- Link mode blocks ~1–2 s on the ZITADEL round-trip (webhook `lastNode`) — the submit button's
  `loading` covers it.
