# auth-app/profile — User Profile Page Data

## Status
Implemented

## Route
`/auth/profile` — see `profile.ui.md` for UI details

## Data

**No direct API calls from the page.** It reads `const { user } = useAuth()` and renders
`<UserProfile :user="user!" />`. `user` is the `ProfileClaims` held in **localStorage** by
`useAuth()` (hydrated from GraphQL via `refreshClaims()`) — there is no `fetchUser()` and no
`auth.user` cookie.

### Password change — removed (ZITADEL cutover 2026-07-08)
Password management is ZITADEL self-service now. `<ChangePasswordForm>`, `useAuth().changePassword()`
and `POST /api/auth/change-password` are deleted (superseded issue
`0070__auth______change-password-stub`).

## Types
`ProfileClaims` from `@function-bucket/fnb-types` (hand-written source of truth).
