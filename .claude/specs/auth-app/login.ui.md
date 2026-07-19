# auth-app/login — Login Page UI

## Status
Implemented (ZITADEL cutover 2026-07-08 — the password form is removed)

## Route
`/auth/login` → `apps/auth-app/app/pages/login.vue`

## Required Permission
None — public page. Redirects to home if already authenticated.

## Layout
Full-viewport-height centered column:

- Heading: `Sign in` (bold)
- Subheading: `Enter your credentials to continue.` (muted)
- `<LoginForm>` — from `packages/auth-layer`; a card with a single **"Sign in with ZITADEL"**
  button → `useAuth().loginWithRedirect()` (full-page redirect into the hosted login; no
  password fields, no emit)
- `<ResidencySelectModal>` — conditionally shown when user has multiple residencies

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
| Sign in | "Sign in with ZITADEL" button → hosted login ceremony |
| Select workspace | Radio button + Continue in modal |
| Redirect after login | Automatic — `goHome()` navigates to home-app |
