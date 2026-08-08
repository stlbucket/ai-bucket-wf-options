# mobile-logout — Data

## Status
Implemented (reused) — no new data work. This spec adds a call site for an existing contract.

## Data contract — all reused, nothing new

This is a UI-shell-only change. **No DB, no GraphQL operation, no new composable, no new type.**
Everything the footer needs already exists on the `useAuth()` surface
(`packages/auth-ui/src/use-auth.ts`), the same surface the desktop `AppNav.vue` footer consumes.

| Symbol | Source | Shape / behavior |
|---|---|---|
| `user` | `useAuth()` (`packages/auth-ui/src/use-auth.ts`) | `Ref<ProfileClaims \| null>`; the footer reads `user.value?.displayName` for the name + `initials`. |
| `logout` | `useAuth().logout` | `() => Promise<void>`. POSTs `${authBase}/api/auth/logout` (server revokes the `auth.session` row + clears the sealed cookie), clears local `user`/claims in a `finally` (so the browser ends up logged out even if the network call rejects — 0180 Tier 1, `session-refresh-pattern.md`), then `navigateTo(.../api/auth/oidc/logout, { external: true })` for RP-initiated ZITADEL SSO end-session, which 302s back to the logged-out home. Fire-and-forget from the button — no local loading state (the redirect ends the page). |
| `closeNav` | `useAppNav()` | `() => void`; already in scope in `AppNavMobile.vue`. Called on the identity-row tap so the drawer dismisses before the external nav to `/auth/profile`. |

`initials` is a local `computed` in the component (copied verbatim from `AppNav.vue`), derived from
`user.value?.displayName` — not a data-layer concern.

## Auth requirements
The footer renders inside the `v-if="isLoggedIn"` `USlideover`, so it is only reachable by a
logged-in user. `logout` itself requires an active session (it revokes one); no permission gate.

## Open Questions
- None.
