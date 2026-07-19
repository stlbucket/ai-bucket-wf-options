# Plan: Session/token refresh — sliding renewal, expiry policy, deactivation propagation (spec-first)

> **Execution Directive:** Spec-first. Stage 1 runs via the `fnb-stack-spec` skill (author the
> spec; resolve every `[FILL IN]`/Open Question with the user before any code). Later stages run
> via `/fnb-stack-implementor <this-file>` ("this plan" — never a hardcoded directory path).
> Read `.claude/specs/future-auth/zitadel-login-pattern.md` (the as-built auth contract) first.
> Gate is `pnpm build`. Never run `git`; never rebuild/restart Docker yourself — ask the user,
> then verify read-only.

**Severity: MEDIUM (feature/security)** · Workstream: WS3 (app auth) · Identified: 2026-07-09

## Current state (verified 2026-07-09 — do not re-derive)

- ZITADEL tokens are consumed **once** in `callback.get.ts` (code exchange + userinfo) and
  discarded. No `offline_access` scope, no refresh token requested or stored, and **no post-login
  ZITADEL API calls exist anywhere** — there is currently nothing a classic OAuth refresh token
  would refresh.
- The sealed `session` cookie (issue 0010) has a **fixed 7-day lifetime enforced inside the
  seal** (`packages/auth-layer/server/utils/session.ts` → `SESSION_MAX_AGE`); there is no sliding
  renewal. Consequences: an active user is hard-logged-out at day 7 (mid-work, with a full-page
  bounce through the hosted login); an idle user's stolen cookie stays valid the full 7 days.
- **ZITADEL-side deactivation/deletion does not propagate**: an existing fnb session keeps
  working until seal expiry (claims are recomputed from the DB per request, so only app-side
  profile/resident blocking bites sooner). Overlaps open issue
  `0180__auth______logout-invalidation` (server-side revocation, deliberately deferred at 0010).

## Goal

A deliberate session-freshness policy: sliding renewal with explicit idle/absolute lifetimes,
and a decided (not accidental) story for how quickly IdP-side deactivation takes effect —
**without breaking the scenario-1 scope contract** ("ZITADEL handles only the login ceremony";
session lifetime is fnb's domain). Whether ZITADEL is consulted after login at all is the spec's
central decision, not a foregone conclusion.

## Stage 1 — Spec (via `fnb-stack-spec`, no code) — ✅ DONE 2026-07-09

`.claude/specs/future-auth/session-refresh-pattern.md` authored; all five Open Questions
resolved with the user (decisions recorded in the spec): **no IdP tokens** (extension point
only); **touch 1h / idle 24h / absolute 7d**; **app-side deactivation only**; renewal is a
throttled `last_seen_at` row-touch (no re-sealing, no Set-Cookie after login — WS parity free);
**0180 merged into this design** (`auth.session` table gives revocation + sliding lifetimes;
0180's Tier-1 logout fixes are in scope here). Stage 2+ implements per the spec's file
inventory: sqitch `00000000010290_session`, db-access wrappers, getEventClaims /
getWsUpgradeClaims swap to `claimsForSession(sid)`, callback/logout/use-auth changes, R21 docs.

Original stage-1 brief (resolved):

Author `.claude/specs/future-auth/session-refresh-pattern.md` (companion to
`zitadel-login-pattern.md`; update that spec's scope-contract wording in the same change if the
decisions extend it). Open Questions the spec must resolve with the user:

1. **Does fnb ever need ZITADEL access tokens post-login?** Today: no consumer. If NO (likely),
   `offline_access`/refresh-token storage is out entirely and "refresh" means *session renewal*,
   not OAuth token refresh. If YES (future: calling ZITADEL mgmt APIs as the acting user),
   design server-side-only encrypted storage — tokens must never reach the browser.
2. **Sliding-session policy**: renewal trigger (e.g. re-seal when seal age > N hours on an
   authenticated request), **idle timeout** (cookie dies after N days without activity) and
   **absolute cap** (re-authentication required after N days regardless). Recommend something
   like renew-after-24h / idle-7d / absolute-30d — numbers are the user's call.
3. **Deactivation propagation**: (a) app-side only — block the profile/resident in fnb, claims
   die on the next request; ZITADEL stays login-only (cleanest fit with the scope contract);
   (b) re-validate against ZITADEL at renewal time (silent `prompt=none` re-auth, session API,
   or stored-refresh-token rotation as a liveness probe) — tighter IdP coupling, new failure
   modes when ZITADEL is down; (c) defer to 0180's server-side session store. Pick one.
4. **Renewal mechanics**: where re-sealing happens (`applyEventClaims` middleware is the natural
   choke point), Set-Cookie behavior on SSR/API/streamed responses, WS-upgrade path parity
   (`getWsUpgradeClaims` reads but cannot set cookies), and renewal stampede/idempotency on
   parallel requests.
5. **Relationship to 0180**: a server-side session table would deliver revocation + idle
   tracking + propagation in one structure — decide whether 0185 and 0180 merge into a single
   design or stay sequenced (and if sequenced, which lands first).

Flip the spec's status only when no `[FILL IN]`/Open Questions remain.

## Stage 2+ — Implementation (via `fnb-stack-implementor`, shaped by the spec)

**Status 2026-07-09: implemented, `pnpm build` green — pending DB deploy + restart + the spec's
verification block.** Everything in the spec's file inventory landed: sqitch
`00000000010290_session` (table + `create_session`/`claims_for_session`/`revoke_session` +
`app_api.revoke_my_sessions`), db-access wrappers, `{ id, sid }` seal, `getEventClaims`/
`getWsUpgradeClaims` swapped to `claimsForSession(sid)`, callback `createSession`, logout
revocation + auth-ui `finally`, R21 docs (both specs, both pattern files, implementor skill).
Remaining: user runs `db-migrate` + app restart, then read-only verification per the spec.

Expected surface (subject to stage-1 decisions): `session.ts` (renewal + separate idle/absolute
enforcement inside the seal payload), `applyEventClaims`/`getEventClaims`, possibly a sessions
table + sqitch change (if merged with 0180), `zitadel-login-pattern.md` + pattern docs + skills
updates in the same change (R21). One stage per session; each ends `pnpm build` green with its
verification block satisfied.

**Verify (sketch):** active user crosses the old 7-day boundary without logout; idle session
past the idle timeout reads as unauthenticated; absolute cap forces the hosted-login bounce;
deactivation path takes effect within the spec'd window; tampered/stale renewal attempts fail
closed; WS path unaffected; `pnpm build` green.

## Explicit non-goals (this plan)

Storing ZITADEL tokens in the browser (never); per-tenant SSO/IdP work; login-v2 migration;
production TLS topology; anything that moves licensing/claims authority out of fnb.
