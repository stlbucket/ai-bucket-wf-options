# first-run-setup — `/auth/setup` page (UI)

## Status
Draft — fill in all [FILL IN] sections before implementing.

## Route & placement

- **App:** `auth-app` (base URL `/auth`). Page file: `apps/auth-app/app/pages/setup.vue` →
  served at `/auth/setup`.
- Sits beside `login.vue`, reusing the same auth-layer card styling (`LoginForm.vue` /
  `FunctionBucketMark`).

## Gate & redirects (first-visitor routing)

The whole point is that a virgin environment steers the first visitor here, and a provisioned
environment never shows it.

- **On `/auth/setup` mount:** call `GET /auth/api/setup/status`. If `needsSetup === false`,
  immediately `navigateTo('/auth/login', { replace: true })` (or `external` to the login page) —
  setup is a one-time door that closes behind itself.
- **From the login page:** in `login.vue` (or a tiny `auth-app` route middleware), when
  `GET /auth/api/setup/status` returns `needsSetup === true`, redirect `/auth/login → /auth/setup`
  so "sign in" on a fresh deploy lands on setup, not an empty ZITADEL login.
- **From home-app (optional nicety):** the logged-out hero's "sign in" button already points at
  `${authAppUrl}/login`; the login redirect above covers it. No home-app change is required —
  mark [FILL IN] if we also want the home hero to swap its copy to "Set up this site" when
  `needsSetup`.

## Layout

`UCard`, centered, mirroring the login card (UC3/UC4). Header: `FunctionBucketMark` + title
"Set up function-bucket" and a one-line subtitle ("Create the first tenant and site admin").

A single `UForm` (Nuxt UI v4) with `UFormField` rows:

| Field | Component | Required | Notes |
|---|---|---|---|
| Tenant name | `UInput` | yes | → `tenantName`; becomes the anchor tenant's display name |
| Email | `UInput type="email"` | yes | → `email`; the site-admin login + ZITADEL username |
| Display name | `UInput` | no | → `displayName`; blank falls back to the email local-part |
| First name | `UInput` | no | → `firstName` (also ZITADEL `givenName`) |
| Last name | `UInput` | no | → `lastName` (also ZITADEL `familyName`) |
| Phone | `UInput` | no | → `phone` |
| Password | `UInput type="password"` | yes | → ZITADEL credential; never stored in Postgres |
| Confirm password | `UInput type="password"` | yes | client-side equality check |

Submit: `UButton` "Create site & continue", `:loading` while posting, disabled until required
fields valid + passwords match.

## Validation

- Client-side: required fields present, email shape, password === confirm, password length
  ≥ [FILL IN — see _shared Open Question on password policy].
- Server-side errors (ZITADEL complexity rejection, or the `SETUP_ALREADY_COMPLETE` race)
  surface in a persistent `UAlert color="error"` above the submit button (UC7: `UAlert` for a
  persistent error, not a toast).

## Reactive state

```ts
const form = reactive({
  tenantName: '', email: '', displayName: '',
  firstName: '', lastName: '', phone: '',
  password: '', confirmPassword: '',
})
const submitting = ref(false)
const errorMessage = ref<string | null>(null)
```

## Interactions

| Action | Result |
|---|---|
| Page mount, `needsSetup === false` | replace-navigate to `/auth/login` |
| Submit (valid) | `submitting = true`; `POST /auth/api/setup/initialize`; on success → success toast ("Site created — sign in to continue") then redirect to the ZITADEL login (`useAuth().loginWithRedirect()` or navigate to `/auth/login`) |
| Submit → 409 `SETUP_ALREADY_COMPLETE` | `errorMessage` set; offer a "Go to sign in" link (another admin beat them to it) |
| Submit → 4xx/5xx (ZITADEL / DB) | `errorMessage` set to the server message; form stays filled for retry |

## Post-success destination

After `initialize` succeeds, the person's ZITADEL user + DB records exist and residency is
already active. Send them to the login ceremony:
- Preferred: `useAuth().loginWithRedirect()` (kicks straight into the OIDC redirect), **or**
- `/auth/login` and let them press "Sign in with ZITADEL".

[FILL IN] — decide between an auto-redirect into OIDC vs. landing on the login card with a
success banner. Recommendation: land on `/auth/login?setup=success` and toast, so the freshly
created ZITADEL password is entered deliberately.

## Accessibility / responsiveness

Mobile-first single-column card (UC5); labels via `UFormField`; password fields with a
show/hide toggle if the login form has one — otherwise omit to stay consistent.
