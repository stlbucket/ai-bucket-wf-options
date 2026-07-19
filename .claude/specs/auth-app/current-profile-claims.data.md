# auth-app/current-profile-claims — Profile Claims Debug Page Data

## Status
Removed / superseded — the standalone debug page, its `GET /api/current-profile-claims` Nitro
route, and the `useCurrentProfileClaims` composable no longer exist (auth-app pages are now
`index`, `login`, `ping`, `profile`; the composable file is empty).

## Where claims live now
The current profile's claims are held in **localStorage** by `useAuth().user`
(`packages/auth-ui/src/use-auth.ts`), hydrated from GraphQL:
- Query `CurrentProfileClaims` (`packages/graphql-client-api/src/graphql/app/query/currentProfileClaims.graphql`)
- Assembled by `fetchProfileClaims(client)` (`packages/graphql-client-api/src/composables/useProfileClaims.ts`)
  into the hand-written `ProfileClaims` shape (`@function-bucket/fnb-db-access`)
- Refreshed via `useAuth().refreshClaims()` on login / session change / hydration

Server-side, per-request claims are still derived from the **sealed** `session` cookie
(`currentProfileClaims` in `db-access`, via the auth middleware) for authz/RLS — but there is no
longer a page or REST route that returns them to the client. Sessions are minted only by the
ZITADEL OIDC callback (`zitadel-login-pattern.md`); the cookie carries the `app.profile` id.

## Types
`ProfileClaims` from `@function-bucket/fnb-types` (hand-written source of truth).
