# Plan: `getEventClaims` uses the wrong claims function and parses the session cookie unguarded

> **Execution Directive:** Implement via the `fnb-stack-implementor` skill.
> Invoke: `/fnb-stack-implementor .claude/issues/identified/get-event-claims-hardening.plan.md`
> Gate is `pnpm build`. Never run `git`; never rebuild Docker yourself — ask the user, then verify read-only.

**Severity: MEDIUM** · Workstream: WS3 (app auth) · Identified: 2026-07-05

## Details

`packages/auth-layer/server/utils/getEventClaims.ts`:

```ts
const raw = getCookie(event, 'session')
const session = raw ? JSON.parse(raw) : undefined      // line 6 — no try/catch
const userId = session?.id as string | undefined
if (!userId) return { user: undefined, claims: undefined }
const claims = await currentProfileClaims(userId)      // line 11
```

Two problems:

1. **Unguarded `JSON.parse`** (line 6) — a malformed/truncated `session` cookie throws, propagates
   through `applyEventClaims`, and yields an unhandled **500 on every request** until the cookie is
   cleared. The WebSocket path does this correctly: `packages/msg-layer/server/utils/getWsUpgradeClaims.ts:21-27`
   wraps the DB call in try/catch and treats failure as unauthenticated.

2. **Wrong claims function.** The HTTP middleware calls `currentProfileClaims(userId)`, but:
   - `packages/db-access/src/mutations/profile-claims-for-user.ts:6-8` documents itself as *"The
     auth middleware / WS upgrade bootstraps claims from the session cookie's userId on every
     request"* and returns `undefined` when the user has no active residency.
   - `packages/db-access/src/mutations/current-profile-claims.ts:6` documents itself as *"called
     during login / session-change to assemble fresh claims"*, takes a **profileId**, and never
     returns undefined (`return normalizeClaims(camelCaseKeys(rows[0].claims))` — `rows[0].claims`
     null → `camelCaseKeys(null)` crash).
   - The WS path (`getWsUpgradeClaims.ts`) correctly uses `profileClaimsForUser`.

   So the two server entry points bootstrap claims differently, the HTTP one contradicts db-access's
   own doc comments, and a user with no active residency can crash the HTTP request path.

## Implication

A garbage cookie or a residency-less user takes down every page request with a 500 instead of
degrading to logged-out. The HTTP and WS auth paths having divergent semantics is a latent
correctness/security inconsistency (support-mode/no-residency edge cases resolve differently).

## Suggested fix

1. Wrap the cookie read/parse in try/catch (or, better, fold this into
   `session-cookie-signing.plan.md` — a sealed h3 session removes the raw `JSON.parse` entirely and
   returns undefined on tamper). Malformed/absent → `{ user: undefined, claims: undefined }`.
2. Switch the HTTP middleware to `profileClaimsForUser(userId)` to match the WS path and the
   documented design, and handle its `undefined` return (no residency → unauthenticated, not crash).
   Confirm with the user this is the intended semantics (the alternative — standardize on
   `currentProfileClaims` and make it null-safe — is also viable; the point is the two paths must
   agree). Whichever is chosen, update the db-access doc comments so code and docs match (this is
   the F3 doc-drift item).
3. Update `.claude/specs/graphql-api-pattern.md` (Auth Context) + `package-layers-pattern.md`
   (db-access "pre-claims trio" description) to name the single function the middleware uses.

## Verification

- Set a garbage `session` cookie in the browser → app treats you as logged out, no 500.
- A profile with no active residency → logged-out state, not a crash (check dozzle logs read-only).
- Normal login/nav unchanged; `pnpm build` green.
