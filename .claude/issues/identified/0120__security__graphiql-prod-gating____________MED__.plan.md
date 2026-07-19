# Plan: GraphiQL and introspection are enabled unconditionally and publicly routed

> **Execution Directive:** Implement via the `fnb-stack-implementor` + `postgraphile-5-expert` skills.
> Invoke: `/fnb-stack-implementor .claude/issues/identified/graphiql-prod-gating.plan.md`
> Gate is `pnpm build`. Never run `git`; never rebuild Docker yourself — ask the user, then verify read-only.

**Severity: MEDIUM** · Workstream: WS3 (app auth) · Identified: 2026-07-05

## Details

`apps/graphql-api-app/server/graphile.config.ts:46` sets `graphiql: true` unconditionally. The
neighboring `explain` (line 47) and `watch` (line 50) options **are** gated to non-production
(`process.env.NODE_ENV !== 'production'`), but `graphiql` is not. Introspection is never disabled
(the Amber preset leaves it on by default).

`docker/nginx.conf:43-49` publicly routes `/graphql-api` and `/ruru-static`, so the GraphiQL IDE
(Ruru) is reachable at `localhost:4000/graphql-api` in every environment.

## Implication

In any non-dev deployment, the full GraphQL schema is browsable and the interactive IDE is exposed
to the public. Introspection + GraphiQL hand an attacker the complete API surface (every type,
field, mutation, relationship) for reconnaissance. RLS still gates data, but schema disclosure eases
targeting (e.g. finding `becomeSupport`, admin mutations, the exact shape of `insertAsset`). Defense
in depth says disable both in production.

## Suggested fix

1. Gate `graphiql` the same way `explain`/`watch` already are:
   `graphiql: process.env.NODE_ENV !== 'production'`.
2. Disable introspection in production. In PostGraphile 5 this is via the grafast/graphile-build
   options — consult `postgraphile-5-expert` (references/security.md) for the exact
   `disableIntrospection`/preset mechanism; wire it to the same NODE_ENV check.
3. Consider gating the `/ruru-static` nginx location behind the same env or removing it in prod
   builds (nginx config is env-agnostic today — may need a prod variant or an upstream 404 when
   graphiql is off).
4. Confirm `NODE_ENV` is actually set to `production` in real deployments (compose sets
   `development` — fine for local, but the gate is only meaningful if prod sets it correctly;
   note this in the deployment docs).

## Verification

- With `NODE_ENV=production` locally: `GET /graphql-api` → GraphiQL not served; an introspection
  query (`{ __schema { types { name } } }`) → rejected/empty.
- With `NODE_ENV=development`: GraphiQL still works for dev ergonomics.
- `pnpm build` green; user restarts stack; verified read-only.
