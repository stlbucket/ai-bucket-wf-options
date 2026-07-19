# Plan: auth-ui `useAuth()` hardening — logout/refresh error handling, concurrency, login rate limiting

> **Execution Directive:** Implement via the `fnb-stack-implementor` skill.
> Invoke: `/fnb-stack-implementor .claude/issues/identified/auth-ui-hardening.plan.md`
> Gate is `pnpm build`. Never run `git`; never rebuild Docker yourself — ask the user, then verify read-only.

**Severity: MEDIUM** · Workstream: WS3 (app auth) · Identified: 2026-07-05

## Details

`packages/auth-ui/src/use-auth.ts` (claims mirrored to localStorage via
`useStorage('auth.user', ...)` at line 26):

1. **`logout` (lines 61-65)** sets `user.value = null` **after** the network call, no try/finally.
   If `fetch(logoutApiUrl)` rejects, local claims are never cleared → user appears logged in with
   stale claims. (Related: `logout-invalidation.plan.md`.)
2. **`refreshClaims` (lines 50-52)** has no error handling — a thrown urql error propagates raw to
   every caller (login, exitSupport, hydrate plugin). No guard against concurrent calls: the login
   flow and `app/plugins/hydrate-claims.client.ts` can both call it during hydration → last write
   wins, possible flof stale-then-fresh or fresh-then-stale.
3. **`login` (lines 54-59)** catches nothing — a failed claims fetch after a successful credential
   check leaves the user in a half-authenticated state (session cookie set, no local claims).
4. **`changePassword` (lines 67-72)** does not call `refreshClaims()` afterward — if a password
   change ever alters session/claims (see `change-password-stub.plan.md`), the client goes stale.
5. **`useNuxtApp() as unknown as { $urqlClient: unknown }` (line 46)** — untyped access to the urql
   client; a missing provider fails only at call time with an opaque error.
6. **No login rate limiting anywhere** (server side — `apps/auth-app/server/api/auth/login.post.ts`
   has no throttle/lockout; brute-force is open). Bcrypt in the DB is correct but slow-hash ≠ rate
   limit.

## Implication

Failed logout leaves a "logged-in" UI with stale permissions (worst case in support mode — the
elevated claims linger). Unhandled refresh/login errors surface as raw crashes or half-auth states.
The concurrency gap makes hydration races non-deterministic. Open login brute-force is a standing
credential-stuffing risk.

## Suggested fix

Client (`packages/auth-ui/src/use-auth.ts`):
1. `logout`: clear `user.value` + localStorage in a `finally` regardless of network outcome.
2. `refreshClaims`: wrap in try/catch; on error, decide policy (keep last-known vs clear — likely
   clear + log). Add a simple in-flight guard (module-scoped `Promise` dedupe) so concurrent callers
   share one fetch.
3. `login`: catch a post-credential claims-fetch failure and surface a clean error / rollback.
4. `changePassword`: `await refreshClaims()` on success (coordinate with `change-password-stub.plan.md`).
5. Type `$urqlClient` properly (declare the Nuxt injection type) instead of the double-cast.

Server (login rate limiting):
6. Add rate limiting to `login.post.ts` — options: an in-memory/redis sliding-window limiter keyed
   by IP + email, or a DB-backed attempt counter with exponential backoff/lockout on `auth.user`.
   Decide the store with the user (no redis in the stack today; a DB attempts table via one sqitch
   change is self-contained). Generic error preserved (no user enumeration — already good at
   `login.post.ts:20`).

## Verification

- Force the logout endpoint to fail → UI still returns to logged-out, localStorage `auth.user` cleared.
- Trigger login + hydrate simultaneously → one claims fetch, consistent final state.
- Hammer login with wrong password N times → throttled/locked per chosen policy; correct password
  after cooldown still works.
- `pnpm build` green; user restarts stack; verified read-only.
