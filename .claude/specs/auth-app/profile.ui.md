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
- Card grid (`md:grid-cols-2`, stack on mobile — UC5):
  - `<UserProfile :user="user" />` — from `packages/auth-layer`; displays profile info (claims only)
  - `<ChangePasswordForm />` — self-service password change (password-self-service spec)
  - `<NotificationPreferences />` — **SMS Phase 1** (added by the notifications spec):
    choose preferred method(s) + inline phone verification. Unlike the other two cards this one reads
    `notify` GraphQL. Spec: `.claude/specs/notifications/profile-preferences.ui.md` / `.data.md`.

## Data
All data comes from `useAuth()` composable — no server fetch on this page.

## User Interactions
| Action | Trigger |
|---|---|
| Navigate home | Home button |
