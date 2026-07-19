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
