# Plan: Session cookie is unsigned plaintext — identity forgeable given a user UUID

> **Execution Directive:** Implement via the `fnb-stack-implementor` skill.
> Invoke: `/fnb-stack-implementor .claude/issues/identified/session-cookie-signing.plan.md`
> Gate is `pnpm build`. Never run `git`; never rebuild Docker yourself — ask the user, then verify read-only.

**Severity: CRITICAL** · Workstream: WS3 (app auth) · Identified: 2026-07-05

## Details

- `apps/auth-app/server/api/auth/login.post.ts:26` sets the session cookie as raw JSON:
  `setCookie(event, 'session', JSON.stringify({ id: user.id }), ...)` — no signature, no MAC,
  no encryption, no expiry claim inside the value (only the cookie's own `maxAge` 7d).
- `packages/auth-layer/server/utils/getEventClaims.ts:5-11` reads it back with `JSON.parse` and
  trusts `session.id` directly: `const claims = await currentProfileClaims(userId)`.
- There is no server-side session store — the cookie **is** the session. Logout
  (`logout.post.ts`, a stub per its own TODO at line 7) only deletes the cookie; a captured cookie
  value remains valid forever (no expiry server-side, no revocation).

Cookie flags (`packages/auth-layer/server/utils/auth-cookies.ts`): `httpOnly` (at call sites),
`sameSite: 'lax'`, `secure` only when `NODE_ENV==='production'` (line 8) — compose runs all apps as
`development`, so in Docker the cookie travels over plain HTTP.

## Implication

Anyone who can present `session={"id":"<uuid>"}` is that user. UUIDs are not secrets: they appear in
GraphQL responses (resident/profile ids), logs, URLs, and — per `fn-schema-grant-bypass.plan.md` —
`app_fn.current_profile_claims` currently hands out profile data to anon callers. Forging admin
identity requires only learning an admin's profile uuid. Additionally: no expiry-on-the-value means
`maxAge` is advisory (a client can replay an old cookie), and no revocation means compromised
sessions cannot be killed.

## Suggested fix

Use h3's built-in sealed session (iron-webcrypto) rather than hand-rolling HMAC:

1. Replace manual cookie handling with h3 `useSession(event, { password: runtimeConfig.sessionSecret, name: 'session', maxAge: 60*60*24*7, cookie: { sameSite: 'lax', secure: true } })`
   in `login.post.ts` (write `{ id }` via `session.update`), `logout.post.ts` (`session.clear()`),
   and `getEventClaims.ts` (read the sealed session instead of `getCookie` + `JSON.parse`).
   Sealed sessions are encrypted+authenticated and carry their own expiry — solves forgery, replay
   beyond maxAge, and the unguarded-JSON.parse issue (`get-event-claims-hardening.plan.md`) in one move.
2. Add `sessionSecret` to `runtimeConfig` (server-only) in the auth-layer `nuxt.config.ts` with env
   override `NUXT_SESSION_SECRET`; add the env var to every app service in `docker-compose.yml`
   (all apps that extend tenant-layer parse the session). Fail closed: throw at startup if unset in
   production.
3. Keep the same claims flow afterward (`event.context.claims` via `applyEventClaims`) — no changes
   to db-access or the GraphQL layer.
4. Update `packages/auth-layer/server/utils/auth-cookies.ts` (may shrink to nothing) and the specs
   that document the cookie (`.claude/specs/graphql-api-pattern.md` Auth Context section,
   `package-layers-pattern.md` auth-layer inventory, `e1-cookie-refresh-pattern.md`) — R21: specs +
   skills updated in the same change.
5. Out of scope here, note for future: true server-side revocation (session table) — deliberately
   deferred; sealed cookies + 7d expiry is the 80/20.
6. Decide `secure` policy: prefer `secure: true` unconditionally + document that local Docker uses
   http://localhost (browsers exempt localhost) — verify login still works in the dev stack.

## Verification

- Login via the running app: cookie value is an opaque sealed blob, not JSON.
- Tampered/forged cookie (`session={"id":"<uuid>"}` or modified blob) → treated as unauthenticated
  (401/anon), not 500.
- Logout clears; re-presenting the old sealed value after `maxAge` → unauthenticated.
- `pnpm build` green; user restarts Docker; login/logout/nav smoke read-only.
