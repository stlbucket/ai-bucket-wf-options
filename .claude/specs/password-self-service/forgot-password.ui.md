# Forgot Password (UI) — home entry + `/auth/forgot-password`

## Status
Draft. Two surfaces: (1) a small link on the **home-app** logged-out hero; (2) a new
**unauthenticated** auth-app page. Data contract: `forgot-password.data.md`.

## 1. Home-page entry (`apps/home-app/app/pages/index.vue`)

A muted **"forgot password?"** text link directly beneath the existing `sign in` button, inside
the logged-out hero (`v-if="!isLoggedIn"`). User pick 2026-07-22 (text link, not a button — keep
the hero's single primary CTA).

```vue
<UButton :href="`${authAppUrl}/login`" :external="true" size="xl" label="sign in" />
<ULink
  :href="`${authAppUrl}/forgot-password`"
  :external="true"
  class="text-sm text-muted hover:text-default"
>
  forgot password?
</ULink>
```

- `authAppUrl` is already destructured on this page (`useRuntimeConfig().public.authAppUrl`).
- External href (crosses the Caddy path boundary into `/auth`, like `sign in`).
- **Not** shown in the logged-in dashboard branch.
- UC3/UC6: `ULink` + color tokens, no raw colors.

## 2. `/auth/forgot-password` page (`apps/auth-app/app/pages/forgot-password.vue`)

New **public** page (omit `middleware: 'auth'`, mirroring `set-password.vue` / `verify-email.vue`).
Same centered `UCard` chrome + logo as those pages.

### Layout
```
<UCard>  (max-w-md, centered)
  <img logo />
  <h1>Reset your password</h1>
  <p class="text-muted">Enter your email and we'll send you a link to set a new password.</p>

  <UForm :state="form" :schema="schema" @submit="submit" v-if="state === 'form'">
    <UFormField label="Email" name="email">
      <UInput v-model="form.email" type="email" icon="i-lucide-mail" autocomplete="email" />
    </UFormField>
    <UButton type="submit" block :loading="submitting">Send reset link</UButton>
  </UForm>

  <!-- state === 'sent' -->
  <div v-else class="text-center space-y-3">
    <UIcon name="i-lucide-mail-check" class="size-8 text-primary" />
    <p>If an account exists for <b>{{ form.email }}</b>, we've sent a link to set a new password.</p>
    <p class="text-sm text-muted">Check your inbox (and spam). The link expires — request a new one if needed.</p>
    <ULink :href="`${authAppUrl}/login`" :external="true">Back to sign in</ULink>
  </div>
</UCard>
```

### State
```ts
const form = reactive({ email: '' })
const submitting = ref(false)
const state = ref<'form' | 'sent'>('form')
```

### Validation (client)
- `email`: required, email format (mirror `set-password.vue`'s validator — the app's `UForm`
  schema convention). Format only; existence is **never** checked client-side.

### Interactions
| Action | Result |
|---|---|
| Submit (valid email) | `submitting=true` → `POST /auth/api/forgot-password` → **always** `state='sent'` regardless of whether the account exists (no enumeration) |
| Submit (invalid format) | inline field error; no request |
| Network/500 | error toast (UC7) "Something went wrong — try again"; stay on `form` |

- **Critical (no account enumeration):** on any `2xx` the page shows the *same* generic `sent`
  message. The UI never branches on whether ZITADEL had the user — that decision lives only in the
  workflow, which silently no-ops for unknown emails. See `forgot-password.data.md`.

### Notes
- No `useAuth()` — no session. Public page.
- Icons: `i-lucide-mail`, `i-lucide-mail-check` — UC11.
- On success the user lands here → email → **existing** `/auth/set-password` page (unchanged).
