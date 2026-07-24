# home-app/index — Landing Page Data

## Status
Implemented

## Route
`/` — see `index.ui.md` for UI details

## Data

**No server API calls.** All data comes from client-side composables backed by localStorage
(claims) and the DB-registered nav.

## Composables

### `useAuth()` — from `packages/auth-ui`
- `isLoggedIn: Ref<boolean>` — derived from whether `user` is non-null
- `user: Ref<ProfileClaims | null>` — held in **localStorage** (`useStorage('auth.user', …)`),
  hydrated from GraphQL via `refreshClaims()` (not a cookie)
- `refreshClaims()` — re-fetches `ProfileClaims` via GraphQL (`fetchProfileClaims`) into localStorage

`ProfileClaims` shape:
```ts
{ profileId, tenantId, residentId, actualResidentId,
  profileStatus, permissions, email, displayName, tenantName, modules }
```

### `useAppNav()` — from `packages/tenant-layer`
- `availableSections: ComputedRef<NavSection[]>` — derived from `ProfileClaims.modules`
- Filters nav entries by permission; groups tools under their module

### `useRuntimeConfig().public.authAppUrl`
- Public runtime config key pointing to the auth-app base URL (e.g. `http://localhost:4000/auth`)
- Used to construct the sign-in link: `${authAppUrl}/login`

## Types
Types: `ProfileClaims` comes from `@function-bucket/fnb-types` (via `useAuth`); `NavSection`/`NavItem` are defined in `packages/tenant-layer/app/composables/useAppNav.ts` — no db-types involved on this page.
