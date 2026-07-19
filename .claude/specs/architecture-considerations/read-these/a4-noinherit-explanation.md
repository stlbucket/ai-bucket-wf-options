# A4 — NOINHERIT: Why authenticator Must Not Inherit authenticated

The DB connection string uses the `authenticator` role. This role is `NOINHERIT`.

## The Problem Without NOINHERIT

If `authenticator` inherited from `authenticated`, then any Kysely query run **outside** a
`withClaims` transaction would automatically execute as `authenticated`. RLS policies would
fire — but `current_setting('request.jwt.claims', true)` would return NULL because no claims
have been set.

Result: `auth.has_permission(...)` would return false for every check (NULL comparisons), and
`auth.uid()` would return NULL. Every RLS policy would silently return zero rows, or worse,
could behave unpredictably depending on the policy logic.

## The Solution: NOINHERIT

With `NOINHERIT`, `authenticator` has **no** inherited privileges from `authenticated`.
Queries run outside `withClaims` execute as `authenticator` directly, which has only the
specific grants it needs (EXECUTE on SECURITY DEFINER functions like
`app_fn.profile_claims_for_user`).

This is why the middleware bootstrap flow works:
1. Middleware reads session cookie → calls `appFn.profileClaimsForUser(db, userId)` directly
   (no withClaims needed — the function is SECURITY DEFINER, granted to authenticator)
2. Claims assembled → passed into `withClaims` for every subsequent DB query
3. Inside `withClaims`: `SET ROLE authenticated` + set claims → RLS fires correctly

## Role Hierarchy
```
postgres (superuser)
  └── authenticator (NOINHERIT, LOGIN)   ← app connection role
        ├── GRANT authenticated TO authenticator   ← can SET ROLE to it
        └── GRANT anon TO authenticator            ← for public endpoints
```

`authenticator` can `SET ROLE authenticated` (inside `withClaims`) but does NOT inherit
its privileges passively. Outside `withClaims`, it runs as itself.
