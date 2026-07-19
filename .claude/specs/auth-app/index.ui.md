# auth-app/index — Entry Redirect

## Status
Implemented

## Route
`/auth/` → `apps/auth-app/app/pages/index.vue`

## Required Permission
None — public.

## Layout
No rendered UI — redirect only.

## Behavior
- Authenticated → `goHome()` (navigates to home-app at `/`)
- Unauthenticated → `navigateTo('/login')` (redirects to `/auth/login`)

The auth-app has no meaningful "home" of its own; `/auth/` always bounces users to the right place.
