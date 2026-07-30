# E1 — Cookie Refresh Pattern After Session-Changing Operations

> **STALE (client transport) — read `graphql-api-pattern.md` first.** Claims no longer live in an
> `auth.user` cookie. After a session-changing operation the client calls
> `useAuth().refreshClaims()`, which re-fetches `ProfileClaims` via GraphQL into **localStorage**;
> only the httpOnly `session` cookie is managed server-side — and since issue 0010 it is a
> **sealed** (encrypted+authenticated) blob managed by auth-layer `server/utils/session.ts`, not
> raw JSON; `setAuthUserCookie`/`buildAuthCookieOptions` no longer exist. The 3-arg `withClaims`
> shown below is retired (`withClaims` is now 2-arg in `db-access`). The *set of operations* that
> require a claims refresh (below) is still accurate; the cookie mechanics are not.

Any operation that changes the active tenant, resident, or permission set must refresh the client's
claims so it reflects the new state immediately (historically: rewrite the `auth.user` cookie).

## Operations That Require Cookie Refresh

- `become_support` — switches to a support resident in a different tenant
- `exit_support_mode` — returns to the original home resident
- `assume_residency` — switches active tenant (multi-tenant users)
- Login — initial claims establishment (already handled in login.post.ts)

## The Pattern

```typescript
export default defineEventHandler(async (event) => {
  const { db, claims } = event.context
  if (!claims) throw createError({ statusCode: 401 })

  // 1. Execute the session-changing operation
  await withClaims(db, claims, (trx) =>
    appApi.becomeSupport(trx, targetTenantId)
  )

  // 2. Re-fetch fresh claims from DB
  const freshClaims = await appFn.profileClaimsForUser(db, claims.profileId!)

  // 3. Rewrite the auth.user cookie using the shared utility
  setAuthUserCookie(event, freshClaims)

  return { claims: freshClaims }
})
```

`setAuthUserCookie` lives in `packages/auth-layer/server/utils/auth-cookies.ts` and is
auto-imported in all layer apps. It sets `auth.user` as a non-httpOnly cookie (readable by
client JS) with consistent options (sameSite, maxAge, secure, domain) derived from
`runtimeConfig.cookieDomain`.

## Why the session Cookie Never Changes

The `session` cookie carries only `{ id: <profile uuid> }` (inside the 0010 sealed blob). The
user's auth identity never changes — only which tenant/resident they're operating as changes.
The server middleware re-derives claims from DB on every request via this unchanged session ID. So:

- `session` cookie = stable, never written after login
- `auth.user` cookie = must be refreshed whenever claims change

## Client-Side Sync

How the client syncs after a session-changing operation depends on the navigation type:

**Internal navigation** (e.g. `become_support` → `router.push`): call `fetchUser()` before
navigating so `useAuth().user` reflects the new claims without a full reload.

```typescript
await becomeSupportForTenant(t.id)
await fetchUser()          // re-syncs useAuth().user from the updated cookie
router.push('/admin')      // internal navigation — cookie already synced above
```

**External navigation** (e.g. `exit_support` → `goHome()`): `goHome()` calls
`navigateTo('/', { external: true })`, which is a full page reload. The browser re-reads
all cookies on reload, so `fetchUser()` beforehand is unnecessary.

```typescript
// useAuth().exitSupport() — from auth-ui/src/use-auth.ts
await fetch(exitSupportUrl, { method: 'POST' })
await goHome()   // external reload — no fetchUser() needed
```
