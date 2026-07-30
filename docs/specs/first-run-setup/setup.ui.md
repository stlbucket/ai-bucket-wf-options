# first-run-setup — `/auth/setup` page (UI)

## Status
**Ready** — all open questions resolved (2026-07-21).

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
- **From home-app:** the logged-out hero's "sign in" button already points at
  `${authAppUrl}/login`; the login redirect above covers it. **No home-app change** — the hero copy
  stays as-is (decision 2026-07-21: don't swap the home hero to "Set up this site").

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
| Setup token | `UInput type="password"` | yes | → `setupToken`; the operator's `SETUP_TOKEN` secret. Sent to the endpoint, matched against auth-app's env; mismatch → 403 |

Submit: `UButton` "Create site & continue", `:loading` while posting, disabled until required
fields valid + passwords match + password meets the complexity rule (below) + setup token present.

## Validation

- Client-side (blocks submit): required fields present, email shape, password === confirm,
  **setup token present**, and the password meets the complexity rule — **≥ 8 characters, at least
  one number, at least one symbol** (`/(?=.*\d)(?=.*[^\w\s]).{8,}/` or an equivalent per-rule check
  with inline hints under the field). This is a UX pre-filter only; ZITADEL remains the source of
  truth (see below).
- Server-side errors — the ZITADEL complexity rejection (**422 `ZITADEL_REJECTED`**, message shown
  verbatim), a bad **403** setup token, or the `SETUP_ALREADY_COMPLETE` race (**409**) — surface in
  a persistent `UAlert color="error"` above the submit button (UC7: `UAlert` for a persistent
  error, not a toast). The client rule and ZITADEL's policy can diverge; when they do, ZITADEL wins
  and its message is displayed.

## Reactive state

```ts
const form = reactive({
  tenantName: '', email: '', displayName: '',
  firstName: '', lastName: '', phone: '',
  password: '', confirmPassword: '', setupToken: '',
})
const submitting = ref(false)
const errorMessage = ref<string | null>(null)
```

## Interactions

| Action | Result |
|---|---|
| Page mount, `needsSetup === false` | replace-navigate to `/auth/login` |
| Submit (valid) | `submitting = true`; `POST /auth/api/setup/initialize`; on success → success toast ("Site created — signing you in…") then **`useAuth().loginWithRedirect()`** — kick straight into the ZITADEL OIDC ceremony (decision 2026-07-21: auto-redirect, not a login card) |
| Submit → 403 `INVALID_SETUP_TOKEN` | `errorMessage` set ("Invalid setup token"); form stays filled, token field cleared |
| Submit → 409 `SETUP_ALREADY_COMPLETE` | `errorMessage` set; offer a "Go to sign in" link (another admin beat them to it) |
| Submit → 4xx/5xx (ZITADEL / DB) | `errorMessage` set to the server message; form stays filled for retry |

## Post-success destination

After `initialize` succeeds, the person's ZITADEL user + DB records exist and residency is already
active. **Decision (2026-07-21): auto-redirect straight into OIDC.** On the `{ ok: true }`
response, show a brief success toast ("Site created — signing you in…") and immediately call
**`useAuth().loginWithRedirect()`**, which kicks off the ZITADEL OIDC redirect. The person lands on
ZITADEL's login already holding the credentials they just chose (email + password from the form),
so the ceremony is one step, not two. (Rejected the `/auth/login?setup=success` landing card —
fewer clicks wins here since the operator just typed the password seconds ago.)

## Accessibility / responsiveness

Mobile-first single-column card (UC5); labels via `UFormField`; password fields with a
show/hide toggle if the login form has one — otherwise omit to stay consistent.
