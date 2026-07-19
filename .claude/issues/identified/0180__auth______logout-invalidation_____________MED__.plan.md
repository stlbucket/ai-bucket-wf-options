# Plan: Logout is a stub — clears the cookie only, no server-side session invalidation

> **Execution Directive:** Implement via the `fnb-stack-implementor` skill.
> Invoke: `/fnb-stack-implementor .claude/issues/identified/logout-invalidation.plan.md`
> Gate is `pnpm build`. Never run `git`; never rebuild Docker yourself — ask the user, then verify read-only.

**Severity: MEDIUM** · Workstream: WS3 (app auth) · Identified: 2026-07-05

> **MERGED into 0185 (2026-07-09):** the approved design
> `.claude/specs/future-auth/session-refresh-pattern.md` delivers this issue in full — Tier 1
> (deterministic logout + client claims cleared in `finally`) and Tier 2 (the `auth.session`
> table, `revoke_session`, and `revoke_my_sessions` "log out everywhere"). Implement via 0185's
> stages; close this plan when that lands.

## Details

`apps/auth-app/server/api/auth/logout.post.ts` carries a TODO (line 7) and only deletes the
`session` cookie client-side. Because the cookie **is** the session (no server-side session store —
see `session-cookie-signing.plan.md`), a copy of the cookie value captured before logout stays valid
until its `maxAge` (7 days) elapses. Logout provides no revocation.

The client side compounds this: `packages/auth-ui/src/use-auth.ts` `logout` (lines 61-65) sets
`user.value = null` **after** the network call with no try/finally, so if the logout request rejects,
local claims are never cleared (tracked in `auth-ui-hardening.plan.md`).

## Implication

"Log out everywhere" / "kill this session" is impossible. A leaked or stolen session cookie cannot
be invalidated short of waiting out the expiry or rotating the signing secret (which logs everyone
out). For an app handling multi-tenant admin/support-mode capabilities, non-revocable sessions are a
real gap.

## Suggested fix

This is genuinely coupled to the session model. Two tiers:

**Tier 1 (cheap, do now):** make logout deterministic and complete.
1. `logout.post.ts`: clear the sealed session (`session.clear()` once
   `session-cookie-signing.plan.md` lands) and return 200 unconditionally.
2. auth-ui `logout`: clear local claims in a `finally` regardless of network outcome
   (see `auth-ui-hardening.plan.md`).

**Tier 2 (real revocation, decide with user — may be a separate effort):**
1. Introduce a server-side session table (`auth.session`: id, user_id, created_at, expires_at,
   revoked_at) — one sqitch change. The cookie carries the opaque session id (already sealed), and
   `getEventClaims` checks the row is present and not revoked/expired before assembling claims.
2. Logout sets `revoked_at`. Add a "log out all sessions" that revokes every row for the user.
3. This also enables session expiry cleanup (a graphile-worker cron task — see
   `graphile-worker-expert` skill for cron config) and `last_sign_in_at` tracking.

Recommend Tier 1 this pass; capture Tier 2 as a follow-up spec if the user wants revocation.

## Verification

- Tier 1: logout always returns 200; local claims cleared even when the endpoint is made to fail;
  re-navigating requires login.
- Tier 2 (if done): a second browser holding the old cookie is logged out after server-side revoke.
- `pnpm build` green; user restarts stack; verified read-only.
