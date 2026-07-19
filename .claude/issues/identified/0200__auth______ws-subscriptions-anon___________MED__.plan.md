# Plan: GraphQL WebSocket subscriptions always resolve as `anon` — they can't authenticate

> **Execution Directive:** Implement via the `fnb-stack-implementor` + `postgraphile-5-expert` skills.
> Invoke: `/fnb-stack-implementor .claude/issues/identified/ws-subscriptions-anon.plan.md`
> Gate is `pnpm build`. Never run `git`; never rebuild Docker yourself — ask the user, then verify read-only.

**Severity: MEDIUM** (latent — no GraphQL subscriptions in use yet) · Workstream: WS3 (app auth) · Identified: 2026-07-05

## Details

`apps/graphql-api-app/server/graphile.config.ts` `grafast.context()` (lines ~51-87) reads
`event.context.claims` to build `pgSettings`. For WebSocket requests it constructs a **fresh
`H3Event` from the raw upgrade request** (lines ~58-66) because "middleware context not carried
over." The Nuxt/tenant-layer auth middleware (`applyEventClaims`) never runs against that synthetic
event, so `event.context.claims` is undefined → the context falls through to `role: 'anon'`
(line ~83).

Contrast the msg-layer realtime carve-out, which does **not** use GraphQL subscriptions — it
authenticates the WS upgrade itself via `packages/msg-layer/server/utils/getWsUpgradeClaims.ts`
(parses cookies from the upgrade request → claims). The GraphQL subscription path has no equivalent.

## Implication

Any GraphQL subscription resolves with anonymous privileges — under RLS it would see only
anon-visible rows (i.e. nothing tenant-scoped). Today there are no `.graphql` subscription documents
(`packages/graphql-client-api/src/graphql/**` has queries + mutations only), so this is **latent** —
but the moment someone adds a subscription (the obvious future for live data), it silently returns
empty results with no error, which is a painful debugging trap and a correctness gap.

## Suggested fix

1. Attach claims to the synthetic WS `H3Event` before `grafast.context()` runs, reusing the
   existing upgrade-auth logic: parse cookies from the raw upgrade request and resolve claims the
   same way `getWsUpgradeClaims.ts` does (that util takes only headers — see the fnb-create-app
   skill's WS note). Factor the cookie→claims resolution into a shared helper so the msg-layer WS
   path and the GraphQL subscription path use one implementation.
2. Set `event.context.claims` on the constructed event so the existing context bridge produces
   `role: 'authenticated'` for subscriptions.
3. Follow `postgraphile-5-expert` (references/security.md) for the canonical PostGraphile 5
   subscription auth pattern (grafast subscribe context vs per-operation context).
4. Until implemented, document "GraphQL subscriptions currently resolve as anon — do not rely on
   them for tenant data" in `.claude/specs/sockets-pattern.md` and the implementor skill (R21),
   since the realtime pattern doc should state which WS path is authenticated.

## Verification

- Add a throwaway authenticated subscription in a dev branch (or test with an existing schema
  subscription if PostGraphile auto-generates any): with a logged-in cookie, the subscription sees
  tenant data; logged out, it's empty. (Verification is exploratory since no subscription exists yet.)
- `pnpm build` green; msg-layer realtime (the non-GraphQL WS path) unaffected.
