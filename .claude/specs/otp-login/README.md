# OTP Login (link-driven quick login) — Spec Index

> **Execution Directive:** plan + build this spec via `/fnb-stack-implementor <this README>` —
> the implementor derives the `.claude/issues/` plan file (R23) from the task list below, then
> executes it.

## Status
**Shipped in code** (noticed stale 2026-07-28 while building the poll share — this line previously
still said Draft): `00000000010295_otp_login` (tenant-scoped `auth.deep_link` + `auth.otp_login`),
the `/auth/go/[id]` landing + `otp/*` endpoints, `useDeepLink` (`shareToLink`/`sendDeepLink`), the
`send-deep-link` n8n workflow, and the todo + **poll** (2026-07-28) share surfaces. Task list
**retro-checked against the shipped code 2026-07-30** (recurring 0040 spec-reconcile pass) —
all phases ✓, with two as-built deviations noted inline (`urn-route.ts` lives in
`shared/utils/`, and the D14 send ships as the `send-deep-link` n8n workflow instead of an
`app_api.send_deep_link` fan-out). Build/verify record: `addressed/0510__auth______otp-login-deep-link`.
Note on subtree response: nested-tenant subtree members can't respond to org-level links
(exact-tenant fence). For **polls** this is by design (poll spec D19, user directive 2026-07-29 —
a poll's audience is exactly its tenant's members); the `0620` issue file once referenced here
was never actually created. If subtree response ever matters for another module (e.g. todo
links), file it fresh against that module.

<details><summary>Pre-ship status (historical)</summary>
Draft — sequenced behind notifications SMS Phase 0/1 (implementor round, 2026-07-22). Design
decisions locked; a few code-inspection `[FILL IN]`s remained (resolved at plan time).
</details>

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
- [x] Change `00000000010295_otp_login.sql`: **tenant-scoped** `auth.deep_link` (no
      `target_profile_id`), `auth.otp_login` (deny-all RLS); `app_fn.deep_link_public` composite
      (no channel/destination); `app_fn.otp_request_result` + `otp_verify_result` composites;
      `app_fn.get_deep_link`, `request_otp_login(_deep_link_id, _identifier)` (matches the contact to
      a resident of the link's tenant, enumeration-safe), `verify_otp_login` (→ `{ sid, profile_id }`),
      `activate_profile_residency_in_tenant`, `create_deep_link(_subject_urn, _created_by_resident_id)`
      (tenant from the URN); shared constants. *(As-built also adds `app_fn.session_info` — D11.)*
- [x] In-place edit `00000000010290_session.sql`: `auth.session.auth_method`; true up verify/revert.
- [x] In-place edit `app_fn.create_session` (+ `_auth_method` default `'zitadel'`) and
      `app_fn.claims_for_session` (per-method lifetime — otp = 1h idle / 8h cap).
- [x] `app_api.create_deep_link(_subject_urn)` (two-layer, R8; as-built also takes an optional
      `_subject_label`).

### Phase 2 — db-access wrappers (raw pg)
- [x] `getDeepLink` (`queries/get-deep-link`, `DeepLinkPublic` type), `requestOtpLogin`
      (`OtpLoginDispatch`), `verifyOtpLogin`; `createSession(profileId, authMethod = 'zitadel')`;
      barrel exports verified (ESM-crash rule).

### Phase 3 — auth-app landing + endpoints
- [x] `server/api/otp/link.get.ts`, `request.post.ts`, `verify.post.ts` (pre-claims) +
      `server/api/session-info.get.ts` (banner). Enumeration-safe `request` response.
- [x] `resolveUrnRoute` — **as-built at `shared/utils/urn-route.ts`** (not `server/utils/`).
      Todo + poll mappings.
- [x] `app/pages/go/[id].vue` (States A–D, mobile-first) — State C step 0 = enter your phone/email.
- [x] `otp-login` notification template (email; SMS branch pending notify Phase 0/1).
- [x] **Standard-login return-to (D15)** — the general login-flow capability, owned by
      `auth-app/login` (`login.data.md` §Return-to), consumed here:
      - `useAuth().loginWithRedirect(returnTo?)` + `LoginForm.vue` optional `returnTo` prop.
      - `oidc/login.get.ts`: parks `oidc_return_to` cookie when `isSafeReturnTo`.
      - `oidc/callback.get.ts`: reads+deletes the cookie, re-emits `?returnTo=`.
      - `login.vue`: navigates to a valid `route.query.returnTo` after the residency flow.
      - `isSafeReturnTo` — **as-built in `@function-bucket/fnb-types`** (shared vocabulary),
        validated at park **and** consume.
      - `go/[id].vue` State B renders `<LoginForm>` with the return-to.

### Phase 4 — create-link surface + Todo demonstration
- [x] `createDeepLink.graphql` + `useDeepLink` composable (`shareToLink(subjectUrn,
      subjectLabel?)`) + tenant-app re-export.
- [x] Todo detail page action — assignee gate removed; "Copy quick-login link" works on any todo.

### Phase 4b — targeted multi-resident send (D14)
- [x] **As-built deviation:** no `app_api.send_deep_link` DB fan-out — `useDeepLink.sendDeepLink`
      creates the link (`shareToLink`) then fires the **`send-deep-link` n8n workflow** via the
      `triggerWorkflow` mutation (R22 posture); the workflow (as `n8n_worker`) resolves each
      selected resident's contact (`resolve_send_recipients`, tenant-scoped) and loops the
      `send-notification` webhook per (resident × channel). Fire-and-forget (`count` = residents
      selected, not delivered).
- [x] "Send to residents" surface — shipped as the generic `ShareModal`
      (`apps/tenant-app/app/components/ShareModal.vue`, promoted from `TodoShareModal` when polls
      adopted it 2026-07-28), consumed by todo + poll detail pages.

### Phase 5 — verify end-to-end
- [x] Verified during the 0510 build (see `addressed/0510__auth______otp-login-deep-link`):
      link → logged-out open → self-identify → code → land on the item in the correct
      workspace; enumeration-safe non-member path; fail-closed code handling; `pnpm build` green.

## Docs to update when this ships (R21) — trued up 2026-07-30 (recurring 0040 pass)
- [x] `auth-app/login.data.md` + `login.ui.md` — done in the spec round (return-to round-trip
  documented on the login ceremony, its owner).
- [x] `CLAUDE.md` auth model + `graphql-api-pattern.md` (pre-claims carve-out #2) — done
  2026-07-30: `otp` auth method, per-method lifetime, the deep-link/OTP root-of-trust functions.
- [x] `future-auth/session-refresh-pattern.md` — done 2026-07-30: `auth_method` column +
  per-method lifetimes note.
- [x] `.claude/skills/fnb-stack-implementor/SKILL.md` — pre-claims OTP functions added to the
  root-of-trust inventory (0050 skill-drift leg of the same 2026-07-30 housekeeping pass).
- [x] `package-layers-pattern.md` — carries `OtpSessionBanner`; db-access OTP wrappers noted in
  its file inventory via the barrel (no per-function table to extend).
- ~~`sms-2fa.future.md` — annotate D9~~ — **that file does not exist** (referenced here and from
  `twilio-production-sms/README.md` but never created); the D8 scoped-exception record in this
  README is the surviving documentation. If an SMS-2FA spec is ever written, link D8 from it.

## Remaining Open Questions — all resolved at plan/build time (D9 + the 0510 build)
- [x] OTP constants — locked by D9 (6-digit · 10-min TTL · 5 attempts · 60s cooldown · 1h/8h).
- [x] Phone-verified signal + normalization, `assume_residency` mirroring, contact-uniqueness,
      enumeration-safe contract — resolved during the 0510 build (see `_shared.data.md` §7/§10
      and the shipped `00000000010295_otp_login.sql`).

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
- ~~**Group polls** — a `poll` URN module: vote on any subject from a texted link.~~
  **Implemented 2026-07-28** (poll spec Phase 6, D17/D18): `poll` entry in `resolveUrnRoute`;
  the share surface generalized — `TodoShareModal` was promoted to the generic `ShareModal`
  (`apps/tenant-app/app/components/ShareModal.vue`), consumed by both todo and poll detail pages.
- **Approvals** — an `approval` URN module: approve/reject from your phone.
- **Quick reactions / acks** — 👍/👀/✅ on any URN, the lightest responder.
- **@mentions → deep-link notification** — mention a resident on any URN; they get an SMS/email link
  straight into the OTP responder.
- **Guest residency type** — a lightweight resident who only ever OTP-logs-in.
