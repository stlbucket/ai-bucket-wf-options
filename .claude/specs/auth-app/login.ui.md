# auth-app/login — Login Page UI

## Status
Implemented (ZITADEL cutover 2026-07-08 — the password form is removed).
**Extension implemented 2026-07-27 (user-verified)**: auto-redirect dispatcher — the button
card is gone and `/auth/login` starts the ceremony immediately (single landing page).
Contract: `.claude/specs/future-auth/zitadel-login-pattern.md` §Extension. Known cosmetic
note: a brief flash of this page before ZITADEL loads (onMounted redirect + setup-status
fetch), longer in dev — accepted as-is.

## Route
`/auth/login` → `apps/auth-app/app/pages/login.vue`

## Required Permission
None — public page. Redirects to home if already authenticated.

## Layout
Full-viewport-height centered column. In the default (redirecting) state the user should barely
see this page — ZITADEL's fnb-branded hosted login is the single landing page:

- Heading: `Sign in` (bold)
- Subheading (redirecting state): `Redirecting to sign-in…` (muted)
- `<LoginForm>` — from `packages/auth-layer` (**component unchanged**); a card with a single
  **"Sign in with ZITADEL"** button → `useAuth().loginWithRedirect(props.returnTo)` (full-page
  redirect into the hosted login; no password fields, no emit). Accepts an optional **`returnTo`**
  prop (root-relative path); when set, the ceremony returns the user to that path after the
  residency flow instead of home (see `login.data.md` §Return-to). On `/auth/login` it renders
  only as the **manual fallback** under the redirecting state and in the `?welcome=1` pause; the
  deep-link landing page `/auth/go/<id>` keeps it as its primary explicit button.
- `<ResidencySelectModal>` — conditionally shown when user has multiple residencies

## Auto-redirect dispatcher (extension 2026-07-27)

On mount, gates in order (1–3 pre-existing, unchanged):

1. `isLoggedIn` → `goHome()`
2. `needsSetup` (first-run gate) → `/setup` — must stay ahead of the auto-redirect
3. `?oidc=success` → return leg: hydrate claims → residency flow (never auto-redirect here)
4. `?welcome=1` → **pause**: show the success `UAlert` + the explicit `<LoginForm>` button
   (no auto-redirect — the post-invitation confirmation must be readable)
5. otherwise → `loginWithRedirect(returnTo?)` immediately, threading `route.query.returnTo`
   when `isSafeReturnTo`; render the redirecting state with the `<LoginForm>` fallback button

## Post-Login Flow
1. ZITADEL callback lands on `/auth/login?oidc=success` (sealed session cookie set,
   localStorage claims not yet)
2. `onMounted`: `refreshClaims()` hydrates claims via GraphQL, then `onLoginSuccess(user)`
3. If `claims.residentId` is set → `goHome()` immediately
4. If not → `fetchMyResidencies()` composable
   - 1 residency → `assumeResidency(id)` → `refreshClaims()` → `goHome()`
   - 2+ residencies → open `<ResidencySelectModal>` → user selects → `assumeResidency(id)` → `goHome()`
   - 0 residencies → the existing no-active-residency state

## Component: `ResidencySelectModal.vue`
Props: `open: boolean`, `residencies: Resident[]`, `loading?: boolean`
Emits: `update:open`, `select(residentId)`

- `<URadioGroup>` listing all residency options (label = tenant name, value = resident id)
- "Continue" button with `:loading` state — disabled until selection made
- Not dismissible (modal cannot be closed without selecting)

## User Interactions
| Action | Trigger |
|---|---|
| Sign in | Automatic on landing (auto-redirect gate 5); "Sign in with ZITADEL" button remains as manual fallback + the `?welcome=1` / `/auth/go/<id>` explicit paths |
| Select workspace | Radio button + Continue in modal |
| Redirect after login | Automatic — `navigateTo(returnTo)` if a valid `returnTo` rode the round-trip (§Return-to), else `goHome()` → home-app |
