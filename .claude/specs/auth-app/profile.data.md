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

### Notification preferences — added (SMS Phase 1, notifications spec)
The `<NotificationPreferences>` card **does** read/write `notify` GraphQL (the page's one data-bound
card): `notify.channel_preference` via `useNotificationPreferences()`, plus the phone-verification
round-trip (`triggerWorkflow('phone-verification')` + `verify_phone_code`). This is the only fetch on
an otherwise claims-only page. Full contract: `.claude/specs/notifications/profile-preferences.data.md`.

## Types
`ProfileClaims` from `@function-bucket/fnb-types` (hand-written source of truth). `ChannelPreference`
(also from `fnb-types`) backs the notification-preferences card.
