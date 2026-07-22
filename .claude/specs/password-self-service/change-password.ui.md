# Change Password (UI) — `/auth/profile` new column

## Status
Draft. Adds a second column to the existing `apps/auth-app/app/pages/profile.vue` (which today
renders only `<UserProfile>`). **Self-service only** — the form always targets the logged-in user.
Data contract: `change-password.data.md`.

## Layout change

Today `profile.vue` centers a single `max-w-md` card. Change to a **two-column** responsive layout
(stacks on mobile, side-by-side ≥ `md`), UC5:

```
        Your Profile        [ Home ]

  ┌────────────────────┐   ┌──────────────────────────┐
  │  <UserProfile>     │   │  Change password         │
  │  (claims, existing)│   │  <ChangePasswordForm>    │
  └────────────────────┘   └──────────────────────────┘
```

```vue
<div class="mx-auto grid w-full max-w-4xl gap-6 md:grid-cols-2">
  <UserProfile :user="user!" />
  <ChangePasswordForm />
</div>
```

- Keep the page's `middleware: 'auth'` (already present).
- The old comment "Password management is ZITADEL self-service now" is removed — it is now an
  in-app form again, but backed by ZITADEL (the credential store is unchanged; only the UI moves
  back in-app). This resurrects the capability retired at the ZITADEL cutover (superseded issue
  `0070`), now correctly routed through the ZITADEL admin API rather than the dropped `auth.user`.

## New component: `ChangePasswordForm.vue`
Home: `packages/auth-layer` (next to `UserProfile.vue`) — the profile page auto-imports it. It
owns its own form state + submit; the page passes nothing (the target is always "me").

> R2 note: components normally must not call APIs. This is the sanctioned exception class — the
> form POSTs a single H3 route on submit (like a login form), it does not fetch page data. Keep the
> call in the component's submit handler; do not add a page-level data dependency.

### Layout (UCard, UC4)
```vue
<UCard>
  <template #header><h2>Change password</h2></template>
  <UForm :state="form" :schema="schema" @submit="submit">
    <UFormField label="Current password" name="current">
      <UInput v-model="form.current" type="password" icon="i-lucide-lock" autocomplete="current-password" />
    </UFormField>
    <UFormField label="New password" name="next">
      <UInput v-model="form.next" type="password" icon="i-lucide-lock-keyhole" autocomplete="new-password" />
    </UFormField>
    <UFormField label="Confirm new password" name="confirm">
      <UInput v-model="form.confirm" type="password" icon="i-lucide-lock-keyhole" autocomplete="new-password" />
    </UFormField>
    <p class="text-sm text-muted">Password requirements: {policy hint — mirror set-password.vue}</p>
    <UButton type="submit" block :loading="submitting">Update password</UButton>
  </UForm>
</UCard>
```

### State
```ts
const form = reactive({ current: '', next: '', confirm: '' })
const submitting = ref(false)
```

### Validation (client)
- `current`: required.
- `next`: required, min length + complexity hint (mirror `set-password.vue`'s rule — the same
  ZITADEL policy applies; reuse that schema fragment).
- `confirm`: required, **must equal `next`** (inline error under the field, not a toast).
- `next` should also be **≠ `current`** (inline hint) — a no-op change is a poor UX.

### Interactions
| Action | Result |
|---|---|
| Submit (valid, matching) | `submitting=true` → `POST /auth/api/profile/change-password` → success **toast** "Password updated" (UC7), clear the form |
| Submit (mismatch / next==current) | inline field error; no request |
| ZITADEL rejects current password | `401` → inline error on the **Current password** field: "Current password is incorrect" |
| ZITADEL rejects new (policy) | `422` → error toast with the policy message; stay on the form |
| No linked ZITADEL user (never OIDC-logged-in) | `409` → toast "Password change isn't available for this account yet" |

- **Success stays on the page** (no redirect — unlike set-password) — the user is already
  authenticated; just confirm + clear. The session is untouched (ZITADEL doesn't invalidate it on
  a self password change; if it does, handle re-login — Open Question).
- Icons: `i-lucide-lock`, `i-lucide-lock-keyhole` — UC11.

## Out of scope (this page)
No target-user picker. The admin path (resetting *another* user's password) is a separate action
on the tenant-app user detail page — see `admin-reset.data.md`. This form is strictly self.
