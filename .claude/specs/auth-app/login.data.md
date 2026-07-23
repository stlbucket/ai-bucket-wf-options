# auth-app/login — Login Page Data

## Status
Implemented (ZITADEL cutover 2026-07-08 — password login removed; see
`.claude/specs/future-auth/zitadel-login-pattern.md` for the full OIDC contract)

## Route
`/auth/login` — see `login.ui.md` for UI details

auth-app is the auth root of trust, so it keeps a small Nitro `server/` (the OIDC
redirect/callback/logout routes, POST logout, and the claims middleware). Everything else is GraphQL.

## API — OIDC login (H3, root-of-trust)

Authentication is ZITADEL's hosted login (OIDC code+PKCE). Routes in
`apps/auth-app/server/api/auth/oidc/`:

| Route | Purpose |
|---|---|
| `GET /api/auth/oidc/login` | PKCE verifier + state in short-lived httpOnly cookies, 302 to `/oauth/v2/authorize` |
| `GET /api/auth/oidc/callback` | state check, code exchange + id_token verify (openid-client, internal-URL override), `email_verified` gate, `provisionIdpUser` (db-access raw pg), sets the **sealed** httpOnly `session` cookie `{ id: <profile uuid> }`, 302 → `/auth/login?oidc=success` |
| `GET /api/auth/oidc/logout` | clears cookies, 302 to `/oidc/v1/end_session` (client_id variant, registered post-logout URI = stack home) |
| `POST /api/auth/logout` | clears the sealed session (client calls this, then navigates to the OIDC logout route) |

- Claims are **not** written to a cookie (the full JSON overflows the header → nginx 502); the
  client fetches them via GraphQL into localStorage.
- Client: `useAuth().loginWithRedirect()` starts the ceremony; the login page handles
  `?oidc=success` (hydrate claims → residency flow). `login(email, pwd)` / `changePassword` are
  removed (`auth.login_user` / `auth.user` are dropped; ZITADEL owns credentials).

## Return-to after login (post-login redirect target)

By default the ceremony always lands the user on the stack home (`/`) after the residency flow
(`goHome()`). Some entry points need the user returned to **where they started** instead — the
motivating case is the deep-link landing page `/auth/go/<id>` (`.claude/specs/otp-login/`): its
"Sign in with ZITADEL" button must round-trip the ceremony and come **back to the deep link**, so
the go page's already-logged-in path (State D) can forward the user to the item. Without a carrier
the callback hard-redirects to `/auth/login?oidc=success` and `goHome()` sends them to `/`, losing
the item. (The OTP path has no such problem — it is a self-contained page redirect.)

A **`returnTo` root-relative path** is threaded through the round-trip:

1. **Client.** `useAuth().loginWithRedirect(returnTo?: string)` — when `returnTo` is a non-empty
   string it appends `?returnTo=<encodeURIComponent(path)>` to the `/api/auth/oidc/login` URL.
   `LoginForm.vue` (`packages/auth-layer`) gains an optional `returnTo` prop and forwards it to
   `loginWithRedirect(props.returnTo)`. Bare `loginWithRedirect()` / `<LoginForm />` is unchanged
   (→ home).
2. **`GET /api/auth/oidc/login`.** Reads `returnTo` from the query; when `isSafeReturnTo(returnTo)`,
   parks it in a short-lived httpOnly cookie `oidc_return_to` (same flags + `maxAge` as the existing
   `oidc_verifier` / `oidc_state` transaction cookies). Invalid/absent → no cookie parked.
3. **`GET /api/auth/oidc/callback`.** After minting the session, reads **and deletes**
   `oidc_return_to`. Composes the post-login redirect as `/auth/login?oidc=success` **plus**
   `&returnTo=<encoded path>` when the cookie was present and still `isSafeReturnTo`. It stays a
   query param on the `/login` hop (not a direct jump to `returnTo`) because `/login` owns claims
   hydration + residency selection — the round-trip must pass through it.
4. **`/auth/login` (`login.vue`).** After `onLoginSuccess` resolves claims + residency, if
   `route.query.returnTo` is present and `isSafeReturnTo`, it does
   `navigateTo(returnTo, { external: true })` **instead of** `goHome()`. Applied on both the
   single-residency auto-select and the modal-select paths. Invalid/absent → `goHome()` (unchanged).

**Security — open-redirect safe, fail-closed.** `isSafeReturnTo(p)` (a small shared helper usable
server- and client-side): `p` is a string that starts with exactly one `/` (root-relative — **not**
`//` protocol-relative, **not** `\`), contains no control characters, and is within a sane length
cap. It is validated at **both** park time (step 2) and consume time (step 4) — a value that fails
either check is dropped and login falls back to home. `returnTo` never carries an absolute URL or a
foreign origin.

**Why a cookie (not the OIDC `state`):** mirrors the existing `oidc_verifier` / `oidc_state`
httpOnly-cookie pattern; ZITADEL does not round-trip arbitrary app params, and `state` is reserved
for CSRF (openid-client-managed).

## GraphQL — residency (post-login)

The former REST routes (`GET /api/my-residencies`, `POST /api/assume-residency`) were deleted once
claims stopped being cookie-backed. Residency ops now run through GraphQL:

| Operation | `.graphql` file | Generated hook / fn | Notes |
|---|---|---|---|
| Fetch my residencies | `app/query/myProfileResidencies.graphql` | `fetchMyProfileResidencies(client)` | when no active residency |
| Assume residency | `app/mutation/assumeResidency.graphql` | `assumeResidency(client, residentId)` | then `useAuth().refreshClaims()` |

Both are imperative helpers in `graphql-client-api` (`useResidency.ts`) that take a urql `Client`.

## Composable
`apps/auth-app/app/composables/useLoginFlow.ts` — thin wrappers over the GraphQL helpers:

| Export | Shape | Usage |
|---|---|---|
| `fetchMyResidencies(client)` | `Promise<ProfileResidency[]>` (→ `fetchMyProfileResidencies`) | post-login when no active residency |
| `assumeResidency(client, residentId)` | `Promise<void>` (→ GraphQL `assumeResidency`) | on residency selection; caller then `refreshClaims()` |

## Types
`ProfileClaims` from `@function-bucket/fnb-types` (hand-written).
`ProfileResidency` from `@function-bucket/fnb-graphql-client-api` (`useResidency.ts`).
