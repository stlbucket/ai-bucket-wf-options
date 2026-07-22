# Set Password (UI) — `/auth/set-password`

## Status
Draft. New **unauthenticated** page in auth-app (`apps/auth-app/app/pages/set-password.vue`),
Caddy path `/auth/set-password`. Landing target of **email #2**.

## Query params
`?userId=<zitadelUserId>&code=<resetCode>` — both required; missing → `invalid` state (no form).

## Layout

`UCard` (UC4) centered like `verify-email.vue` / `login.vue`. A `UForm` with two password fields
(double-entry, UC3):

```
<UCard>
  <h1>Set your password</h1>
  <UForm :state="form" :schema="schema" @submit="submit">
    <UFormField label="New password" name="password">
      <UInput v-model="form.password" type="password" icon="i-lucide-lock" />
    </UFormField>
    <UFormField label="Confirm password" name="confirm">
      <UInput v-model="form.confirm" type="password" icon="i-lucide-lock" />
    </UFormField>
    <p class="text-sm text-muted">Password requirements: {policy hint}</p>
    <UButton type="submit" block :loading="submitting">Set password & continue</UButton>
  </UForm>
</UCard>
```

## Validation (client)
- `password`: required, min length (mirror the ZITADEL **prod** policy — see Open Question; dev is
  relaxed). Show the requirement hint inline.
- `confirm`: required, **must equal `password`** (the double-entry check) — inline error under the
  field, not a toast.
- Use a schema (zod/valibot per the app's `UForm` convention — **[FILL IN]** which validator
  `login`/other forms use).

## State
```ts
const form = reactive({ password: '', confirm: '' })
const submitting = ref(false)
const state = ref<'form'|'invalid'|'expired'>('form')
```

## Interactions
| Action | Result |
|---|---|
| Submit (valid, matching) | `submitting=true` → `POST /auth/api/onboard/set-password` → **redirect `/auth/login?welcome=1`** |
| Submit (mismatch) | inline field error; no request |
| ZITADEL rejects code (expired/used) | `expired` state: `UAlert` "This link has expired — ask your admin to re-invite you." |
| ZITADEL rejects password (policy) | error toast with the policy message; stay on `form` |

- **Success** → `navigateTo('/auth/login?welcome=1')`; the login page shows a one-time
  "Password set — sign in to continue" notice (small addition to `login.vue`, keyed on `welcome`).
- Data contract: `set-password.data.md`.

## Notes
- No `useAuth()` — no session yet. Public page (same public-route meta as `verify-email.vue`).
- Icons: `i-lucide-lock`, `i-lucide-lock-keyhole` — UC11.
