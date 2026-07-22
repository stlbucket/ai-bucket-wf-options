# Admin — Invite User (UI)

## Status
Draft. Adds an invite action to the existing **Residents** page
(`apps/tenant-app/app/pages/admin/user/index.vue`, `/tenant/admin/user`). No new route.

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
| Email | `UInput type="email"` (`i-lucide-mail`) | required, valid email |

- Footer: `UButton` **Send invitation** (`loading` while submitting) + a Cancel/close button.
- Submit → `useInviteUser().invite({ displayName, email })` (see `admin-invite.data.md`).
- **Success**: `useToast().add({ title: 'Invitation sent', description: '<email> will get an email to set up their account.', color: 'success' })` (UC7 — toast for transient success); close the modal; reset the form.
- **Error**: `useToast().add({ color: 'error', title: 'Could not send invitation', description: <mapped message> })`; keep the modal open so the admin can retry.
- The residents list is **not** refetched on success — the resident row is created async by the
  workflow and lands `invited`; a manual refresh or the next navigation shows it. (Optional Phase 4:
  optimistic add / poll. Note it, don't build it.)

## Reactive state

```ts
const open = ref(false)
const form = reactive({ displayName: '', email: '' })
const submitting = ref(false)
```

## Interactions

| Action | Result |
|---|---|
| Click **Invite User** | opens the modal (blank form) |
| Submit valid form | `submitting=true` → `invite()` → toast + close on success; error toast on failure |
| Cancel / close | resets the form, closes |

## Notes
- Icons: `i-lucide-user-plus`, `i-lucide-user`, `i-lucide-mail` (UC11 — verified lucide names).
- No status badge / color mapping here (fire-and-forget action, not a status view).
