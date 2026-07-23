# OTP Login (link-driven quick login) — Spec Index

> **Execution Directive:** plan + build this spec via `/fnb-stack-implementor <this README>` —
> the implementor derives the `.claude/issues/` plan file (R23) from the task list below, then
> executes it.

## Status
**Draft — sequenced behind notifications SMS Phase 0/1** (implementor round, 2026-07-22). Design
decisions locked; a few code-inspection `[FILL IN]`s remain (resolved at plan time). **Build order:
`notifications` SMS Phase 0/1 ships first** (its own README/Execution Directive) so SMS delivery +
the "verified phone" signal exist; *then* this spec is planned/built on top (channel = both, no
email fallback needed).

> **Revised 2026-07-22 (D13 — tenant-scoped links, no assigned user).** The recipient-bound model
> (original D5) is replaced by a **tenant-scoped** link where the opener **self-identifies** by
> phone/email (see D13 + `_shared.data.md` §7). Any in-flight plan/code from the earlier
> recipient-bound draft (the `0510` plan + the untracked `otp` scaffolding) must be re-derived
> against this revision before it's built — `create_deep_link` loses its recipient arg,
> `auth.deep_link` loses `target_profile_id`, `request_otp_login` gains `_identifier`, and the Todo
> UI's assignee gate comes off.

### Implementor-round decisions (2026-07-22)
- **D9 — Constants locked to the spec's proposed defaults:** 6-digit code · 10-min code TTL · 5 max
  attempts · 60s resend cooldown · OTP session sliding-1h idle + **8h** absolute cap · deep link
  valid **7 days**.
- **D10 — v1 Todo delivery = "Copy quick-login link"** (no new notification template/workflow).
  ~~An automatic `todo-shared` send is a later enhancement.~~ **Superseded by D14 (2026-07-22): a
  targeted "Send to residents" modal ships in v1** — multi-recipient, custom message, Email/SMS
  (SMS gated on notify Phase 0/1), delivered via `send-notification` (template `deep-link-share`).
- **D11 — Build the temporary-session banner** in v1: `app_api.current_session_info()`
  (auth_method + remaining time) + a tenant-layer banner for `auth_method='otp'` sessions.
- **D12 — Sequenced behind the notifications SMS pipeline** (user chose "SMS spec first, then OTP
  login"): SMS Phase 0/1 is planned/built via `.claude/specs/notifications/` first; OTP login
  follows with SMS live.
- **D13 — Links are TENANT-SCOPED, not recipient-bound (revises D5, user directive 2026-07-22):**
  there is **no assigned user** — the URN carries the tenant id and the link works for **any resident
  of that tenant/workspace** (tenant = workspace). The opener **self-identifies** by entering their
  own phone/email on the landing page; the server matches it to a resident of the link's tenant and
  sends the code to *that* channel. `auth.deep_link` drops `target_profile_id`; `create_deep_link`
  drops its recipient arg; `request_otp_login` gains an `_identifier`; the resolution is
  **enumeration-safe** (a non-member gets the same "code sent" UX as a member). The Todo UI's
  "assign this todo first" gate is removed — "Copy quick-login link" works on any todo.
- **D15 — Standard (ZITADEL) login must return to the deep link (user report 2026-07-22):** the OTP
  path already lands the opener on the item; the "Sign in with ZITADEL" path did **not** — the
  ceremony hard-redirects to `/auth/login?oidc=success` → `goHome()` → `/`, losing the item. Fix: a
  **`returnTo` root-relative path threaded through the whole round-trip** — `loginWithRedirect(returnTo)`
  → `oidc/login` parks an `oidc_return_to` httpOnly cookie → `callback` re-emits `?returnTo=` on the
  `/auth/login` hop → `login.vue` navigates there after the residency flow (instead of `goHome()`).
  The deep-link page renders `<LoginForm :return-to="`/auth/go/${linkId}`">`; the ceremony returns to
  `/auth/go/<id>` logged-in and State D forwards to the item. **Open-redirect safe / fail-closed**
  (`isSafeReturnTo`: single-leading-`/`, not `//`/`\`, validated at park **and** consume). This is a
  general login-flow capability **owned by `auth-app/login`** (`login.data.md` §Return-to) and merely
  *consumed* here — bare `<LoginForm />` still goes home.
- **D14 — Targeted multi-resident send surface (user directive 2026-07-22):** alongside "Copy link",
  a **"Send to residents"** button opens a modal — pick one or more residents of the tenant, add a
  **message**, tick **Email** / **SMS** — that delivers the **same tenant-scoped link** to the chosen
  residents' channels via the `send-notification` workflow (post-claims, claims-gated;
  `app_api.send_deep_link` fans out server-side, contacts never reach the client). It does **not**
  bypass the OTP — recipients still self-identify on landing (the link is a pointer, not a bearer
  token). SMS is disabled until notify SMS Phase 0/1 (D12); Email works now. This makes the earlier
  "automatic `todo-shared`" idea concrete and generalizes it to multi-recipient + custom message.

## Purpose

A **link-driven, short-lived, app-owned OTP login** that makes the platform a breeze for quick,
small-team collaboration. When the app shares a link to a URN-addressed element (a **Todo** today;
polls / approvals / anything later) and the opener is not already logged in, the landing page
(`/auth/go/<id>`) offers a second way in beside the normal ZITADEL login: **"Log in with a code"** —
the opener enters **their own phone or email**, and if it belongs to a **resident of the link's
tenant/workspace** a one-time code is delivered to that channel (D13 — the link is tenant-scoped, not
bound to an assigned recipient). It's built for someone on their phone who just wants to see and
respond to one item.

The OTP session is a **normal `auth.session` row with full claims**, just shorter-lived (sliding 1h
idle + an absolute cap). On success the user's active workspace switches to the item's tenant and
they land directly on it.

The whole flow **reuses** existing machinery: the sealed session cookie + `claims_for_session`, the
pre-claims root-of-trust posture (`provision_idp_user` / `create_session`), the `send-notification`
n8n webhook for delivery, the URN registry for addressing, and `assume_residency` for the workspace
switch. The only genuinely new surface is the deep-link + code store and the landing page.

## Locked decisions (2026-07-22)

| # | Decision | Why |
|---|---|---|
| D1 | OTP session = `auth.session` row with `auth_method='otp'`; **full claims**, sealed `{ id, sid }` cookie, `claims_for_session` as authority | Reuse the entire session/claims/RLS stack; scope via lifetime, not permissions (user's call) |
| D2 | Lifetime: **sliding 1h idle + absolute cap 8h**, per-method branch in `claims_for_session` | Matches "good for an hour unless refreshed [by activity]"; the cap forces eventual re-auth |
| D3 | Delivery: **both** — SMS when the profile has a verified phone (+ SMS available), else email; rides `send-notification` webhook (internal secret), template `otp-login` | Phone-first UX; email ships today, SMS when notify Phase 0/1 lands (email-first fallback, zero code change) |
| D4 | Code **generation + verification are pre-claims root of trust** in `app_fn.*` (SECURITY DEFINER, `authenticator`, via db-access raw pg) — **not** `notify_api` | Runs before any session/claims exist; identical posture to `provision_idp_user`. notify handles only delivery |
| D5 | ~~Deep link = recipient-bound~~ **→ TENANT-scoped `auth.deep_link` row (see D13)**; link `/auth/go/<id>`; landing offers ZITADEL **and** OTP. Primary `/auth/login` untouched | User directive: "not available thru the UI for now" — OTP appears only on the deep-link page. **Revised 2026-07-22 (D13): no assigned user — the link works for any resident of the URN's tenant; the opener self-identifies to receive a code** |
| D6 | Workspace activation inside `verify_otp_login` (pre-claims) for new sessions; `assumeResidency` + full reload for already-logged-in users. The activated profile is the one resolved from the opener's contact (D13) | User requirement: the item's workspace becomes active on arrival |
| D7 | v1 responder wired to **Todos only** (`/tenant/tools/todo/<id>`); `resolveUrnRoute` is a small extensible module→route map | Q1 scope — polls/approvals are follow-on specs reusing this exact shape |
| D8 | Deliberate, scoped **exception to `sms-2fa.future.md` D9** (app-owned OTP only for non-auth): OTP is used for *login* here | User product decision; a short-lived, link-driven, possession-of-known-channel quick session, not a replacement for the primary login |

## Files in this spec

| File | Contents |
|---|---|
| `README.md` | this index |
| `_shared.data.md` | schema (`auth.session.auth_method`, tenant-scoped `auth.deep_link`, `auth.otp_login`), pre-claims `app_fn.*` functions, lifetime policy, **recipient resolution from the opener's contact** + channel selection, workspace activation, db-access wrappers, enumeration-safe permission model |
| `go.ui.md` | the `/auth/go/[id]` landing / responder page — states, layout, interactions (incl. the self-identify step) |
| `go.data.md` | the pre-claims Nitro endpoints (`otp/link`, `otp/request` with `identifier`, `otp/verify`), delivery webhook, session mint, `resolveUrnRoute`, already-logged-in path |
| `share-link.data.md` | the post-claims `createDeepLink(subjectUrn)` mutation (no recipient) + the `sendDeepLink` targeted-send fan-out (D14) + composable + v1 Todo wiring (gate removed) |
| `share-link.ui.md` | the sender-side surface: "Copy link" + "Send to residents" modal (multi-select residents · message · Email/SMS checkboxes) (D14) |

## Implementation Task List (phased, build order)

### Phase 1 — DB (pre-claims root of trust), `db/fnb-app`
- [ ] Change `00000000010295_otp_login.sql`: **tenant-scoped** `auth.deep_link` (no
      `target_profile_id`), `auth.otp_login` (deny-all RLS); `app_fn.deep_link_public` composite
      (no channel/destination); `app_fn.otp_request_result` + `otp_verify_result` composites;
      `app_fn.get_deep_link`, `request_otp_login(_deep_link_id, _identifier)` (matches the contact to
      a resident of the link's tenant, enumeration-safe), `verify_otp_login` (→ `{ sid, profile_id }`),
      `activate_profile_residency_in_tenant`, `create_deep_link(_subject_urn, _created_by_resident_id)`
      (tenant from the URN); shared constants.
- [ ] In-place edit `00000000010290_session.sql`: `auth.session.auth_method`; true up verify/revert.
- [ ] In-place edit `app_fn.create_session` (+ `_auth_method` default) and `app_fn.claims_for_session`
      (per-method lifetime, §4). True up verify/revert. Engage `sqitch-expert` + `fnb-db-designer`.
- [ ] `app_api.create_deep_link(_subject_urn)` (two-layer, R8) + `auth.deep_link` SELECT policy for
      the GraphQL read (creator-scoped — no single target resident now).

### Phase 2 — db-access wrappers (raw pg)
- [ ] `getDeepLink`, `requestOtpLogin(deepLinkId, identifier)` (returns `{ matched, code?, channel?,
      destination?, destinationMasked? }` — code/destination server-side only), `verifyOtpLogin`
      (→ `{ sid, profileId }`); extend `createSession(profileId, authMethod?)`; `DeepLinkPublic` type;
      barrel exports (ESM-crash rule).

### Phase 3 — auth-app landing + endpoints
- [ ] `server/api/otp/link.get.ts`, `request.post.ts` (body `{ id, identifier }`), `verify.post.ts`
      (pre-claims; mirror `onboard/*`). Delivery via the internal `send-notification` webhook.
      Enumeration-safe `request` response (identical for member/non-member).
- [ ] `server/utils/urn-route.ts` (`resolveUrnRoute`, Todo mapping).
- [ ] `app/pages/go/[id].vue` (States A–D, mobile-first) — State C **step 0 = enter your phone/email**.
- [ ] `otp-login` notification template (email now; SMS branch when notify Phase 0/1 lands).
- [ ] **Standard-login return-to (D15)** — the general login-flow capability, owned by
      `auth-app/login` (`login.data.md` §Return-to), consumed here:
      - `useAuth().loginWithRedirect(returnTo?)` + `LoginForm.vue` optional `returnTo` prop
        (`packages/auth-layer` / `packages/auth-ui`).
      - `oidc/login.get.ts`: park `oidc_return_to` cookie when `isSafeReturnTo`.
      - `oidc/callback.get.ts`: read+delete the cookie, re-emit `?returnTo=` on the
        `/auth/login?oidc=success` redirect.
      - `login.vue`: navigate to a valid `route.query.returnTo` after the residency flow instead of
        `goHome()` (both single- and modal-select paths).
      - `isSafeReturnTo` shared helper (open-redirect guard, validated at park **and** consume).
      - `go/[id].vue` State B renders `<LoginForm :return-to="`/auth/go/${linkId}`">`.

### Phase 4 — create-link surface + Todo demonstration
- [ ] `createDeepLink.graphql` (var: `subjectUrn` only) + `useDeepLink` composable
      (`shareToLink(subjectUrn)`) + tenant-app re-export.
- [ ] Todo detail page action — **remove the `tree.owner.residentId` gate**; "Copy quick-login link"
      works on any todo (assigned or not), calls `shareToLink(todo.urn)`.

### Phase 4b — targeted multi-resident send (D14)
- [ ] `app_api.send_deep_link(_subject_urn, _resident_ids[], _message, _channels[])` (two-layer, R8) —
      creates/reuses the link + fans out one `send-notification` per (co-resident × ticked channel),
      server-side contact resolution, per-recipient delivery summary. Trigger boundary + template
      `deep-link-share` resolved against `.claude/specs/notifications/`.
- [ ] `sendDeepLink(.graphql)` + `useDeepLink.sendDeepLink(…)` composable extension + re-export.
- [ ] "Send to residents" modal on the Todo detail (`share-link.ui.md`): multi-select residents,
      message, Email/SMS checkboxes (SMS disabled until notify Phase 0/1), "sent to N of M" toast.

### Phase 5 — verify end-to-end
- [ ] Fresh rebuild → make a Todo link (assigned OR unassigned) → open in a logged-out browser →
      **enter your own phone/email** → request code (email in dev via Mailpit; SMS via log-sink if
      built) → verify → land on the Todo in the correct workspace.
- [ ] A contact that is **not** a resident of the link's tenant → same "code sent" UX, no code, no
      login (enumeration-safe). Idle >1h dead; activity <1h renews; absolute cap forces a new code.
      Wrong/expired/exhausted code fails closed. Already-logged-in same-tenant vs different-tenant
      paths. `pnpm build` green.

## Docs to update when this ships (R21)
- `auth-app/login.data.md` + `login.ui.md` — **done in this spec round:** the return-to round-trip
  is now documented on the login ceremony (its owner). The `loginWithRedirect(returnTo?)` signature
  + `LoginForm` `returnTo` prop are cross-cutting; keep them in sync there.
- `sms-2fa.future.md` — annotate **D9**: app-owned OTP is now used for the *login* case per this
  spec (scoped exception D8); link here.
- `CLAUDE.md` auth model + `graphql-api-pattern.md` Auth Context — note the `otp` auth method +
  per-method lifetime; add the `auth.deep_link` / `auth.otp_login` root-of-trust functions to the
  pre-claims carve-out list.
- `future-auth/session-refresh-pattern.md` — the `auth_method` column + OTP lifetime row.
- `.claude/skills/fnb-stack-implementor/SKILL.md` — the pre-claims OTP functions in the root-of-trust
  inventory.
- `package-layers-pattern.md` — db-access new wrappers.

## Remaining Open Questions
Consolidated in the page files; the load-bearing ones:
- [ ] OTP constants: code length / TTL / max attempts / resend cooldown / per-link issue cap (the cap
      now also throttles brute-forcing the tenant roster through the identifier field — D13).
- [ ] The "phone is verified" signal in `fnb-notify` + the phone-normalization helper reused to match
      a typed phone to a resident of the link's tenant (§7).
- [ ] Confirm `assume_residency`'s active-ness encoding so the pre-claims variant mirrors it.
- [ ] OTP absolute cap (8h proposed).
- [ ] Confirm one contact → one profile within a tenant (§7 resolution assumes uniqueness).
- [ ] Confirm the enumeration-safe contract: a non-member contact gets the **same** "code sent"
      response as a member (never an is-this-a-member oracle) — D13/§10.

## Considered & rejected
- **A separate OTP session system** (not `auth.session`) — rejected: duplicates the cookie / claims /
  RLS / lifetime machinery for no gain.
- **Magic-link bearer token** (code embedded in the URL, no code entry) — rejected: forwarding the
  link = full access, and the user asked for an OTP code. The link is a *pointer*; the code
  (delivered to the recipient's channel) is the credential.
- **Reduced "guest" claims scope** — considered (tighter D9 exception), but the user chose **full
  claims** (D1); scoping is via the short lifetime instead.
- **Code store in `notify.otp` / `notify_api`** — rejected: verification is pre-claims root of trust,
  not a post-claims GraphQL mutation. notify owns delivery only.
- **Reusing `notify.phone_verification` directly** — rejected: it is phone-only and post-claims (a
  logged-in user verifying their own phone); OTP login needs a pre-claims path and email too.
- **Recipient-bound link (the original D5)** — superseded by D13: the user wants the link to work for
  any resident of the tenant, with no assigned user. Tenant-scoped + self-identify replaces it.
- **"Pick your name from the tenant roster" on the landing page** — rejected (weighed 2026-07-22):
  simplest UX but it exposes the tenant's member list (names + masked contacts) to anyone holding the
  link. Self-identify-by-contact keeps membership secret (enumeration-safe, §10).
- **Optional pre-assign + self-identify fallback** (nullable `target_profile_id`) — considered, not
  taken: the user's directive is a clean "no assigned user," so the column is dropped entirely rather
  than kept nullable. A targeted send (e.g. automatic `todo-shared`) can reintroduce a recipient in a
  follow-on if needed.

## The "what else would help small-team collaboration" ideas (deferred — follow-on specs)
Captured from the brief; each reuses this spec's URN-registry → `createDeepLink` → `/auth/go`
responder shape verbatim (Q1 kept v1 to Todos):
- **Group polls** — a `poll` URN module: vote on any subject from a texted link.
- **Approvals** — an `approval` URN module: approve/reject from your phone.
- **Quick reactions / acks** — 👍/👀/✅ on any URN, the lightest responder.
- **@mentions → deep-link notification** — mention a resident on any URN; they get an SMS/email link
  straight into the OTP responder.
- **Guest residency type** — a lightweight resident who only ever OTP-logs-in.
