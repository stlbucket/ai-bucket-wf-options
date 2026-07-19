# future-auth: Session Refresh — server-side sessions, sliding lifetimes, revocation

## Status
**Implemented 2026-07-09** (pending DB deploy + stack restart verification). All Open Questions
were resolved with the user (see **Decisions**); no `[FILL IN]` markers remain. Companion to
`zitadel-login-pattern.md` (the as-built login contract).
Plans: `.claude/issues/identified/0185__auth______session-token-refresh___________MED__.plan.md`
(this design) and `0180__auth______logout-invalidation_____________MED__.plan.md` (**merged
into this design** — the session table delivers its Tier 2, and its Tier 1 items are in scope
here).

## Scope contract

- ZITADEL still handles **only the login ceremony** (unchanged from `zitadel-login-pattern.md`).
  Session lifetime, renewal, and revocation are **fnb's domain**: no post-login ZITADEL calls,
  no `offline_access` scope, no refresh tokens (see Decisions — extension point only).
- The httpOnly **sealed `session` cookie remains the root of trust**, but its payload grows from
  `{ id: <profile uuid> }` to `{ id: <profile uuid>, sid: <session uuid> }` and validity is now
  decided by the **server-side session row**, not the seal's `maxAge` alone.
- Claims are still recomputed from the DB per request (`ProfileClaims` → `pgSettings` → RLS);
  this design changes *whether* a request is authenticated, never *what* the claims contain.
- The **client-side localStorage mirror** of the claims is revalidated against this session
  authority on every app boot — stale/dead-session mirrors are cleared and the browser lands on
  the home hero. See `claims-revalidation-pattern.md` (companion to this file).
- Deactivation authority is **app-side**: blocking a profile/resident in fnb kills live sessions
  on the next request (as today). ZITADEL-side deactivation only blocks the next login ceremony
  — which the absolute cap forces within 7 days (see Lifetimes).

## Decisions (Open Questions resolved with the user, 2026-07-09)

- [x] **IdP tokens post-login** → **not now, designed extension point.** No `offline_access`,
      no token storage. If fnb ever calls ZITADEL APIs as the acting user, encrypted token
      columns hang off `auth.session` (or a sibling table) **server-side only** — the session
      row is the natural anchor; tokens never reach the browser. Nothing else in this design
      moves when that lands.
- [x] **Lifetimes** → **tight: touch-throttle 1h / idle 24h / absolute 7d.** See Lifetimes.
- [x] **Deactivation propagation** → **app-side blocking only.** Block the profile/resident in
      fnb; claims die on the next request. No ZITADEL liveness probes, no IdP-down failure
      modes. (The absolute cap adds an implicit IdP re-check: re-login can't complete for a
      ZITADEL-deactivated user.)
- [x] **Relationship to 0180** → **merged.** One design: the `auth.session` table provides
      sliding lifetimes *and* revocation. 0180's Tier 1 (deterministic logout, client claims
      cleared in `finally`) ships here too.
- [x] **Renewal mechanics** (design, not a user call) → **no re-sealing.** Because validity
      lives in the row, the cookie is written **once at login** and never again. "Renewal" is a
      throttled `last_seen_at` touch inside the same DB round trip that fetches claims — no
      Set-Cookie on SSR/API/streamed responses, and the WS upgrade path (which cannot set
      cookies) gets identical behavior for free. Parallel requests race harmlessly: the touch
      is a single idempotent conditional UPDATE.

## Session model

### Table (sqitch: `db/fnb-app` `00000000010290_session`)

The `auth` schema survives the ZITADEL cutover (only `auth.user`/`auth.identities` were
dropped) and is the right domain for sessions. The change lives in **fnb-app** (not fnb-auth)
because it references `app.profile` and `app_fn` — same reasoning as `010270_profile_idp_user`.

```sql
create table auth.session (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references app.profile (id) on delete cascade,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  revoked_at    timestamptz
);
create index on auth.session (profile_id);
alter table auth.session enable row level security;   -- R9; no policies — deny-all,
                                                      -- reachable only via SECURITY DEFINER fns
```

### Lifetimes (enforced in `app_fn.claims_for_session`, single source of truth)

| Policy | Value | Enforcement |
|---|---|---|
| Touch throttle | **1 hour** | `last_seen_at` updated only when older than 1h — caps writes at ~1/session/hour |
| Idle timeout | **24 hours** | invalid when `last_seen_at < now() - interval '24 hours'` |
| Absolute cap | **7 days** | invalid when `created_at < now() - interval '7 days'` |
| Revocation | immediate | invalid when `revoked_at is not null` |

Validation order: check revoked/idle/absolute against the **existing** `last_seen_at`, then
touch. A request 23h59m after the last touch is valid (and renews); 24h01m is dead. The cookie
seal keeps `maxAge` = 7 days (matching the absolute cap) as defense-in-depth — the row is the
authority, the seal is transport + tamper-proofing.

UX note: hitting the absolute cap bounces through the hosted login, but while the ZITADEL SSO
session is alive that bounce is a silent redirect (no credential prompt) — the cap is cheap for
users and doubles as the IdP liveness re-check.

### Functions (pre-claims root of trust — SECURITY DEFINER, `search_path = pg_catalog, public`, granted to `authenticator`, **no `app_api` exposure**, callable only via db-access raw pg — same pattern as `app_fn.provision_idp_user`)

- `app_fn.create_session(_profile_id uuid) returns uuid` — insert row, return `id`. Called by
  the OIDC callback after `provision_idp_user`.
- `app_fn.claims_for_session(_session_id uuid) returns jsonb` — the per-request choke point:
  validate (revoked → idle → absolute), touch `last_seen_at` (throttled), and return
  `app_fn.profile_claims_for_user(profile_id)` — **one DB round trip**, replacing today's
  claims-only call. Invalid/unknown session → `null` (callers read null as unauthenticated;
  fail closed, never throw).
- `app_fn.revoke_session(_session_id uuid) returns void` — set `revoked_at = now()` (idempotent;
  unknown id is a no-op). Called by logout with the sid from the unsealed cookie.

Post-claims (GraphQL, two-layer per R8): `app_api.revoke_my_sessions()` →
`app_fn.revoke_my_sessions()` — revokes every unrevoked row for the **current claims profile**
("log out everywhere", from 0180 Tier 2). Exposed via PostGraphile like any mutation.

## Request flow (after this change)

```
request → applyEventClaims → getEventClaims:
  unseal cookie → { id, sid }            (unseal failure / missing sid → unauthenticated)
  claimsForSession(sid)                  (db-access raw pg → app_fn.claims_for_session)
    row revoked/idle/absolute-expired    → null → unauthenticated
    valid → touch last_seen_at if > 1h stale → ProfileClaims
  event.context.user = { id }, event.context.claims

WS upgrade → getWsUpgradeClaims: identical — unseal (h3 unsealSession), claimsForSession(sid).
  (Replaces profileClaimsForUser(userId); no cookie writes needed, so full parity.)
```

Login (OIDC callback, after `provisionIdpUser`): `createSession(profile.id)` →
`setAppSession(event, { id: profile.id, sid })`. The cookie is set **only here**.

Logout (`logout.post.ts`): unseal → `revokeSession(sid)` (best-effort) → `clearAppSession` →
`200 { ok: true }` **unconditionally**. auth-ui `logout()`: wrap in `try/finally` so
`user.value = null` (localStorage claims cleared) even when the network call rejects (0180
Tier 1). The ZITADEL RP-initiated logout chain is unchanged.

## Failure & migration semantics

- **Fail closed, never 500**: unseal failure, missing `sid`, unknown/invalid row, or a DB error
  during validation all read as unauthenticated (matches today's `readAppSession` /
  `getWsUpgradeClaims` behavior).
- **Legacy cookies**: pre-change sealed cookies carry `{ id }` with no `sid` → unauthenticated →
  one forced re-login at deploy. Acceptable (dev stack; rebuilds wipe the DB anyway). No
  dual-read shim.
- **Row hygiene**: dead rows (expired/revoked) are inert. Optional follow-up: a graphile-worker
  cron task purging rows dead > 30 days (see `graphile-worker-expert`); not required for
  correctness and not part of the initial implementation.

## File inventory (planned)

| Layer | File | Change |
|---|---|---|
| db | `db/fnb-app` `00000000010290_session` (+ revert/verify) | `auth.session` table + `app_fn.create_session` / `claims_for_session` / `revoke_session` / `revoke_my_sessions` + `app_api.revoke_my_sessions` + grants |
| db-access | `src/mutations/create-session.ts`, `claims-for-session.ts`, `revoke-session.ts` (+ barrel) | raw-pg wrappers; `claimsForSession` returns `ProfileClaims \| null` |
| auth-layer | `server/utils/session.ts` | `AppSessionData = { id?, sid? }`; maxAge stays 7d (comment: row is authority) |
| auth-layer | `server/utils/getEventClaims.ts` | unseal → `claimsForSession(sid)` (replaces `currentProfileClaims(userId)`) |
| msg-layer | `server/utils/getWsUpgradeClaims.ts` | same swap (replaces `profileClaimsForUser`) |
| auth-app | `server/api/auth/oidc/callback.get.ts` | `createSession` → seal `{ id, sid }` |
| auth-app | `server/api/auth/logout.post.ts` | revoke + clear, 200 unconditionally |
| auth-ui | `src/use-auth.ts` | `logout()` clears local claims in `finally`; (optional) expose revoke-all |
| specs (R21) | `zitadel-login-pattern.md` scope-contract payload note; `graphql-api-pattern.md` auth section; `package-layers-pattern.md` inventories; both skills | same change as the code |

`app_fn.profile_claims_for_user` / `currentProfileClaims` remain (still used as the claims
builder inside `claims_for_session`; audit remaining direct callers at implementation time).

## Verification (stage-gate for implementation)

- Login sets one cookie; an active session crosses the old 7-day seal boundary logic without
  a hard logout **until** the absolute cap; day-7+1 forces the hosted-login bounce.
- Idle: a session untouched for >24h reads as unauthenticated (simulate by rewinding
  `last_seen_at` in the DB); activity at 23h keeps it alive and touches the row.
- Touch throttle: two requests minutes apart produce one `last_seen_at` write.
- Logout: second browser holding a copy of the cookie is dead immediately after revoke; logout
  returns 200 and clears local claims even when the endpoint is forced to fail.
- `revokeMySessions` GraphQL mutation kills all of a user's sessions.
- Blocking the profile/resident in fnb kills claims on the next request (unchanged behavior).
- Tampered seal, missing `sid`, unknown `sid`, revoked row: all read as unauthenticated, no 500s.
- WS: upgrade succeeds on a valid session, refuses on a revoked/expired one.
- `pnpm build` green.

## Explicit non-goals

Storing ZITADEL tokens anywhere (browser **never**; server-side deferred to the documented
extension point); ZITADEL liveness probes / `prompt=none` re-auth; per-tenant SSO; login-v2
migration; session purge cron (optional follow-up); anything moving licensing/claims authority
out of fnb.
