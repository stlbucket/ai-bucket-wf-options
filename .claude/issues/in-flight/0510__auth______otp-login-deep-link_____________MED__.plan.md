# OTP Login (link-driven quick login) — Implementation Plan

> **Execution Directive:** build this plan via `/fnb-stack-implementor <this plan file>` — execute
> the phases in order; each is independently verifiable. Spec source of truth:
> `.claude/specs/otp-login/` (README + `_shared.data.md` + `go.{ui,data}.md` + `share-link.data.md`).

- **Category:** auth · **Severity:** MED · **Status dir:** in-flight
- **Derived from:** `.claude/specs/otp-login/README.md` task list (2026-07-22), refined with verified
  code anchors during implementor intake.

> ## ⚠ REVISION 2026-07-22 — spec revised to D13 (tenant-scoped) + D14 (send modal)
> Phases 1–4 below were **built against the recipient-bound model (old D5)**. The spec has since been
> revised: the link is **tenant-scoped, no assigned user** (D13) and gains a **targeted "Send to
> residents" modal** (D14). The built code now diverges and must be reconciled. **The authoritative
> work is now `## Revision R1` (D13 delta over the built code) + `## Revision R2` (D14, net-new)
> below.** Phases 1–4 stay for history; execute R1/R2, then Phase 5. Rebuild wipes the DB, so the
> `010295` SQL is edited **in place** (no new sqitch change), same as the original build.

### Execution status (2026-07-22, R1+R2 pass — offline)
**R1 (D13) — DONE (offline).** `010295_otp_login.sql` reworked in place (deep_link drops
`target_profile_id`; `deep_link_public`/`otp_login_dispatch` composites reshaped;
`resolve_otp_channel`→`resolve_tenant_recipient(_tenant_id,_identifier)`; `get_deep_link` no
channel/dest; `request_otp_login(_deep_link_id,_identifier)` enumeration-safe; `verify_otp_login`
uses `_row.profile_id`; `create_deep_link` drops recipient, derives tenant from URN; grants updated)
+ revert/verify/pgTAP trued up. db-access (`get-deep-link`, `request-otp-login`) updated — **`pnpm
-F fnb-db-access build` GREEN.** auth-app `otp/request.post.ts` (identifier + enumeration-safe
no-match, no destinationMasked) + `go/[id].vue` (self-identify step 0, enum-safe toast, "use a
different phone/email"). `createDeepLink.graphql`/`useDeepLink.shareToLink` drop the recipient; Todo
`[id].vue` gate removed.

**R2 (D14) — code DONE (offline); n8n env-gated.** DB `app_fn.resolve_send_recipients` +
revert/verify; **new sqitch change `fnb-n8n/…011250_n8n_worker_deep_link`** grants n8n_worker execute
on it (+ plan line). `send-deep-link` registered in `WORKFLOW_REGISTRY` (`p:app-user`).
`useDeepLink.sendDeepLink` (create link → `triggerWorkflow('send-deep-link', …)`). `TodoShareModal.vue`
(residents checklist · message · Email/SMS · "Sending to N…") wired into the Todo detail.

### Post-rebuild verification (2026-07-22 — user rebuilt)
**DONE + verified on the live env:**
- **DB deployed** (read-only introspection): `auth.deep_link` has NO `target_profile_id`;
  `app_fn.resolve_tenant_recipient` + `resolve_send_recipients` present; `request_otp_login(uuid,
  text)`; `app_api.create_deep_link(text, text)`; `n8n_worker` has execute on
  `resolve_send_recipients`.
- **Codegen** regenerated (`useCreateDeepLinkMutation` now `subjectUrn`/`subjectLabel` only, no
  `targetResidentId`). **Builds GREEN:** `db-access`, `graphql-client-api`, `auth-app`, `tenant-app`.
- **n8n workflows authored** (valid JSON): `n8n/workflows/send-deep-link.json` (Webhook →
  `resolve_send_recipients` Postgres as n8n_worker → per-recipient HTTP POST to the
  `send-notification` webhook, `templateKey:'deep-link-share'`) + the `deep-link-share` branch added
  to `send-notification.json`'s Render node.

**VERIFIED on the live env (2026-07-22):**
- Workflows imported + **active** (`send-deep-link`, `send-notification` re-imported).
- **R1 DB flow** (rolled-back txn, real seed — "My App Tenant"): `create_deep_link`→`get_deep_link`
  (module=todo, live); non-member email → `matched=f` (enumeration-safe); member email → `matched=t`,
  channel=email, masked dest; `verify_otp_login` wrong code → null, right code → sid + profile_id
  (workspace activated). ✓
- **R2 DB** `resolve_send_recipients` → email+sms rows for both residents. ✓
  **BUG FOUND + FIXED:** `p.email` is `citext` but the `RETURNS TABLE` cols are `text` → strict
  `RETURN QUERY` type-mismatch. Fixed with `::text` casts in `picked` + the selects (deploy file +
  applied to live DB via `CREATE OR REPLACE`).
- **n8n `deep-link-share` template** (POST send-notification) → Mailpit email "Ada Lovelace shared
  Buy milk with you" with message + button + link. ✓
- **`send-deep-link` fan-out** (POST webhook, 2 residents, email) → HTTP 200 → **both** residents
  emailed ("Grace Hopper shared Sprint planning with you"). ✓
- **Builds GREEN:** db-access, graphql-client-api, auth-app, tenant-app; codegen regenerated.

**BUG FOUND in UI testing + FIXED — permission gate too narrow.** "Copy quick-login link" 30000'd
(`NOT AUTHORIZED`) for the default super-admin login (`bucket@function-bucket.net`): it holds
`p:app-admin`/`-super`/`-support` but **not** the base `p:app-user`, so `enforce_permission('p:app-user')`
rejected it. Fixed to the **any-of gate `{p:app-user, p:app-admin}`** (the game-event trigger
precedent) in both places:
- `app_api.create_deep_link` → `jwt.enforce_any_permission(array['p:app-user','p:app-admin'])`
  (deploy file + applied live via `CREATE OR REPLACE` — copy link works now).
- `WORKFLOW_REGISTRY['send-deep-link']` → `permission: ['p:app-user','p:app-admin']` (plugin file;
  `nuxt dev` reloads graphql-api-app). Spec `share-link.data.md` updated; the permission open
  question is resolved.

**NOT yet browser-click-tested end-to-end:** the `/auth/go/[id]` landing UI + the `TodoShareModal`
send. Copy-link now succeeds; the OTP landing + send flows are verified at every layer beneath the UI.

## Progress (2026-07-22) — offline pass complete; remainder is env-gated

**Done + build-checked where possible:**
- **Phase 1 (DB)** — `db/fnb-app/deploy/00000000010295_otp_login.sql` (+ revert/verify) with
  `auth.deep_link`, `auth.otp_login`, the composites, and all `app_fn`/`app_api` functions; in-place
  edits to `00000000010290_session.sql` (auth_method column + 2-arg `create_session` + per-method
  lifetime in `claims_for_session`) with revert/verify trued up; plan entry inserted; pgTAP
  `test/031-otp-login.sql`.
- **Phase 2 (db-access)** — `getDeepLink`/`sessionInfo` (queries), `requestOtpLogin`/`verifyOtpLogin`
  (mutations), `createSession(_, authMethod?)` extended, barrel updated. **`pnpm -F …fnb-db-access
  build` is GREEN.**
- **Phase 3 (auth-app)** — `server/api/otp/{link.get,request.post,verify.post}.ts`,
  `server/api/session-info.get.ts`, `server/utils/urn-route.ts`, `app/pages/go/[id].vue`; the
  `otp-login` email branch added to `n8n/workflows/send-notification.json` (JSON re-validated; SMS
  rides the existing log-sink branch — code lands in `payload.vars.code`, visible in the SMS-Test inbox).
- **Phase 4 (partial)** — the **temporary-session banner** is done: `OtpSessionBanner.vue` +
  mounted in `packages/tenant-layer/app/layouts/default.vue` (reads the non-GraphQL
  `/auth/api/session-info` route). The **share surface** is authored: `createDeepLink.graphql`,
  `useDeepLink` composable + barrel + tenant-app re-export.

**Phases 1–4 COMPLETE & built (2026-07-22, post-rebuild):**
- **Codegen matched the offline authoring exactly** — `useCreateDeepLinkMutation` emitted; input
  `_subjectUrn`/`_targetResidentId`/`_subjectLabel`, payload `uuid` all correct; no fixes needed.
- **Builds green:** `db-access`, `graphql-client-api`, `tenant-app`.
- **DB deployed + verified on the live DB** (read-only check): `auth.deep_link`, `auth.otp_login`,
  `auth.session.auth_method`, `app_fn.get_deep_link`/`verify_otp_login`, `app_api.create_deep_link`
  all present.
- **Todo "Copy quick-login link" action** — wired into `apps/tenant-app/app/pages/tools/todo/[id].vue`
  at page level: targets the assignee (`todoTree.owner.residentId`), `shareToResident(todoTree.urn,
  residentId, todoTree.name)` → copies `${authAppUrl}/go/<id>`. Non-invasive (page orchestrator, not
  the shared TodoDetail component).

**Remaining — Phase 5 only: end-to-end drive** (assign a todo → copy link → logged-out browser →
request code → read it [Mailpit email / SMS-Test inbox] → verify → land on the todo in the URN's
workspace; plus the lifetime + fail-closed + already-logged-in-switch cases).

---

## Goal

A link-driven, short-lived, app-owned **OTP login** for quick collaboration. A link to a
URN-addressed element (Todo in v1) sent to a user offers, on the landing page, "**Log in with a
code**" beside normal ZITADEL login. The code goes to the recipient's verified channel (SMS if a
verified phone exists, else email). Success mints a full-claims `auth.session` with
`auth_method='otp'` (sliding 1h idle / 8h cap), activates the URN's tenant as the workspace, and
lands on the item.

## Locked decisions (carried from the spec, do not re-litigate)

| # | Decision |
|---|---|
| D1 | OTP session = `auth.session` row, `auth_method='otp'`, **full claims**, sealed `{ id, sid }` cookie |
| D2 | Lifetime: sliding **1h idle + 8h absolute cap**, per-method branch in `app_fn.claims_for_session` |
| D3 | Channel: **both** — verified phone → SMS (log-sink dev / Twilio prod), else email; rides the `send-notification` webhook |
| D4 | Code gen/verify = **pre-claims root of trust** `app_fn.*` (SECURITY DEFINER, `authenticator`), not `notify_api`; notify does delivery only |
| D5 | ~~Recipient-bound~~ **→ superseded by D13**; landing at `/auth/go/<id>`; primary `/auth/login` untouched |
| D6 | Workspace activation inside `verify_otp_login` (new session) / `assumeResidency`+reload (existing session) — activated profile is the one resolved from the opener's contact (D13) |
| D7 | v1 responder → **Todos only** (`/tenant/tools/todo/<id>`); `resolveUrnRoute` is an extensible map |
| D8 | Deliberate scoped exception to `sms-2fa.future.md` D9 (app-owned OTP for *login*) — annotate D9 (R21) |
| D9 | Constants: **6-digit · 10-min code TTL · 5 attempts · 60s resend · 8h session cap · 7-day link** |
| D10 | ~~v1 Todo delivery = "Copy quick-login link" only~~ → **superseded by D14** (copy **and** send modal) |
| D11 | Build the **temporary-session banner** (`auth_method` + remaining time) |
| **D13** | **Link is TENANT-scoped, not recipient-bound.** No assigned user — the URN carries the tenant id; the link works for **any resident of that tenant**. The opener **self-identifies** (types their own phone/email); the server matches it to a resident of the link's tenant and sends the code there. **Enumeration-safe** (non-member = same "code sent" UX). `auth.deep_link` drops `target_profile_id`; `create_deep_link` drops its recipient arg; `request_otp_login` gains `_identifier` |
| **D14** | **Targeted "Send to residents" modal** alongside "Copy link": pick ≥1 tenant residents · message · Email/SMS checkboxes → delivers the **same tenant-scoped link** to their channels via `send-notification`. Post-claims, claims-gated; contacts resolved server-side. Does **not** bypass the OTP (recipients still self-identify on landing). SMS gated on notify Phase 0/1 (already built) |

## Dependency status — SMS pipeline ALREADY BUILT (verified on branch `sms`, 2026-07-22)

The notifications SMS Phase 0/1 the user sequenced first is **already implemented on this branch** —
no build needed. Confirmed present:
- DB: `notify.channel_preference` + `notify.phone_verification` + `notify_fn.{set_channel_preference,
  request_phone_verification,verify_phone_code}` + `notify_api` wrappers (`db/fnb-notify/deploy/
  00000000011280_notify_prefs.sql` … `011300_notify_prefs_policies.sql`); `app.profile.phone` exists
  (`db/fnb-app/deploy/00000000010220_app.sql:173`).
- Workflows: `n8n/workflows/send-notification.json` (`Record Sms Sink` log-sink branch),
  `n8n/workflows/phone-verification.json` (registered in `WORKFLOW_REGISTRY`).
- Client: `NotificationPreferences.vue` on `/auth/profile`, `/site-admin/sms-test`,
  `useNotificationPreferences`, `setChannelPreference`/`verifyPhoneCode`/`myChannelPreferences`.

**Concrete resolutions this unlocks** (former spec `[FILL IN]`s):
- **Verified-phone signal** = `notify.channel_preference` row where `channel='sms' AND verified_at IS
  NOT NULL`; SMS `destination` = that row's `destination`. Else channel `email`, destination =
  `app.profile.email`.
- **Code hashing** mirrors notify: `crypt(_code, gen_salt('bf'))`; verify `code_hash <> crypt(_code,
  code_hash)` (pgcrypto — already in use, `00000000011290_notify_prefs_fn.sql:74,118`). 6-digit gen:
  `lpad((floor(random()*1000000))::int::text, 6, '0')`.

---

## Phase 1 — DB (pre-claims root of trust), `db/fnb-app`

**New sqitch change `db/fnb-app/deploy/00000000010295_otp_login.sql`** (+ revert/verify + pgTAP).
→ skill `sqitch-expert` (plan mechanics), `fnb-db-designer` (RLS/grants), `pgtap-expert` (tests).

- [ ] `auth.deep_link` + `auth.otp_login` tables (deny-all RLS, `revoke all` — mirror `auth.session`
      at `00000000010290_session.sql:22-23`). Schema per `_shared.data.md` §3.2/§3.3. `subject_urn` is
      plain `text` (no FK — avoids fnb-res deploy-order coupling). Link TTL default `now()+'7 days'`;
      code TTL `now()+'10 minutes'`; attempts cap 5.
- [ ] Composite `app_fn.deep_link_public` (§5.1) — non-sensitive projection only (subject_label,
      module, channel, destination_masked, expired, revoked). Masking helper for phone/email.
- [ ] `app_fn.get_deep_link(_id)` / `request_otp_login(_id)` / `verify_otp_login(_id,_code)` /
      `create_deep_link(_subject_urn,_target_resident_id,_created_by_resident_id,_ttl)` — all SECURITY
      DEFINER, `set search_path = pg_catalog, public`, `grant execute … to authenticator` (mirror
      `00000000010290_session.sql:91-93`). Channel/destination resolution reads
      `notify.channel_preference` + `app.profile` (see Dependency resolutions). `request_otp_login`
      returns `(code, channel, destination_raw, destination_masked)` — raw stays server-side.
      `verify_otp_login` returns `(sid, profile_id)` (extend beyond the spec's `sid`-only for the seal).
- [ ] `app_fn.activate_profile_residency_in_tenant(_profile_id,_tenant_id) returns app.resident` —
      **mirror `app_fn.assume_residency`** (`00000000010242_app_fn_definers.sql:77-119`) but keyed by
      `(profile_id, tenant_id)` + status ∈ `('invited','active','inactive','supporting')` instead of
      `(id, email)`: deactivate the profile's other `active`/`supporting` residents, set target
      `active`, repoint `app.license.profile_id`. Raise if no enterable residency (caller → 403).
- [ ] `app_fn.session_info(_session_id) returns jsonb` — `{ auth_method, created_at, last_seen_at,
      expires_at }` for the banner; SECURITY DEFINER, granted `authenticator` (the sid lives in the
      sealed cookie, not claims — so the banner reads via an auth-app route, not GraphQL). `expires_at`
      = min(idle-window end, absolute-cap end) per `auth_method`.

**In-place edits** (rebuild-wipes-db; true up revert/verify — skill `true-up-sqitch-package`):
- [ ] `00000000010290_session.sql`: add `auth.session.auth_method text not null default 'zitadel'
      check (auth_method in ('zitadel','otp'))`.
- [ ] `app_fn.create_session` → `(_profile_id uuid, _auth_method text default 'zitadel')`, persist
      `auth_method` (default keeps the OIDC-callback call site unchanged); update grant to the new
      signature.
- [ ] `app_fn.claims_for_session` (`:50-73`): branch lifetime on `_session.auth_method` — `otp` →
      idle `1 hour` / absolute `8 hours`; else the existing `24 hours` / `7 days`. (Row already
      `select *`, so `auth_method` is in scope.)

**Post-claims surface** (two-layer, R8):
- [ ] `app_api.create_deep_link(_subject_urn, _target_resident_id)` (SECURITY INVOKER) →
      `jwt.enforce_permission('p:app-user')` on the URN's tenant → `app_fn.create_deep_link(…,
      jwt.resident_id())`. Add `auth.deep_link` SELECT policy (creator or target-profile residents)
      so PostGraphile can return the created row.
- [ ] Expose `auth` `app_api` mutations already reach PostGraphile; confirm `create_deep_link` +
      `session_info` visibility. `app_fn` stays hidden.

## Phase 2 — db-access wrappers (raw pg, pre-claims)

- [ ] `packages/db-access/src/`: `getDeepLink(id)`, `requestOtpLogin(deepLinkId)` (returns raw +
      masked destination — raw never leaves the server), `verifyOtpLogin(deepLinkId, code)` →
      `{ sid, profileId } | null`, `sessionInfo(sid)`; extend `createSession(profileId, authMethod?)`.
      `DeepLinkPublic` hand-written type in `src/types/`. **Update all three barrels** (ESM-crash rule).

## Phase 3 — auth-app landing + endpoints (pre-claims Nitro, mirror `onboard/*`)

- [ ] `apps/auth-app/server/api/otp/link.get.ts` — `getDeepLink` → public projection; also read the
      sealed cookie (`getEventClaims`) to signal State B vs State D. (Prefer resolving same-tenant
      State D server-side → 302.)
- [ ] `.../otp/request.post.ts` — `requestOtpLogin` → deliver via the internal `send-notification`
      webhook (`$fetch(`${N8N_INTERNAL_URL}/webhook/send-notification`, { 'x-fnb-webhook-secret' })`,
      template `otp-login`, `to = destination_raw`) — pattern verbatim from
      `apps/auth-app/server/api/onboard/request-password.post.ts:36-55`. 429 on cooldown; 502 on
      webhook failure. Returns `{ ok, destinationMasked }` (never the code).
- [ ] `.../otp/verify.post.ts` — `verifyOtpLogin` → on `{ sid, profileId }`: `setAppSession(event,
      { id: profileId, sid })` (sealed cookie, exactly the OIDC-callback tail); compute
      `resolveUrnRoute(subjectUrn)`; return `{ redirect }`. `null` → 401 `{ bad_code, attemptsLeft }`;
      raised "no residency" → 403 `{ no_access }`.
- [ ] `.../session-info.get.ts` — unseal cookie → `sessionInfo(sid)` → `{ authMethod, expiresAt }`
      (feeds the banner; same-origin fetch from tenant-app via Caddy `/auth`).
- [ ] `apps/auth-app/server/utils/urn-route.ts` — `resolveUrnRoute(urn)`: `parseUrn` → map
      `todo → /tenant/tools/todo/${id}` (verified `apps/tenant-app/app/pages/tools/todo/[id].vue`);
      unknown → `/`.
- [ ] Add the `otp-login` template to `n8n/workflows/send-notification.json` (Render node key —
      "Your fnb login code is {{code}}"; email subject "Your fnb login code"). SMS rides the existing
      log-sink/Twilio branch. → skill `n8n-cli`.
- [ ] `apps/auth-app/app/pages/go/[id].vue` — States A–D per `go.ui.md` (mobile-first, UCard). Verify
      Nuxt UI v4 has `UPinInput`; else `UInput` `inputmode="numeric" autocomplete="one-time-code"`.
      "Sign in with ZITADEL" passes `returnTo=/auth/go/<id>`.

## Phase 4 — create-link surface + Todo demo + banner

- [ ] `packages/graphql-client-api/src/graphql/app/mutation/createDeepLink.graphql` + codegen +
      `useDeepLink` composable (`shareToResident(subjectUrn, residentId) → /auth/go/<id> URL`) + thin
      tenant-app re-export + barrel.
- [ ] Todo detail page (`apps/tenant-app/app/pages/tools/todo/[id].vue`): **"Copy quick-login link"**
      action — build `subjectUrn` from the todo's exposed `urn`, call `shareToResident(urn,
      assigneeResidentId)`, copy URL + toast (UC7). No new notification template (D10).
- [ ] Temporary-session banner (tenant-layer shell): on mount fetch `/auth/api/session-info`; when
      `authMethod==='otp'` render a slim `UAlert`/`UBanner` (color `info`) "Quick session — expires in
      {{mins}}m". Placement: `packages/tenant-layer/app/` shell (mirror where `AppNav` mounts).

## Revision R1 — reconcile the built code to D13 (tenant-scoped, self-identify)

Precise delta over the recipient-bound build. Anchors are verified against the files on disk.

### R1.1 — DB (`db/fnb-app/deploy/00000000010295_otp_login.sql`, edit in place; true up revert/verify + pgTAP `test/031-otp-login.sql`)
- [ ] **`auth.deep_link`** (`:24-37`): **drop `target_profile_id`** (col + the `create index on
      auth.deep_link (target_profile_id)` at `:35`). Keep `target_tenant_id` as the sole scope; add
      `create index on auth.deep_link (target_tenant_id)`.
- [ ] **Composite `app_fn.deep_link_public`** (`:59-68`): **remove `channel` + `destination_masked`**
      (there is no known recipient at landing). Keep `id, subject_urn, subject_label, module, expired,
      revoked`.
- [ ] **Composite `app_fn.otp_login_dispatch`** (`:70-75`): add **`matched boolean`** as the first
      field; `code/channel/destination_raw/destination_masked` become the match payload (null when
      `matched=false`).
- [ ] **Replace `app_fn.resolve_otp_channel(_profile_id)`** (`:97-114`) with
      **`app_fn.resolve_tenant_recipient(_tenant_id uuid, _identifier text, out matched boolean, out
      profile_id uuid, out channel text, out destination text)`**: classify `_identifier` (contains
      `@` → email; else phone). **Email path:** find a resident of `_tenant_id` whose
      `app.profile.email = _identifier` (case-insensitive) → `(email, that email)`. **Phone path:**
      normalize (reuse the notify phone-normalization used by `notify_fn.request_phone_verification`,
      `db/fnb-notify/deploy/00000000011290_notify_prefs_fn.sql`) and find a resident of `_tenant_id`
      whose `notify.channel_preference` (`channel='sms' AND verified_at IS NOT NULL`) destination —
      or `app.profile.phone` — matches → `(sms, that phone)`; **only if SMS available**
      (`NOTIFY_SMS_PROVIDER`/log-sink present — the existing send path). No match → `matched=false`.
      Keep `app_fn.mask_destination` (`:85-92`) as-is (used by the send summary + audit).
- [ ] **`app_fn.get_deep_link`** (`:151-178`): drop the `resolve_otp_channel` call (`:165-166`) and
      the `_out.channel` / `_out.destination_masked` assignments (`:172-173`). Return subject/module/
      expired/revoked only.
- [ ] **`app_fn.request_otp_login`** → **`request_otp_login(_deep_link_id uuid, _identifier text)`**
      (`:182`): after the dead-link guard, call `resolve_tenant_recipient(_dl.target_tenant_id,
      _identifier)`; **`if not matched then return (matched=false, nulls); end if`** — no row, no raise
      (enumeration-safe). Cooldown check now scoped to `(deep_link_id, profile_id)`. Insert uses the
      resolved `profile_id/channel/destination` (replaces `_dl.target_profile_id` at `:214`). Return
      `matched=true` + the dispatch. Keep the `RESEND_COOLDOWN` raise (`:200-202`).
- [ ] **`app_fn.verify_otp_login`** (`:228-263`): use **`_row.profile_id`** (the profile resolved at
      request time) in place of `_dl.target_profile_id` at `:257` (`activate_*`), `:259`
      (`create_session`), `:260` (`_out.profile_id`). No recipient lookup here.
- [ ] **`app_fn.create_deep_link`** (`:298-322`): **drop `_target_resident_id`** →
      `(_subject_urn text, _created_by_resident_id uuid, _subject_label text default null, _ttl
      interval default '7 days')`. Remove the resident/profile guard (`:308-311`). Derive
      `target_tenant_id := (split_part(_subject_urn, ':', 3))::uuid` (the URN tenant; matches the
      `app_api` check at `:332`). Insert without `target_profile_id`.
- [ ] **`app_api.create_deep_link`** (`:326-337`): **drop `_target_resident_id`** →
      `(_subject_urn text, _subject_label text default null)`; body unchanged except the delegated
      call. Update **grants** (`:341-349`): `request_otp_login(uuid, text)`,
      `create_deep_link(text, uuid, text, interval)` (fn) + `create_deep_link(text, text)` (api).

### R1.2 — db-access (raw pg)
- [ ] **`queries/get-deep-link.ts`**: `DeepLinkPublic` — remove `channel` + `destinationMasked`.
- [ ] **`mutations/request-otp-login.ts`**: `requestOtpLogin(deepLinkId, identifier)`; SQL
      `select * from app_fn.request_otp_login($1::uuid, $2::text)`; `OtpLoginDispatch` gains
      `matched: boolean` and makes `code/channel/destinationRaw/destinationMasked` optional.
- [ ] `verify-otp-login.ts` unchanged (already `{ sid, profileId }`). Barrels unchanged (names same).

### R1.3 — auth-app endpoints + landing page
- [ ] **`server/api/otp/request.post.ts`**: read `identifier` from the body; `requestOtpLogin(id,
      identifier)`. **`if (!dispatch.matched) return { ok: true }`** — send nothing, respond exactly
      as success (enumeration-safe). On match, deliver as today. **Drop `destinationMasked` from the
      response** (`:46` → `return { ok: true }`).
- [ ] **`server/api/otp/link.get.ts`**: confirm it no longer reads channel/destinationMasked (shape
      shrank) — trim if it echoes them.
- [ ] **`app/pages/go/[id].vue`**: `DeepLinkPublic` (`:11-20`) drop `channel`/`destinationMasked`; add
      `const identifier = ref('')`. Insert a **step-0 input** ("Your phone or email") before the code
      step; `onSendCode` (`:94`) posts `{ id, identifier: identifier.value }`; replace the
      "We'll text/email a code to {{destinationMasked}}" block (`:253-259`) with helper text; the
      "code sent" toast (`:103`) becomes the enumeration-safe **"If that phone/email belongs to a
      member of this workspace, we've sent a code."** Add a "Use a different phone/email" link back to
      step 0.

### R1.4 — share surface (Todo)
- [ ] **`createDeepLink.graphql`** + `useDeepLink`: variable becomes **`subjectUrn` only**; composable
      export **`shareToLink(subjectUrn)`** (drop the `residentId`/`subjectLabel` args). Re-run codegen.
- [ ] **`apps/tenant-app/app/pages/tools/todo/[id].vue`** (`handleCopyLink`, `:113-128`): **remove the
      `tree.owner.residentId` gate** (`:115-119`) — call `shareToLink(tree.urn)`; the button
      (`:157-164`) is always enabled once the todo loads.

## Revision R2 — D14 targeted "Send to residents" modal (net-new)

Reuses the **same tenant-scoped link**; recipients still self-identify on landing (no bearer token).
Delivery rides the **already-built** `send-notification` webhook (notify Phase 0/1 confirmed present).

### R2.1 — DB (same `010295` change, in place)
- [ ] **`app_fn.resolve_send_recipients(_tenant_id uuid, _resident_ids uuid[], _channels text[])
      returns setof (resident_id uuid, profile_id uuid, channel text, destination text, name text)`**
      — SECURITY DEFINER: for each resident_id **that is a resident of `_tenant_id`** (silently drop
      foreign ids), for each requested channel with a deliverable contact (email → profile.email;
      sms → verified `channel_preference`/`profile.phone` **and** SMS available), emit a row. Residents
      with no deliverable contact for a ticked channel are simply absent (→ "skipped" in the summary).
- [ ] **`app_fn.send_deep_link(_subject_urn text, _resident_ids uuid[], _message text, _channels
      text[], _created_by_resident_id uuid) returns jsonb`** — SECURITY DEFINER: create the link
      (`create_deep_link`), then return `{ deep_link_id, recipients: [{residentId, channel,
      destination, name}...], requested: <count>, message }` — **the resolved recipient list for the
      caller (graphql-api server) to fan out**, plus a `summary` of `{ sent, skipped }` counts. (The
      DB does not POST n8n; the graphql-api plugin does — R2.2.)
- [ ] **`app_api.send_deep_link(_subject_urn, _resident_ids uuid[], _message text, _channels text[])`**
      — SECURITY INVOKER: `jwt.enforce_permission('p:app-user')` + the same URN-tenant check as
      `create_deep_link`; delegate with `jwt.resident_id()`. Grant to `authenticated`.
- [ ] Constant `deep-link-share` is a **notification template**, not DB — see R2.3.

### R2.2 — delivery boundary (graphql-api-app extendSchema, mirrors `triggerWorkflow`)
- [ ] Add a **`sendDeepLink` mutation** as an extendSchema plugin next to
      `server/graphile/trigger-workflow.plugin.ts` (or extend it): resolver runs `app_api.send_deep_link`
      (RLS-gated via the request's pgSettings), then for each returned recipient POSTs
      `${N8N_INTERNAL_URL}/webhook/send-notification` (`x-fnb-webhook-secret`) with
      `{ channel, templateKey: 'deep-link-share', to: destination, subject: channel==='email' ?
      '<sender> shared <label> with you' : undefined, vars: { senderName, message, subjectLabel, url },
      tenantId, profileId }` — `url = ${AUTH_APP_URL}/go/<deep_link_id>`. Returns
      `{ url, summary: { sent, skipped, requested } }`. Contacts never leave the server.
      **[FILL IN at build]** confirm the exact webhook payload contract in
      `n8n/workflows/send-notification.json` + `.claude/specs/notifications/` (the otp/request POST at
      `apps/auth-app/server/api/otp/request.post.ts:29-41` is the verified precedent).
- [ ] Add `sendDeepLink` to the `.graphql` docs + codegen; extend `useDeepLink` with
      `sendDeepLink({ subjectUrn, residentIds, message, channels })`.

### R2.3 — notification template
- [ ] Add the **`deep-link-share`** template branch to `n8n/workflows/send-notification.json`
      (email: subject "{{senderName}} shared {{subjectLabel}} with you", body includes `{{message}}` +
      `{{url}}`; sms: "{{senderName}} shared {{subjectLabel}}: {{url}} {{message}}"). SMS rides the
      existing log-sink/Twilio branch. → skill `n8n-cli`. (Same node the `otp-login` branch was added.)

### R2.4 — UI (`share-link.ui.md`)
- [ ] **"Send to residents" `UButton`** (`i-lucide-send`) beside "Copy quick-login link" on the Todo
      detail (`apps/tenant-app/app/pages/tools/todo/[id].vue`), always enabled once loaded.
- [ ] **`UModal`**: multi-select residents (`USelectMenu multiple`, options from the page's existing
      `residents` — name+id only), `UTextarea` message, two `UCheckbox` (Email default-checked; **SMS
      enabled** — notify Phase 0/1 is built), `UButton` Send (disabled until ≥1 resident **and** ≥1
      channel). On success → `useToast` "Sent to N of M residents" from `summary`; on error inline
      `UAlert`. Reactive state per `share-link.ui.md`.
- [ ] Optional secondary "Copy link instead" inside the modal (reuses `shareToLink`).

## Phase 6 — D15: standard (ZITADEL) login returns to the deep link (delta, 2026-07-22)

The Phase-3 line "Sign in with ZITADEL passes `returnTo=/auth/go/<id>`" was **never built** — the go
page renders a bare `<LoginForm />`, `loginWithRedirect()` takes no args, and the OIDC callback
hard-redirects to `/auth/login?oidc=success` → `goHome()` → `/`, so a deep-link opener who picks the
standard path lands on home and loses the item (OTP already lands on the item). D15 threads a
`returnTo` root-relative path through the whole ceremony. Spec: `auth-app/login.data.md` §Return-to
(owner) + `otp-login/go.ui.md` State B / `go.data.md`. **No DB / no GraphQL / no codegen** — auth
packages + auth-app only.

### Execution status (2026-07-22) — code DONE + build-gated; env-drive pending (user-run)
All 7 code changes landed; `fnb-types`, `fnb-auth-ui`, and `fnb-auth-app` builds **GREEN**
(`isSafeReturnTo` present in `fnb-types/dist`; `loginWithRedirect(returnTo?)` in `auth-ui/dist`;
all four auth-app server/page chunks bundled). Backward-compatible: the only other consumers —
`setup.vue` `loginWithRedirect()` and `login.vue` `<LoginForm />` — pass no returnTo → home,
unchanged. Env drive (last box) is user-run — not performed here.

- [x] **`packages/fnb-types/src/return-to.ts`** — pure `isSafeReturnTo(value): value is string`
      (root-relative: one leading `/`, not `//` / `\`, no control chars 0x00–0x1F/0x7F, ≤2048).
      Barrel-exported from `src/index.ts`. Beside `parseUrn` (the runtime-helper exception). Built.
- [x] **`packages/auth-ui/src/use-auth.ts`** — `loginWithRedirect(returnTo?: string)` appends
      `?returnTo=${encodeURIComponent(returnTo)}` when a non-empty string; `UseAuthReturn` signature
      updated. Built (dist `.d.ts` shows the new arg).
- [x] **`packages/auth-layer/app/components/LoginForm.vue`** — `defineProps<{ returnTo?: string }>()`;
      button calls `loginWithRedirect(props.returnTo)`. Bare `<LoginForm />` unchanged → home.
- [x] **`apps/auth-app/server/api/auth/oidc/login.get.ts`** — parks `oidc_return_to` (TXN_COOKIE
      flags) when `isSafeReturnTo(getQuery(event).returnTo)`.
- [x] **`apps/auth-app/server/api/auth/oidc/callback.get.ts`** — reads + deletes `oidc_return_to`;
      builds the `/login` redirect via `URL`, adds `?oidc=success` and `&returnTo=` (re-checked
      `isSafeReturnTo`) — stays a query on the `/login` hop.
- [x] **`apps/auth-app/app/pages/login.vue`** — new `finishLogin()` navigates to a valid
      `route.query.returnTo` (`isSafeReturnTo`) else `goHome()`; called on **both** the single-residency
      (`onLoginSuccess`) and modal-select (`onSelectResidency`) paths.
- [x] **`apps/auth-app/app/pages/go/[id].vue`** (`:248`) — `<LoginForm :return-to="`/auth/go/${linkId}`" />`.
- [ ] **Env drive (user-run):** deep link → "Sign in with ZITADEL" → full ZITADEL round-trip → back
      on `/auth/go/<id>` logged-in → State D → the Todo in the URN's tenant. Open-redirect guard: a
      tampered `?returnTo=https://evil` / `//evil` / `\evil` / a CRLF value falls back to home.

## Phase 5 — verify end-to-end (read-only; ask the user to run the env — never rebuild yourself)

- [ ] **D13 flow:** fresh rebuild → create a Todo (**assigned OR unassigned** — gate removed) →
      "Copy quick-login link" → open in a logged-out browser → **enter your own phone/email** →
      request code (email via Mailpit `:8025`; SMS via the log-sink SMS-Test inbox for a verified
      phone) → verify → land on the Todo in the **URN's tenant** (workspace switched).
- [ ] **Enumeration-safe:** entering a phone/email that is **not** a resident of the link's tenant →
      the **same** "code sent" response, no code issued, verify fails closed — no member/non-member
      signal anywhere in the responses.
- [ ] **D14 send modal:** "Send to residents" → pick 2 residents, type a message, tick Email (+SMS
      for a verified-phone resident) → Send → each gets the `deep-link-share` notification with the
      `/auth/go/<id>` URL; "sent to N of M" reflects any skipped (no-contact) recipients. Opening the
      delivered link still requires the OTP self-identify (no auto-login).
- [ ] Lifetime: idle >1h dead; activity <1h renews; past 8h → fresh-code required. Wrong/expired/
      attempts-exhausted code fails closed (401/403, no 500). Already-logged-in same-tenant vs
      different-tenant (auto-switch) paths. Banner shows + counts down for the OTP session.
- [ ] `pnpm build` green (the gate; repo-wide lint is known-broken).

## Docs to update on completion (R21)
`sms-2fa.future.md` D9 annotation (scoped exception); `CLAUDE.md` auth model + `graphql-api-pattern.md`
(auth_method + the new pre-claims fns); `future-auth/session-refresh-pattern.md` (auth_method column +
OTP lifetime); `fnb-stack-implementor` SKILL root-of-trust inventory; `package-layers-pattern.md`
(db-access wrappers). Flip the `otp-login` spec files' status to Implemented and retro-check the task
list.

## Notes / resolved intake items
- `notify-sms-spec-reconcile` (`.claude/issues/identified/0370…`) already tracks truing the
  notifications README checkboxes to the built code — out of scope here, referenced for context.
- No env/rebuild performed by the implementor — Phase 5 verification is user-run then read-only checks
  (memory `feedback_rebuild_ask_user`).
