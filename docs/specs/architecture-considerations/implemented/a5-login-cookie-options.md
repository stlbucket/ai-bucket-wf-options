# A5 — Login Cookie Options & the Two-Cookie Architecture

> **STALE (fully historical) — read `graphql-api-pattern.md` → Auth Context.** There is **no
> two-cookie architecture** anymore. Login sets **only** the httpOnly `session` cookie; the
> `auth.user` claims cookie was dropped (the full JSON overflowed the response header → nginx 502).
> Claims now live in **localStorage**, fetched via GraphQL (`useAuth().refreshClaims()`). And since
> issue 0010 the `session` cookie value is a **sealed blob** (h3 `useSession` + iron-webcrypto, via
> auth-layer `server/utils/session.ts` — `secure: true` unconditionally, 7d maxAge enforced inside
> the seal), NOT the raw JSON shown below. Everything below is historical.

## Cookie Settings (exact values)

Historically both cookies were set by `apps/auth-app/server/api/auth/login.post.ts` (now only `session`):

```typescript
const cookieOptions = {
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 7,   // 7 days
  secure: process.env.NODE_ENV === 'production',
  domain: cookieDomain || undefined,
}

// session cookie — server's source of truth
setCookie(event, 'session', JSON.stringify({ id: user.id }), {
  ...cookieOptions,
  httpOnly: true,
})

// auth.user cookie — client-side convenience cache
setCookie(event, 'auth.user', JSON.stringify(profileClaims), {
  ...cookieOptions,
  httpOnly: false,
})
```

## Two-Cookie Design

| Cookie | httpOnly | Contains | Purpose |
|--------|----------|----------|---------|
| `session` | true (JS cannot read) | `{ id: auth.user.id }` | Server's source of truth; never stale |
| `auth.user` | false (JS can read) | Full `ProfileClaims` JSON | Client-side cache for `useAuth()` |

**The auth.user cookie can be stale.** It is a convenience cache written at login. The server
middleware re-fetches fresh claims from the DB on every request via the session cookie. This is
why permission changes (e.g. a license being revoked) take effect immediately server-side even
if the client's `useAuth().user` still shows old permissions.

**After session-changing operations** (become_support, exit_support_mode, assume_residency),
the server must explicitly rewrite the `auth.user` cookie with fresh claims so the client
doesn't show stale state. The session cookie is never changed — the same user ID is always
valid; only which claims it resolves to changes.

## Where cookieDomain Comes From

`const { cookieDomain } = useRuntimeConfig(event)` — set via env var `NUXT_COOKIE_DOMAIN`.
In local Docker dev this is unset (empty string → undefined → cookie scoped to host).
In production this should be set to the shared domain (e.g. `.example.com`) so cookies
work across subdomains if needed.
