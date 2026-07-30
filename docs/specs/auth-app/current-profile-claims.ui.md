# auth-app/current-profile-claims — Profile Claims Debug Page UI

## Status
Implemented

## Route
`/auth/current-profile-claims` → `apps/auth-app/app/pages/current-profile-claims.vue`

## Required Permission
Authenticated (`middleware: 'auth'`).

## Layout
Full-viewport-height centered column:

- Heading: `Current Profile Claims`
- `<UserProfile :user="profileClaims" />` — reuses the UserProfile component to display claims returned from the server (reflects the server-side session, not just the cookie)

## Purpose
Development / diagnostic page. Shows the live `ProfileClaims` as computed server-side from the session cookie, useful for verifying claims after role changes (e.g. after `becomeSupport` or `assumeResidency`).
