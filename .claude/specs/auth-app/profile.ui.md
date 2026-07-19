# auth-app/profile — User Profile Page UI

## Status
Implemented

## Route
`/auth/profile` → `apps/auth-app/app/pages/profile.vue`

## Required Permission
Authenticated (`middleware: 'auth'`).

## Layout
Full-viewport-height centered column:

- Heading: `Your Profile`
- Home link: `<UButton to="/" external icon="i-lucide-house" label="Home" variant="ghost" />`
- Single centered card (`max-w-md mx-auto`):
  - `<UserProfile :user="user" />` — from `packages/auth-layer`; displays profile info
  - (`<ChangePasswordForm>` was removed at the ZITADEL cutover — password management is
    ZITADEL self-service)

## Data
All data comes from `useAuth()` composable — no server fetch on this page.

## User Interactions
| Action | Trigger |
|---|---|
| Navigate home | Home button |
