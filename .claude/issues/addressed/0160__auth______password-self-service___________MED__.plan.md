# Password Self-Service — forgot-password + change-password + admin-reset

> **Execution Directive:** implement this plan via `/fnb-stack-implementor <this plan>` — the
> implementor executes the Suggested Sequence below in order. Source spec:
> `.claude/specs/password-self-service/` (README + `_shared.data.md` + the ui/data/workflow files).
> Derived from that README's Implementation Task List (Phases 0–4).

## Status
**Done (verified live 2026-07-23).** Phases 0–3 built; both env-side steps confirmed (n8n
`forgot-password` active + graphql-api registry loaded); forgot-password verified end-to-end to
email delivery (Mailpit), incl. the enumeration-safe unknown-email no-op and 400 validation. Only
the interactive browser walkthrough of change-password + the admin-reset button remains (deferred to
user testing; both sit on proven-live layers). See "Live verification (2026-07-23)" below.

Done this session:
- **Phase 0** — ZITADEL v4.15.3 `SetPassword` `currentPassword` arm CONFIRMED live (throwaway-user
  probe, deleted after): correct current → 200; wrong current → 400 `zitadel.v1.CredentialsCheckError`;
  weak new → 400 `zitadel.v1.ErrorDetail`. Discriminate on the detail `@type`. Recorded in
  `_shared.data.md` (call D).
- **Phase 1** — `n8n/workflows/forgot-password.json` (3-node trim of invite-user: Webhook → Resolve
  Reset Link Code node [search by email → no-user `return []` → `password_reset` → setPasswordUrl] →
  Send Email → send-notification). `apps/auth-app/server/api/forgot-password.post.ts` (unauth,
  always-200, `502` only on webhook failure). `apps/auth-app/app/pages/forgot-password.vue` (generic
  `sent` state). Home hero "forgot password?" `ULink`. **Verified live:** route 400s on empty/
  malformed email (no side effects), page 200s, home link renders.
- **Phase 2** — `packages/db-access` `selectMyIdpUserId` (RLS `view_self`, via withClaims — NO DB
  migration needed; the existing policy is the gate) + barrel. `zitadel-admin.ts` `changeOwnPassword`
  (call D, typed discriminator). `apps/auth-app/server/api/profile/change-password.post.ts` (auth,
  self-only). `packages/auth-layer` `ChangePasswordForm.vue` (3-field). Two-column `profile.vue`.
  **Verified live:** route 401s without a session (module loaded, db-access import resolved).
  Both packages build green; packages-watch rebuilt in-container dist.
- **Phase 3** — `'forgot-password': { permission: 'p:app-admin' }` in `WORKFLOW_REGISTRY`.
  `useAdminResetPassword` (graphql-client-api) + barrel + tenant-app re-export. "Send password reset"
  button + confirm `UModal` on `admin/user/[id].vue` (gated `p:app-admin`).

**Deviation from the plan (deliberate):** Phase 2 step 7's `app_api.my_idp_user_id()` sqitch
migration was NOT created. Instead the read is a `db-access` `selectMyIdpUserId(client)` run under
`withClaims` — the identical RLS guarantee (the existing `view_self` policy is the gate; a
super-admin is still constrained by `where id = jwt.uid()`), matching the msg WS carve-out
precedent, with zero schema change / no sqitch deploy / no GraphQL surface. `_shared.data.md`'s
"one new DB read helper" is realized as this TS query, not a DB function.

- **Gap-fill (post-rebuild, 2026-07-22)** — user hit ZITADEL's built-in "Forgot password?" link on
  the hosted login (a competing, SMTP-less dead end). Fixed: instance login policy
  `hidePasswordReset: true` — applied live (`PUT /admin/v1/policies/login`, 200) **and** persisted
  in `docker/zitadel/seed.mjs` (`ensureLoginPolicy`, runs dev+prod). Verified live: `hidePasswordReset
  = true`; seed `node --check` passes. Now the home-page flow is the only reset path. (zitadel-expert.)

### Env-side steps — DONE (verified live 2026-07-23)
1. **n8n**: `forgot-password` workflow is imported **and active** (`n8n list:workflow --active=true`
   → `ForgotPass01Fnb|forgot-password`). ✓
2. **graphql-api-app**: restarted; `WORKFLOW_REGISTRY['forgot-password'] = { permission: 'p:app-admin' }`
   loaded (`trigger-workflow.plugin.ts:38`). ✓

### Live verification (2026-07-23) — forgot-password proven end-to-end
- **Route** `/auth/api/forgot-password`: well-formed email → **200 `{ok:true}`** (webhook chain live,
  not 502); malformed / empty body → **400** (no side effects). ✓
- **Full chain to email**: reset for a known seeded user (`my-app-tenant-admin@example.com`) →
  Mailpit received **"Reset your fnb password"** to that address (route → n8n webhook → resolve
  reset-link code [ZITADEL] → send-notification → SMTP). ✓
- **Enumeration-safe no-op**: unknown email (`nonexistent-probe@…`) → 200, no email generated. ✓
- All code surfaces present + built: forgot-password route/page, `change-password.post.ts`,
  `ChangePasswordForm` mounted in `profile.vue`, db-access `selectMyIdpUserId` (+ barrel),
  `useAdminResetPassword`, admin-reset button on `admin/user/[id].vue`.

### Remaining — user browser walkthrough only (deferred to user testing)
- Change-password happy path + wrong-current inline error + weak-new policy toast (needs an
  interactive ZITADEL login).
- Admin-reset **button** click — fires the same `triggerWorkflow('forgot-password')` workflow proven
  above to deliver email, so verified at every layer beneath the click.

## (original) Status
Identified (2026-07-22). Authored from the spec README; not started. Direct successor to
`0150__auth______user-invitation` — reuses the whole ZITADEL admin client + `send-notification`
pipeline + `set-password` page/route/template that plan landed live.

## Category / severity
`auth` / `MED` — net-new capability (no existing breakage), spanning db (one RLS-gated read fn) +
one n8n workflow + two auth-app routes (one unauth, one auth) + one home-page link + one profile
form + one tenant-app admin action. Credential-adjacent but adds **no new tables** and **no new
ZITADEL transport**.

## Goal
Bring the two password touchpoints ZITADEL's hosted UI would own **into fnb** (user directive
"not zitadel landing"):
1. **Forgot password** — a home-page "forgot password?" link → public `/auth/forgot-password` page
   → an n8n workflow that is the **second half of `invite-user`** (search by email →
   `password_reset` return-code → `set-password` email) → the existing set-password tail.
2. **Change password** — a **self-only** 3-field form on `/auth/profile` (new column) →
   ZITADEL verifies the current password.
3. **Admin reset** — the "p:app-admin in their tenant" half, realized as a *send-reset-email*
   action on the tenant-app user detail page (admin never sets/knows the password).

Success = (a) home → forgot-password → email → set-password → login works, and an unknown email
sends **no** email + reveals nothing; (b) a logged-in user changes their password with the correct
current one; (c) a tenant admin fires a reset email for a user in their tenant.

## Locked decisions (from the spec README — P1–P4, C1–C3, A1–A2, R1)
Forgot-pw entry = **muted text link** under `sign in` (P1) · engine = **n8n `forgot-password`
workflow** = invite-user's second half (P2) · public trigger = **unauthenticated auth-app route**
POSTing the webhook with the shared secret, NOT `triggerWorkflow` (P3) · **no account enumeration**
— route always 200, workflow `return []` for unknown users (P4) · change-pw **requires the current
password** (C1) · change-pw **self-only**, target from the session, RLS `view_self` (C2) ·
change-pw is a **direct auth-app route → ZITADEL**, never n8n — passwords must not hit the run log
(C3) · admin path = **send reset email** not a direct set (A1) · admin gate =
`triggerWorkflow('forgot-password', { email })` gated **`p:app-admin`**, tenant-scoped by
`app.resident` RLS (A2) · one new DB read **`app_api.my_idp_user_id()`** SECURITY INVOKER (R1).

## Verified anchors (resolved at plan time)

- **ZITADEL admin client** → `apps/auth-app/server/utils/zitadel-admin.ts` already has
  `requestPasswordReset` (call B), `setPassword`, `getUser`, and the node:http split-horizon
  transport + PAT read. **Add** `changeOwnPassword(userId, current, next)` (call D — set-password
  with `currentPassword` verification). The email-search primitive (call A) already exists **inline
  in the invite-user Code node** (`n8n/workflows/invite-user.json:63`, the 409 branch) — the new
  workflow lifts that block; no auth-app util needed for the search.
- **`triggerWorkflow` registry** → `apps/graphql-api-app/server/graphile/trigger-workflow.plugin.ts`
  (`WORKFLOW_REGISTRY`, line 14). Add `'forgot-password': { permission: 'p:app-admin' }` next to
  `'invite-user'`. Plugin injects `tenantId`/`profileId` (workflow ignores them) and POSTs
  `${N8N_INTERNAL_URL}/webhook/forgot-password` with `x-fnb-webhook-secret`.
- **Client dispatch pattern** → `useSendTest` / `useInviteUser` wrap **`useTriggerWorkflow`**
  (`packages/graphql-client-api/src/composables/useTriggerWorkflow.ts`), NOT the raw generated hook.
  `useAdminResetPassword` mirrors them (the spec's `admin-reset.data.md` sketch importing
  `useTriggerWorkflowMutation` is superseded — use `useTriggerWorkflow`).
- **Unauth → n8n webhook precedent** → `apps/auth-app/server/api/onboard/request-password.post.ts`
  already POSTs an internal n8n webhook (`send-notification`) with the shared secret via
  `process.env.N8N_INTERNAL_URL` + `N8N_WEBHOOK_SECRET`. The new `forgot-password.post.ts` uses the
  exact same call shape against `/webhook/forgot-password`.
- **`set-password` tail (reused verbatim)** → page `apps/auth-app/app/pages/set-password.vue`
  (public, `?userId&code`), route `server/api/onboard/set-password.post.ts`, and the `set-password`
  template in `send-notification`'s Render Code node — all live from `0150`. Forgot-password lands
  on these unchanged.
- **RLS `view_self`** → `db/fnb-app/deploy/00000000010250_app_policies.sql:30`
  (`view_self ON app.profile USING (jwt.uid() = id)`). The new `app_api.my_idp_user_id()`
  (SECURITY INVOKER) relies on it to return only the caller's own `idp_user_id`.
- **`app.profile.idp_user_id`** → added in `db/fnb-app/deploy/00000000010270_profile_idp_user.sql`
  (`text unique`, nullable — null until first OIDC login). The change-pw route 409s when null.
- **Session claims server-side** → `getEventClaims(event)`
  (`packages/auth-layer/server/utils/getEventClaims.ts`) → `{ user, claims }`; unauth → undefined.
  `withClaims(claims, fn)` (2-arg, `packages/db-access/src/with-claims.ts`) runs the RLS-gated read.
- **Home hero** → `apps/home-app/app/pages/index.vue:16-22` (the `sign in` `UButton`, logged-out
  branch); `authAppUrl` already destructured (line 114). Add a `ULink` beneath it.
- **Profile page** → `apps/auth-app/app/pages/profile.vue` (single `max-w-md` card today; has
  `middleware: 'auth'`). Becomes a two-column grid: `<UserProfile>` | `<ChangePasswordForm>`.

## Anchors to resolve during execution (read the sibling, don't guess)
- The `UForm` **validator** for the change-pw double-entry + complexity schema — model
  `apps/auth-app/app/pages/set-password.vue` (same policy applies; reuse its fragment).
- Public-route meta convention for `forgot-password.vue` — model `set-password.vue` /
  `verify-email.vue` (they omit `middleware: 'auth'`).
- The `p:app-admin` UI gate + where the target email is on the tenant-app user detail page —
  model the existing admin user detail (`apps/tenant-app/app/pages/tenant/admin/user/[id].vue`);
  default gate `useAuth().user.value.permissions.includes('p:app-admin')`.
- Whether `ChangePasswordForm` lives in `packages/auth-layer` (beside `UserProfile.vue`) and is
  auto-imported by the auth-app profile page — confirm the layer's component auto-import.

## Suggested Sequence

### Phase 0 — ZITADEL confirmation (no code)  → skill: `zitadel-expert`
1. Confirm the v4.15.3 `SetPassword` **`currentPassword`** verification arm (call D): body
   `{ newPassword:{ password, changeRequired:false }, currentPassword }`, and that a **wrong current
   password** returns a **distinguishable 4xx** (mapped to `401 wrong-current`, vs a `422` policy
   fail). Note the `password_reset` code TTL for the expired-link copy. Record the confirmed shape
   back into `_shared.data.md` (the call-D row) — the one genuine runtime unknown.

### Phase 1 — Forgot password (the core "second half" ask)  → skills: `n8n-cli`, `zitadel-expert`
2. **`n8n/workflows/forgot-password.json`** — 3-node trim of `invite-user.json`: Webhook
   (`path: forgot-password`, headerAuth `fnb-webhook-secret`, `onReceived`) → **Resolve Reset Link**
   Code node (lift invite-user's 409 branch: PAT read → search by email → **no user ⇒ `return []`**
   → `password_reset` returnCode → build `setPasswordUrl` → emit the send-notification payload,
   `templateKey:'set-password'`, subject "Reset your fnb password") → **Send Email** HTTP Request →
   `send-notification` (`fnb-webhook-secret` credential). Shared `error-handler` as Error Workflow.
   Register in `n8n-import`. (n8n gotchas: `process.env` not `$env`; no `URL` global; internal call
   uses `http://n8n:5678`; iterate = import+publish+**restart** — see [[n8n-code-node-gotchas]].)
3. **`apps/auth-app/server/api/forgot-password.post.ts`** (unauth) — validate `email` present +
   format (400 on malformed) → POST `${N8N_INTERNAL_URL}/webhook/forgot-password` with
   `x-fnb-webhook-secret`, body `{ email }` → **always `200 { ok:true }`**; `502` only on
   webhook-transport failure. (Same call shape as `request-password.post.ts`.)
4. **`apps/auth-app/app/pages/forgot-password.vue`** (public) — `UCard` + logo chrome like
   `set-password.vue`; email `UForm` → on any 2xx set `state='sent'` (generic "if an account
   exists…" — never branch on existence); network/500 → error toast. Icons `i-lucide-mail`,
   `i-lucide-mail-check`.
5. **`apps/home-app/app/pages/index.vue`** — add a muted `ULink` "forgot password?" (href
   `${authAppUrl}/forgot-password`, external) directly under the `sign in` button, **logged-out
   branch only** (UC3/UC6).
6. **Verify (live)** — home link → page → email in Mailpit with a working `setPasswordUrl` → the
   existing set-password page sets the password → login works. **Unknown email → 200 + no email
   sent** (check Mailpit is empty + no `notify.notification` row).

### Phase 2 — Change password (self, on the profile page)  → skills: `sqitch-expert`, `zitadel-expert`
7. **DB** — new **`fnb-app`** sqitch change (after `00000000010270_profile_idp_user`):
   `app_api.my_idp_user_id() returns text` LANGUAGE sql STABLE **SECURITY INVOKER**
   `set search_path = pg_catalog, public` → `select idp_user_id from app.profile where id = jwt.uid()`;
   `grant execute … to authenticated`. deploy/revert/verify. RLS `view_self` is the gate — no new
   policy. (No `git` during the sqitch session.)
8. **`zitadel-admin.ts`** — `changeOwnPassword(userId, current, next): ChangePasswordResult`
   (`{ok:true} | {ok:false,kind:'wrong-current'|'policy',message}`) → `POST /v2/users/{id}/password`
   `{ newPassword:{ password:next, changeRequired:false }, currentPassword:current }`; discriminate a
   wrong-current 4xx (message references current/credential/old) from a policy 4xx; 5xx/transport
   throws.
9. **`apps/auth-app/server/api/profile/change-password.post.ts`** (auth) — body `{ current, next }`
   (NO userId) → `getEventClaims` (401) → validate + server-side `next` complexity + `next!==current`
   (400) → `withClaims(claims, my_idp_user_id)` (409 if null) → `changeOwnPassword` → map:
   200 / 401 wrong-current / 422 policy / 502. **Never log the passwords.**
10. **`packages/auth-layer` `ChangePasswordForm.vue`** — `UCard` + 3-field `UForm` (current, new,
    confirm; complexity hint mirrors set-password; confirm===new + new!==current inline) → submit
    `POST /auth/api/profile/change-password` → success toast + clear; wrong-current → inline error on
    Current; policy → toast; 409 → toast. Icons `i-lucide-lock`, `i-lucide-lock-keyhole`.
11. **`apps/auth-app/app/pages/profile.vue`** — two-column grid (`md:grid-cols-2`, stacks on mobile,
    UC5): `<UserProfile>` | `<ChangePasswordForm>`; remove the "ZITADEL self-service" note. Confirm
    the layer component auto-import.
12. **Verify (live)** — correct current → password updates + re-login works with the new one; wrong
    current → inline "incorrect"; weak new → policy toast; the fnb session survives the change.

### Phase 3 — Admin reset (the "p:app-admin in their tenant" half)  → skills: `n8n-cli`
13. **Registry** — add `'forgot-password': { permission: 'p:app-admin' }` to `WORKFLOW_REGISTRY`.
14. **`useAdminResetPassword()`** in graphql-client-api (mirror `useInviteUser` → `useTriggerWorkflow`,
    `workflowKey:'forgot-password'`, `inputData:{ email }`) + thin tenant-app re-export +
    **barrel export** (the #1 miss).
15. **tenant-app UI** — "Send password reset" `UButton` (`variant="outline"`,
    `icon="i-lucide-key-round"`, gated `p:app-admin` — hide, not disable) + `UModal` confirm on
    `tenant/admin/user/[id].vue`, using the target email already on the page → `reset(email)` → toast.
16. **Verify (live)** — admin resets a tenant user → that user gets a set-password email; button
    hidden for non-admins.

### Phase 4 — Hardening (deferred — note, don't build unless asked)
- Rate-limit the unauthenticated `forgot-password` route (IP + email); pair with the always-200
  no-enumeration response.
- Expired/consumed-code "request a new link" UX — the set-password page already has an `expired`
  state; confirm the copy for the forgot-password entry point.
- Admin-reset strict tenant enforcement: pass `residentId` + a `SECURITY DEFINER
  app_fn.resident_email_for_reset(_resident_id)` asserting `jwt.has_permission('p:app-admin',
  r.tenant_id)`, if the bounded-harm arbitrary-email residual is deemed insufficient.
- A distinct `password-reset` email template/subject (vs reusing `set-password`).

## Out of Scope (do NOT build here)
- Any change to the `set-password` page/route/template or the OIDC login/`provision_idp_user`
  linker — all reused unchanged.
- A direct admin "set another user's password" path (rejected A1 — reset email only).
- Change-password via n8n (rejected C3 — no chosen password in the run log).
- A new `app.profile` policy for `p:app-admin` to read/change tenant members' credentials
  (unnecessary — direct change is self-only; admin path is a reset scoped by `app.resident` RLS).

## Open items to confirm during execution (defaults set)
- **ZITADEL `currentPassword` field + wrong-password 4xx** (Phase 0) — the one runtime unknown;
  confirm before wiring call D.
- **Self change-pw + fnb session** — expected the sealed session survives (independent credential);
  confirm no forced re-login is needed. Default: keep the session.
- **Reset email template** — default reuse `set-password` (subject override only); a distinct
  `password-reset` template is optional polish.
- **Admin-reset arbitrary-email residual** — default accept bounded harm for v1 (reset email only);
  the `residentId` DB-gated variant is the Phase 4 hardening if wanted.
