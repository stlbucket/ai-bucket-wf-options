# OTP Login — Shared Data, Schema & Permissions

Referenced by `go.ui.md`, `go.data.md`, and `share-link.data.md`. Do not duplicate here.

## Status
Draft — fill in all `[FILL IN]` sections before implementing.

---

## 1. Concept

A **link-driven, short-lived, app-owned OTP login** for quick collaboration. When the app shares a
link to a URN-addressed element (a Todo today; polls / approvals / anything later), and the opener
is not already logged in, the landing page offers **two** ways in:

- **Sign in with ZITADEL** (the normal, full ceremony — unchanged), or
- **Log in with a code** (this feature): the opener enters **their own phone or email**; if it
  matches a **resident of the link's tenant/workspace**, a one-time code is delivered to that channel.
  Possession of that channel *is* the proof — the link alone is not a bearer credential.

**The link is tenant/workspace-scoped, not recipient-bound (D5, revised 2026-07-22).** There is **no
assigned user** — the URN carries the tenant id, and the link works for **any resident of that
tenant**. The opener self-identifies (§7); the system never reveals who the tenant's residents are
(enumeration-safe — §10). The tenant/workspace are the same thing here (user directive).

The OTP session is a **normal `auth.session` row** carrying **full claims**, just with a shorter
lifetime (§4). On success the user's active workspace is switched to the URN's tenant (§6) and they
land directly on the item.

### Scoped exception to `sms-2fa.future.md` D9 (R21)
D9 locked "app-owned OTP is acceptable only for non-auth phone verification, never for login
step-up — ZITADEL owns auth-grade step-up." This feature is a **deliberate, user-approved exception**
(2026-07-22): a *link-driven, possession-of-a-known-channel, short-lived quick session*, distinct
from replacing the primary login. It does **not** touch ZITADEL's ownership of the primary login
ceremony, MFA, or credential storage. `sms-2fa.future.md` gains an annotation pointing here when this
ships (R21 doc pass — see README §Docs to update).

---

## 2. Where the pieces live (reuse map)

| Need | Reused / existing | New |
|---|---|---|
| Session row + sealed cookie + per-request claims | `auth.session`, `app_fn.claims_for_session`, `setAppSession` (sealed `{ id, sid }`) | + `auth_method` column + per-method lifetime |
| Pre-claims root of trust (runs before any session) | db-access raw pg → `app_fn.*` SECURITY DEFINER (`provision_idp_user`, `create_session`) pattern | `get_deep_link`, `request_otp_login`, `verify_otp_login` |
| Code delivery | `send-notification` n8n webhook, internal shared-secret POST (`onboard/request-password.post.ts` precedent) | template `otp-login`; SMS branch rides notify SMS Phase 0/1 |
| "Make the item's workspace active" | `app_fn.assume_residency` semantics (workspace-switcher) | pre-claims variant `activate_profile_residency_in_tenant` |
| URN addressing | `res.resource`, `res_api.resolve_urn`, `parseUrn` (fnb-types) | `resolveUrnRoute()` (auth-app server util) |

**Key architectural call:** OTP code **generation + verification is pre-claims root of trust** (it
runs before any session/claims exist), so it lives in `db/fnb-app` `app_fn.*` — *not* `notify_api`
(post-claims GraphQL). Only the *delivery* of the code rides the notify pipeline. This mirrors
`app_fn.provision_idp_user` / `create_session` exactly. It is **not** `notify.phone_verification`
reuse (that is phone-only and post-claims — a logged-in user verifying their own phone).

---

## 3. Schema — `db/fnb-app` (root-of-trust domain, alongside `auth.session`)

New sqitch change `db/fnb-app/deploy/00000000010295_otp_login.sql` (next free after
`010290_session`). All three concerns below deploy here.

### 3.1 `auth.session.auth_method` (in-place edit to `010290_session`)

```sql
alter table auth.session
  add column auth_method text not null default 'zitadel'
    check (auth_method in ('zitadel', 'otp'));
```

Retrofit strategy is a full rebuild (memory `rebuild-wipes-db`) — edit `010290_session` in place,
true up its verify/revert. Existing ZITADEL sessions default to `'zitadel'`.

### 3.2 `auth.deep_link` — the tenant-scoped shareable link

**Tenant-scoped, not recipient-bound** (D5 revised 2026-07-22). No `target_profile_id` — the link
works for any resident of `target_tenant_id`; the recipient is resolved at request time from the
contact the opener enters (§7).

```sql
create table auth.deep_link (
  id                     uuid primary key default gen_random_uuid(),
  subject_urn            text not null,               -- what to show (res.resource.urn; plain text — no FK, avoids fnb-res deploy-order coupling)
  subject_label          text,                        -- cached display ("Todo: Buy milk"), set at create time by the authenticated sender; avoids a pre-claims RLS read on the landing page
  target_tenant_id       uuid not null references app.tenant (id),  -- the URN's tenant/workspace — the ONLY scope; the code recipient must be a resident of it
  created_by_resident_id uuid not null references app.resident (id),
  expires_at             timestamptz not null,        -- link validity (distinct from the OTP code TTL); default now() + interval '7 days'
  revoked_at             timestamptz,
  created_at             timestamptz not null default now()
);
create index on auth.deep_link (target_tenant_id);
alter table auth.deep_link enable row level security;  -- R9; deny-all, reachable only via SECURITY DEFINER fns + one app_api read
```

### 3.3 `auth.otp_login` — the code store

```sql
create table auth.otp_login (
  id                 uuid primary key default gen_random_uuid(),
  deep_link_id       uuid not null references auth.deep_link (id) on delete cascade,
  profile_id         uuid not null references app.profile (id) on delete cascade,  -- resolved at REQUEST time from the contact the opener entered (§7), constrained to a resident of the link's tenant
  channel            text not null check (channel in ('sms', 'email')),
  destination        text not null,                   -- the phone/email the code was sent to (for audit; masked before it ever leaves the server)
  code_hash          text not null,                   -- never plaintext at rest
  expires_at         timestamptz not null,            -- [FILL IN] TTL, propose 10 min
  attempts           int not null default 0,          -- [FILL IN] max, propose 5
  consumed_at        timestamptz,
  created_at         timestamptz not null default now()
);
create index on auth.otp_login (deep_link_id);
alter table auth.otp_login enable row level security;  -- R9; deny-all, SECURITY DEFINER only
```

Both tables are **deny-all RLS** (no policies) — reachable only through the SECURITY DEFINER
`app_fn.*` functions below, exactly like `auth.session`.

---

## 4. Session lifetime — OTP sessions (per-method policy in `claims_for_session`)

`app_fn.claims_for_session` (single source of truth for validity) branches on `auth_method`:

| Policy | `zitadel` (unchanged) | `otp` |
|---|---|---|
| Touch throttle | 1 hour | 1 hour |
| **Idle timeout** | 24 hours | **1 hour** (sliding — activity within the hour keeps it alive; "refreshed" = continued use) |
| **Absolute cap** | 7 days | **8 hours** `[FILL IN]` (then a fresh OTP is required) |
| Revocation | immediate | immediate |

Validation order is unchanged (revoked → idle → absolute against the **existing** `last_seen_at`,
then throttled touch). An OTP request 59m after last activity is valid and renews; 61m idle is dead;
past the absolute cap the user re-lands on `/auth/go/<id>` and requests a new code. The sealed
cookie's `maxAge` stays the ZITADEL 7d (defense-in-depth only; the row is the authority — for OTP
the row's 8h cap wins long before the seal).

---

## 5. Functions — pre-claims root of trust (`app_fn.*`)

All are **SECURITY DEFINER**, `search_path = pg_catalog, public`, **granted to `authenticator`**,
**no `app_api` exposure**, callable only via db-access raw pg — the `provision_idp_user` /
`create_session` posture. Constants (code length/TTL/attempts/cooldown) are shared plpgsql
constants in this file `[FILL IN]`.

### 5.1 `app_fn.get_deep_link(_id uuid) returns app_fn.deep_link_public`
Pre-claims read for the landing page. Composite `app_fn.deep_link_public` (declared in the same
change): `subject_urn`, `subject_label`, `module` (from `parseUrn`), `expired boolean`,
`revoked boolean`. **No channel / destination / recipient** — there is no assigned recipient (the
link is tenant-scoped); the opener supplies their own contact next (§5.2). **Never returns the
tenant id, resident roster, or any contact.** Unknown / expired / revoked id → a row with
`expired`/`revoked` set (landing page renders a dead-link state; no enumeration signal beyond that).

### 5.2 `app_fn.request_otp_login(_deep_link_id uuid, _identifier text) returns app_fn.otp_request_result`
*(server-only result; the browser never sees the code or a hit/miss)*

The opener enters their own phone/email (`_identifier`). Enumeration-safe: the return shape is
**identical whether or not the contact matched a resident** of the link's tenant.
1. Load `deep_link`; reject (dead-link) if revoked / past `expires_at`.
2. **Resolve the recipient (§7):** normalize `_identifier` (phone vs email) and find a resident of
   `deep_link.target_tenant_id` whose verified phone / email matches → `(profile_id, channel,
   destination)`. **No match → return `{ matched: false }` and stop** (no code, no row) — the route
   still responds "if that's a member, we sent a code."
3. **Cooldown / rate-limit** `[FILL IN]`: reject if an unconsumed code for this `(deep_link_id,
   profile_id)` younger than the resend cooldown (propose 60s) exists, or if too many codes issued
   for this `deep_link_id` (across identifiers) in a window — the per-link cap throttles guessing at
   the tenant roster.
4. Invalidate any prior unconsumed `auth.otp_login` for this `(deep_link_id, profile_id)`.
5. Generate a `[FILL IN]` 6-digit code; insert `auth.otp_login` (`profile_id`, `channel`,
   `destination`, `code_hash`, `expires_at`, `attempts = 0`).
6. Return `{ matched: true, code, channel, destination, destination_masked }` **to the caller only**
   (the auth-app server route, which delivers it — §go.data.md). The code and raw destination never
   return to the browser.

### 5.3 `app_fn.verify_otp_login(_deep_link_id uuid, _code text) returns app_fn.otp_verify_result`  *({ sid, profile_id } | null)*
1. Load the newest unconsumed `auth.otp_login` for `_deep_link_id`; null-guard. (The row already
   carries the `profile_id` resolved at request time — §5.2 — so no recipient lookup is needed here.)
2. Reject (return `null`) if expired or `attempts >= max`; on a wrong code, `attempts += 1`, return
   `null` (fail closed, never throw).
3. On match: stamp `consumed_at`.
4. **Activate the workspace**: `perform app_fn.activate_profile_residency_in_tenant(otp.profile_id,
   deep_link.target_tenant_id)` (§6). If the profile holds no enterable residency in that tenant,
   raise → caller surfaces "no access to this workspace" (§go.data.md). (Belt-and-suspenders — §5.2
   already constrained the recipient to a resident of that tenant.)
5. Mint the session: `select app_fn.create_session(otp.profile_id, 'otp')` and **return
   `{ sid, profile_id }`** (profile_id for the sealed cookie — §go.data.md).

### 5.4 `app_fn.create_session(_profile_id uuid, _auth_method text default 'zitadel') returns uuid`
Extend the existing signature (default keeps the OIDC callback call site unchanged) to persist
`auth_method`.

### 5.5 `app_fn.activate_profile_residency_in_tenant(_profile_id uuid, _tenant_id uuid) returns app.resident`
Pre-claims analog of `app_fn.assume_residency` (which is `jwt.email()`-keyed and post-claims). Finds
the target profile's resident row in `_tenant_id` whose status ∈ `ENTERABLE_STATUSES`
(`INVITED, ACTIVE, INACTIVE, SUPPORTING` — the workspace-switcher constant); sets it `ACTIVE` and
deactivates the profile's other `ACTIVE` residencies, mirroring `assume_residency`'s deactivate-current
/ activate-target behavior. No enterable residency → raise (caller catches). Verify the exact
active-ness encoding against `assume_residency` at implementation `[FILL IN]`.

### 5.6 `app_fn.create_deep_link(_subject_urn text, _created_by_resident_id uuid, _ttl interval default '7 days') returns auth.deep_link`
Called **post-claims** by the app-facing surface (§share-link.data.md). **No recipient argument** —
derives `target_tenant_id` from `parseUrn(_subject_urn)` (the URN carries the tenant id), caches
`subject_label` `[FILL IN]` (see §share-link — the sender is authenticated and may read the subject
via RLS to label it). SECURITY DEFINER; the permission check (caller is a resident of the URN's
tenant) is in its `app_api` wrapper (R8).

---

## 6. Workspace activation (the "different workspace" requirement)

> "if the user is currently in a different workspace than the item, that should become their active
> workspace."

Two entry paths, one outcome — the URN's tenant becomes active:

- **OTP login** → handled inside `verify_otp_login` (§5.3 step 4) *before* the first claims build, so
  the freshly minted session already reports the right `tenantId`.
- **Already-logged-in user** hitting `/auth/go/<id>` → the landing page compares `claims.tenantId`
  with the deep link's tenant; if different, calls the existing post-claims
  `assumeResidency(residentId)` (workspace-switcher) then does a full reload into the item (the
  workspace-Enter contract — full reload so nav/urql caches rebuild). If the same, straight to the
  item.

---

## 7. Recipient resolution + channel selection (opener self-identifies — D5 revised)

`request_otp_login(_deep_link_id, _identifier)` resolves the recipient **from the contact the opener
typed**, constrained to a resident of the link's tenant, then picks the channel:

1. **Classify `_identifier`** — looks-like-email (contains `@`) → email path; else normalize as a
   phone (E.164 `[FILL IN]` — reuse the notify phone-normalization helper) → phone path.
2. **Match within the link's tenant only:** find an `app.resident` of `deep_link.target_tenant_id`
   whose profile's **email** equals the normalized email, **or** whose **verified phone**
   (`notify.phone_verification` consumed / a verified flag — `[FILL IN]` confirm the "phone is
   verified" signal in `fnb-notify`) equals the normalized phone. **No match → `{ matched: false }`**
   (§5.2 step 2). More than one match (same email across residents of one tenant shouldn't happen) →
   `[FILL IN]` pick the profile the resident belongs to; a single tenant resident maps to one profile.
3. **Channel** follows what they entered: email path → `email`; phone path → `sms` **iff** SMS is
   available (`NOTIFY_SMS_PROVIDER` set) and the phone is verified, else the match fails for that
   identifier (a phone number can't receive an email code — tell the opener to use their email
   instead; `[FILL IN]` UX copy).

Because the opener chooses the channel by which contact they type, `notify.channel_preference` does
**not** apply here (it governs app-initiated sends, not this pull-based login).
**SMS dependency:** the `sms` branch requires notify SMS Phase 0/1 (`sms-2fa.future.md`,
`phone-verification.workflow.md`) to be built. Until then only the **email** identifier path resolves;
a phone identifier finds no deliverable channel and returns `{ matched: false }` — the feature ships
email-first with zero code change when SMS lands (see README phasing).

---

## 8. `ProfileClaims` / GraphQL

**No claims shape change.** OTP sessions produce identical `ProfileClaims` to ZITADEL sessions
(Q4 — full claims). `auth_method` lives only in `auth.session` (server-side); it is **not** added to
`buildJwtPayload` / `request.jwt.claims` — nothing in RLS should branch on how you logged in.
`[FILL IN]` decide whether the client surfaces "you're in a temporary session, expires in Xm" — if
so, expose a read-only `app_api.current_session_info()` (auth_method + expiry) for a UI banner
(§go.ui.md); this reads the session row, not the claims.

---

## 9. db-access wrappers (raw pg — pre-claims)

New files under `packages/db-access/src/` (+ barrel — ESM-crash rule):

| Wrapper | Calls | Returns |
|---|---|---|
| `getDeepLink(id)` | `app_fn.get_deep_link` | `DeepLinkPublic \| null` (camelCased — `subjectLabel`, `module`, `expired`, `revoked`; **no channel/destination**) |
| `requestOtpLogin(deepLinkId, identifier)` | `app_fn.request_otp_login` | `{ matched: boolean, code?, channel?, destination?, destinationMasked? }` — code + raw destination stay server-side; `matched:false` when the contact isn't a tenant resident |
| `verifyOtpLogin(deepLinkId, code)` | `app_fn.verify_otp_login` | `{ sid, profileId } \| null` |
| `createSession(profileId, authMethod?)` | `app_fn.create_session` | `sid` (extend existing) |

`DeepLinkPublic` type lives in `packages/db-access/src/types/` (hand-written, like `ProfileClaims`).

---

## 10. Permission model

| Action | Required | Enforced by |
|---|---|---|
| Read a deep link (landing) | none (pre-claims) | `app_fn.get_deep_link` returns only subject label + module + expired/revoked — **no recipient, roster, or contact** |
| Request an OTP code | possession of the link id **+ knowing a contact that belongs to a resident of the link's tenant** | `request_otp_login` matches the entered contact to a tenant resident (§7); rate-limit + cooldown; code goes only to the *matched resident's own* channel |
| Complete OTP login | possession of the code delivered to that channel | `verify_otp_login` (code_hash + attempts + expiry) |
| Create a deep link | logged-in resident of the URN's tenant | `app_api.create_deep_link` → `jwt.enforce_permission` (§share-link.data.md) |
| Land in the URN's workspace | an enterable residency in that tenant | §7 match already requires tenant residency; `activate_profile_residency_in_tenant` re-checks and raises otherwise |

**Fail-closed + enumeration-safe everywhere.** Unseal failure, unknown/expired/revoked link →
dead-link; wrong/expired code → unauthenticated; **a contact that isn't a tenant resident →
the *same* "if that's a member, we sent a code" response** as a real match (no signal that a given
phone/email is or isn't in the tenant). Never a 500, never an oracle beyond expired/revoked. The
per-link issue cap (§5.2) throttles brute-forcing the tenant roster through the identifier field.

---

## Open Questions
- [ ] OTP constants: code length (6?), code TTL (10 min?), max attempts (5?), resend cooldown (60s?),
      per-link issue cap (now doubles as the anti-roster-enumeration throttle — §5.2/§10).
- [ ] The exact "phone is verified" signal in `fnb-notify`, and the phone-normalization helper reused
      to match a typed phone to a resident (§7).
- [ ] Confirm `assume_residency`'s active-ness encoding so §5.5 mirrors it exactly (status flip vs a
      dedicated active flag).
- [ ] Absolute cap for OTP sessions: 8h proposed — confirm (§4).
- [ ] Surface a "temporary session, expires in Xm" banner (§8)? If yes, add `current_session_info()`.
- [ ] Deep-link `expires_at` default (7 days proposed) — separate from the code TTL.
- [ ] A contact that matches **no** resident of the link's tenant → the enumeration-safe generic
      "code sent" (§10). Confirm we never differentiate "not a member" from "member, code sent."
- [ ] Multiple residents of one tenant sharing an email/phone — assumed impossible (one contact → one
      profile). Confirm the resident→profile uniqueness within a tenant (§7 step 2).
