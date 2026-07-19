# db-types → fnb-db-access Conversion (pre-claims root of trust)

Status: **designed, not built.** Do the GraphQL conversions
(`0450__graphql___graphql-conversions_____________MED__.plan.md`) FIRST, then return to this.

## Why this package exists

Migrating off Kysely/Kanel. The entire live hand-written surface of `packages/db-types`
is ~16 symbols. Of those, 3 can **never** become GraphQL because they run before/around
the point where `event.context.claims` exists (GraphQL context requires claims already
present). These are the pre-claims "root of trust" and need a permanent server-side home:

- `loginUser` → `auth.login_user` (bcrypt; runs anonymously, creates the session)
- `profileClaimsForUser` → `app_fn.profile_claims_for_user` (SEC DEFINER; middleware
  bootstraps claims from the `session` cookie)
- `currentProfileClaims` → `app_fn.current_profile_claims` (SEC DEFINER; called during
  login / session-change)

`fnb-db-access` is that home. Everything else migrates to GraphQL (see
`0450__graphql___graphql-conversions_____________MED__.plan.md`); `withClaims`, `createDb`, `buildJwtPayload` retire as the
migration completes.

## Converged design decisions

- **Query mechanism**: raw `pg` (node-postgres). NOT Knex, NOT Kysely. The surface is a
  handful of fixed stored-function calls — no dynamic query-building need, so a builder
  earns nothing. `pg` + thin tagged helpers is lighter. (Reconsider Knex later only if a
  genuinely dynamic query appears.)
- **`ProfileClaims` type**: hand-write it IN `fnb-db-access` as the new source of truth.
  Do NOT import `ProfileClaim` from graphql-client-api — that inverts dependency direction,
  makes every field `Maybe<>`, and carries a required `__typename` (forcing `Omit`). It is
  only 10 flat fields.
- **Claims fetch (avoids composite-array parsing)**:
  `select to_jsonb(app_fn.current_profile_claims($1)) as claims` — pg auto-parses jsonb to
  a JS object; then recursively camelCase keys in JS to match existing output (nested
  `modules[]` / `tools[]` included). No custom pg-types composite-array parsers needed.
- **Signature**: single `uuid` param (profileId). `app.profile.id = auth.user.id`, so
  login's `user.id` and the others' `claims.profileId` are the same value — no behavior
  change.
- **Connection**: package owns its own `pg` Pool from `DATABASE_URL` (independent of
  db-types).
- **Package scaffold**: mirror the `packages/db-types` compiled-lib pattern (tsc + `@/`
  alias, package.json `exports`, `vitest.config.ts`, Docker `packages-watch` build/watch +
  healthcheck entries).

## Seed scope for the first pass

Start with `currentProfileClaims` (the original ask). `loginUser` and `profileClaimsForUser`
are the natural follow-ons into the same package.

## Refactor targets (4 call sites — note the 4th)

- `apps/auth-app/server/api/auth/login.post.ts`
- `apps/auth-app/server/api/tenants/exit-support.post.ts`
- `apps/auth-app/server/api/assume-residency.post.ts`
- `packages/auth-layer/server/utils/getEventClaims.ts`  ← 4th call site (not in original grep)

## Still to verify before implementing

- Exact `DATABASE_URL` / env wiring in auth-app server + `createDb` internals.
- db-types build/tsconfig/`@/`-alias-rewrite conventions and the Docker `packages-watch`
  build/watch + healthcheck entries to mirror.
- Whether `to_jsonb` key casing exactly matches the current CamelCasePlugin output
  (memory: CamelCasePlugin recursively camelCases nested `to_jsonb` keys).

## Verification (when built)

- `pnpm build` is the gate (repo-wide `pnpm lint` is known-broken).
- All 4 call sites compile and return the same `ProfileClaims` shape.
- Manual: log in, assume residency, enter/exit support mode; confirm the `auth.user` cookie
  claims (incl. nested `modules`) are byte-identical to the Kysely path.

## Sequencing

Blocked-by (soft): do `0450__graphql___graphql-conversions_____________MED__.plan.md` first — it shrinks db-types to just the
pre-claims trio, so this package lands with a clear, final scope and nothing else in flux.
