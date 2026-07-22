# User Invitation — ZITADEL-driven onboarding ceremony

> **Execution Directive:** implement this plan via `/fnb-stack-implementor <this plan>` — the
> implementor executes the Suggested Sequence below in order. Source spec:
> `.claude/specs/user-invitation/` (README + `_shared.data.md` + `zitadel-admin-client.md` +
> the workflow/UI/data files). Derived from that README's Implementation Task List (Phases 0–4).

## Status
In-flight (2026-07-22). **ALL PHASES (0–3) AUTHORED + VERIFIED LIVE END-TO-END.** The full
ceremony passes headlessly through the real routes: invite → resident + ZITADEL user + email #1 →
`verify-email` (ZITADEL email `verified:true` + U5 cookie; **request-password 401 without the
cookie**, 200 with) → email #2 → `set-password` → **the invitee authenticates with the new
password (ZITADEL session 201 = login works)**. Only remaining unverified surface: the Vue pages +
InviteUserModal need a browser click-through (routes/composables they call are all proven), and the
OIDC-first-login → resident activation is the pre-existing `provision_idp_user` linker (unchanged).

Done this session (authored + offline checks):
- **Phase 0** — ZITADEL v4.15.3 v2 contract confirmed live (probe) + recorded in
  `zitadel-admin-client.md`; two corrections (verify = `/email/verify` no underscore; 409 →
  `password_reset`). Admin client extended (`apps/auth-app/server/utils/zitadel-admin.ts`:
  `verifyEmail`/`requestPasswordReset`/`setPassword`/`getUser`). n8n service wired in
  `docker-compose.yml` (zitadel-seed ro mount + `NODE_FUNCTION_ALLOW_BUILTIN=fs,http,https` +
  webhook-secret/internal-url/ZITADEL/auth-app-url env). No `.env` change needed (all vars pre-exist).
- **Phase 1** — new `fnb-n8n` sqitch change `00000000011240_n8n_worker_app_invite` (grant
  n8n_worker execute on `app_fn.invite_user`). **Ordering lesson (fixed after a failed rebuild):
  the grant must live in `fnb-n8n`, NOT `fnb-app` — `fnb-app` deploys BEFORE `fnb-n8n`, so the
  `n8n_worker` role does not exist yet when `fnb-app` runs (`Missing required change:
  fnb-n8n:…011230`). Same rule as the notify/asset worker grants.** Registry entry
  `'invite-user': { permission: 'p:app-admin' }`. `n8n/workflows/invite-user.json` (Webhook →
  Postgres invite_user → Code node: PAT read + ZITADEL create/409→password_reset + internal
  send-notification POST). `send-notification` Render node → Code node with `user-invitation` +
  `set-password` templates (generic path preserved). tenant-app `InviteUserModal.vue` +
  `useInviteUser` composable (+ barrel + re-export) — package **builds green**.

**Phases 0 + 1 VERIFIED LIVE (2026-07-22)** after env rebuild + n8n iteration. The full invite
chain passes end-to-end: trigger → execution `success`, `invited` resident, ZITADEL user
(unverified/no-password), `user-invitation` email in Mailpit with a working `verifyUrl`, and a
`notify.notification` (`user-invitation | sent | email`) row. The **409 re-invite** branch also
verified: re-inviting an existing user succeeds and sends the `set-password` email instead
(no email-code resend), `set-password | sent`.

Live corrections to the invite-user workflow (n8n sandbox gotchas — see [[n8n-code-node-gotchas]]):
- n8n `$env` is **blocked** in node expressions AND Code nodes ("access to env vars denied") →
  config reads `process.env` inside the Code node (with dev fallbacks); the webhook secret comes
  from the `fnb-webhook-secret` credential on an HTTP Request node (never in code/JSON).
- The task-runner Code sandbox has **no `URL` global** → origins parsed with string ops.
  `require('fs')/('http')` work (via `NODE_FUNCTION_ALLOW_BUILTIN`); outbound `http.request` works.
- Internal self-call must use the service name `http://n8n:5678` — `localhost` → `::1` (IPv6) but
  n8n listens IPv4-only → `ECONNREFUSED`.
- Iterating a workflow on a running n8n = `import:workflow` + `publish:workflow` + **restart** (all
  three; import deactivates, and webhooks only register at startup).

Final `invite-user` graph: Webhook → Create Resident (Postgres) → Invite Via ZITADEL (Code:
PAT+ZITADEL create/409→password_reset) → Send Email (HTTP Request → send-notification w/ credential).

**Phases 2–3 AUTHORED (2026-07-22), pending live verify.** Files:
`apps/auth-app/server/utils/onboard-cookie.ts` (U5 sealed cookie, reuses NUXT_SESSION_SECRET);
routes `server/api/onboard/{verify-email,request-password,set-password}.post.ts` (use the Phase-0
`zitadel-admin.ts` client; request-password POSTs email #2 to send-notification via
`process.env.N8N_INTERNAL_URL`+secret, gated by the onboard_verified cookie); pages
`app/pages/{verify-email,set-password}.vue`; `login.vue` `?welcome=1` notice. auth-app compose env
gained `N8N_INTERNAL_URL`+`N8N_WEBHOOK_SECRET` → **needs `docker compose up -d auth-app` (recreate)
to load the env** (pages/routes otherwise hot-reload). Password floor mirrors first-run-setup
(8/number/symbol; ZITADEL is the authority → 422 verbatim) — resolves the set-password `[FILL IN]`.

Verify plan (headless, via the routes): fresh invite → pull userId+code from email #1 →
POST verify-email (200 + cookie) → POST request-password (200 + email #2) → pull code from email #2
→ POST set-password (200) → confirm the ZITADEL user can now log in.

Cleanup TODO: orphan `invite-test-*@example.com` ZITADEL users + residents from verification.

## Category / severity
`auth` / `MED` — net-new capability (no existing breakage), but it stands up a credential-bearing
onboarding ceremony across db + graphql + n8n + ZITADEL + two unauthenticated auth-app pages.

## Goal

Turn the current *lazy* invite (email-match on first login only) into a real **"Invite User"**
action: eager ZITADEL user creation → invitation email → a two-page verify-email → set-password
ceremony → normal OIDC login. ZITADEL stays the sole credential store (D5 return-code mode); n8n
stays the sole email sender (reuses `send-notification`); the DB keeps its resident/email-match
model. This spec only **adds** an eager path in front of the lazy one.

Success = a fresh invitee receives email #1, verifies, receives email #2, sets a password, and
signs in via the ZITADEL hosted login — where the existing `provision_idp_user` email-matches and
activates the `invited` resident.

## Locked decisions (from the spec README — U1–U8)
Ceremony pages in **auth-app** (unauthenticated) · invite orchestration in an **n8n
`invite-user` workflow** (R22) · **auto-verify on page load** then a button for email #2 · **ZITADEL
return-code mode** (emailed links carry ZITADEL's own single-use codes; no fnb-minted credential) ·
invite = **async** fire-and-forget, ceremony routes = **synchronous** auth-app server routes ·
resident via **reused `app_fn.invite_user`** as `n8n_worker` · invite gated **`p:app-admin`** ·
ZITADEL admin auth via the existing **`fnb-seeder` PAT** over the split-horizon transport.

## Verified anchors (resolved at plan time)

- **`triggerWorkflow` registry** → `apps/graphql-api-app/server/graphile/trigger-workflow.plugin.ts`
  (`WORKFLOW_REGISTRY`, ~line 17). Plugin 401s w/o claims, checks `permission`, injects
  `tenantId`/`profileId`, POSTs `${N8N_INTERNAL_URL}/webhook/<key>` w/ `x-fnb-webhook-secret`.
  Add `'invite-user': { permission: 'p:app-admin' }` next to `'send-notification'`.
- **Client dispatch pattern** → `useSendTest` (`packages/graphql-client-api/src/composables/useSendTest.ts`)
  wraps **`useTriggerWorkflow`** (`./useTriggerWorkflow`), NOT the raw generated hook. `useInviteUser`
  mirrors `useSendTest` exactly (the spec sketch in `admin-invite.data.md` importing
  `useTriggerWorkflowMutation` is superseded by this — use `useTriggerWorkflow`).
- **`send-notification` workflow** → `n8n/workflows/send-notification.json`. Its **Render** node
  (~lines 69–75) is generic today: `subject` ← `body.subject`; html ← `vars.html || vars.body ||
  '<p>'+templateKey+'</p>'`. There is **no per-`templateKey` store yet** → this plan adds a
  `templateKey → HTML` switch (or a Set/Code template map) covering `user-invitation` + `set-password`.
  Called via **Execute Workflow** from `invite-user`, and via an **internal webhook POST**
  (`${N8N_INTERNAL_URL}/webhook/send-notification` + secret) from the `request-password` route.
- **`app_fn.invite_user`** → `db/fnb-app/deploy/00000000010242_app_fn_definers.sql:269`
  (`(_tenant_id uuid, _email citext, _assignment_scope … default 'user') returns app.resident`,
  SECURITY DEFINER, idempotent). **`n8n_worker` currently has NO execute grant on it** (grep of
  `db/fnb-app/` found none; notify only grants `notify_fn`) → **§1 adds the grant** (new `fnb-app`
  change), mirroring the notify grant precedent (`db/fnb-notify/deploy/…011270_notify_policies.sql:32-35`).
- **ZITADEL split-horizon transport** → reuse `apps/auth-app/server/utils/oidc.ts`'s `node:http`
  helper (~lines 73–92; undici strips a `Host` override — verified) for the auth-app admin calls;
  factor a shared ZITADEL admin client rather than hand-rolling a second fetch.
- **Sealed cookie util** → `packages/auth-layer/server/utils/session.ts` (`NUXT_SESSION_SECRET`) is
  reused for the short-lived `onboard_verified` httpOnly cookie (U5 handshake).
- **PAT file** → written to the shared `zitadel-seed` volume at `ZITADEL_FIRSTINSTANCE_PATPATH`;
  auth-app already mounts the seed dir (reads `clientId` via `NUXT_ZITADEL_SEED_FILE`).
- **Residents page** → `apps/tenant-app/app/pages/admin/user/index.vue` (renders `PageHeader` +
  `ResidentList` off `useAdminResidents`); component `apps/tenant-app/app/components/PageHeader.vue`.

## Anchors to resolve during execution (read the sibling, don't guess — the spec's `[FILL IN]`s)
- Exact `p:app-admin` UI helper on a sibling admin page (spec default: `useAuth().user.value.permissions.includes('p:app-admin')`).
- Whether `PageHeader.vue` exposes a trailing/actions slot; else a `flex justify-between` row (UC5).
- The auth-layer **public-route** meta convention (model: `apps/auth-app/app/pages/login.vue`).
- The `UForm` **validator** used by existing forms (model: the notifications `send-test.vue` /
  `login.vue`) for the set-password double-entry schema.

## Suggested Sequence

### Phase 0 — ZITADEL admin client + PAT delivery  (spec: `zitadel-admin-client.md`)  → skill: `zitadel-expert`
1. **Confirm the v4.15.3 v2 contract against the running instance** (the spec's checklist): the
   `returnCode` vs `sendCode` selector; the inline `emailCode`/`verificationCode` field names;
   `POST /v2/users/{id}/password_reset` path; `.../email/_verify` + `.../password` field spellings;
   the v2 user-search path for the 409 lookup. Record confirmed shapes back into `zitadel-admin-client.md`.
2. **Shared ZITADEL admin client** — factor a helper (auth-app `server/utils/`) that reads the
   `fnb-seeder` PAT file + issues management/v2 calls through the `oidc.ts` `node:http` transport
   (Bearer + external-Host header). auth-app: add the PAT-file read beside the existing seed read.
3. **PAT into n8n** — mount the `zitadel-seed` volume **ro** into the `n8n` service; the workflow's
   Code node reads the PAT at runtime (file regenerates per fresh volume, so no static credential).
   Confirm whether the n8n HTTP Request node preserves a `Host` override; else fall back to a
   `node:http` Code node (same reason as `oidc.ts`).
4. Confirm `APP_ORIGIN` + `NUXT_ZITADEL_INTERNAL_URL`/`NUXT_ZITADEL_ISSUER` reach **both** n8n and
   auth-app (`_shared.data.md` env block).

### Phase 1 — Invite trigger + workflow  (spec: `admin-invite.*`, `invite-user.workflow.md`)  → skills: `sqitch-expert`, `n8n-cli`
5. **DB grant** — new **`fnb-n8n`** sqitch change (`00000000011240_n8n_worker_app_invite`, deps
   `[00000000011230_n8n_policies fnb-app:00000000010242_app_fn_definers]`): `grant usage on schema
   app_fn` + `grant execute on app_fn.invite_user(...) to n8n_worker` (narrow). It goes in `fnb-n8n`
   (not `fnb-app`) because `fnb-app` deploys before the `n8n_worker` role exists. deploy/revert/
   verify. (No `git` during the sqitch session.)
6. **Registry** — add `'invite-user': { permission: 'p:app-admin' }` to `WORKFLOW_REGISTRY`.
7. **`n8n/workflows/invite-user.json`** — Webhook (header-auth) → Read-PAT Code node → Postgres
   `select * from app_fn.invite_user(:tenantId::uuid, :email::citext)` (`n8n_worker` cred) → ZITADEL
   `POST /v2/users/human` (returnCode, **no password**; **409 → search userId + re-request email
   code**, call 1b/2) → Build `verifyUrl` → **Execute Workflow → `send-notification`**
   (`user-invitation`, email #1). Shared `error-handler` as Error Workflow. Register in `n8n-import`.
8. **Templates** — extend `send-notification`'s Render node with `user-invitation` (greeting +
   **Verify your email** CTA → `verifyUrl`) and `set-password` (greeting + **Set your password** CTA
   → `setPasswordUrl`).
9. **tenant-app UI** — `InviteUserModal.vue` (UModal + UForm: display name + email, UC3/UC4/UC13)
   on `admin/user/index.vue`; **Invite User** button in the header, gated `p:app-admin` (hide, not
   disable). `useInviteUser()` in graphql-client-api (mirror `useSendTest` → `useTriggerWorkflow`) +
   thin re-export + **barrel export** (the #1 miss). Toast on success (UC7); keep modal open on error.
10. **Verify** — invite from the admin UI → `resident` `invited` row + ZITADEL user (unverified, no
    password) + a `user-invitation` mail in Mailpit with a working `verifyUrl`; re-invite (409) resends.

### Phase 2 — Verify-email ceremony  (spec: `verify-email.*`)
11. **`apps/auth-app/app/pages/verify-email.vue`** — public page; `?userId&code`; state machine
    `verifying → verified → sendingLink → linkSent` (+ `expired`/`invalid`); auto-`POST` on load;
    "Send me a link to set my password" button (UC4/UC7, icons `i-lucide-badge-check`/`-mail-check`).
12. **Routes** — `server/api/onboard/verify-email.post.ts` (ZITADEL `email/_verify`; on 2xx set the
    short-lived signed httpOnly `onboard_verified` cookie via `session.ts` util, ~15 min) +
    `request-password.post.ts` (**require** `onboard_verified` matching `userId` → ZITADEL
    `password_reset` returnCode → build `setPasswordUrl` → internal `send-notification` webhook POST,
    email #2). Errors → page states per `verify-email.data.md` (410 expired / 401 cookie / 502).
13. **Verify** — email #1's link flips ZITADEL to email-verified; the button lands a `set-password`
    mail with a working `setPasswordUrl`.

### Phase 3 — Set-password ceremony  (spec: `set-password.*`)
14. **`apps/auth-app/app/pages/set-password.vue`** — public page; `?userId&code`; UForm double-entry
    (match + complexity hint), submit → route → redirect `/auth/login?welcome=1`; `expired`/policy
    error states (icons `i-lucide-lock`/`-lock-keyhole`).
15. **Route** — `server/api/onboard/set-password.post.ts` → ZITADEL `POST /v2/users/{id}/password`
    (`newPassword.changeRequired:false`, `verificationCode`); server-side length re-check; 410 expired
    / 422 policy / 502 mapping. **No session created here** (invitee logs in normally afterward).
16. **`login.vue`** — one-time "Password set — sign in to continue" notice keyed on `?welcome=1`.
17. **Verify (end-to-end)** — a fresh invitee completes both emails, sets a password, and signs in via
    the ZITADEL hosted login; `provision_idp_user` email-matches and activates the resident.

### Phase 4 — Hardening (deferred — note, don't build in this pass unless asked)
- Rate-limit / abuse-guard the unauthenticated `request-password` + `set-password` routes.
- Re-invite / resend throttle semantics (reuse vs rotate the ZITADEL user).
- Expired/consumed-code "request a new link" UX on both ceremony pages.
- Optimistic add / poll so the new `invited` resident appears without a manual refresh.

## Out of Scope (do NOT build here)
- The lazy email-match linker (`provision_idp_user`) — unchanged; this only adds the eager path.
- ZITADEL configuring its own SMTP / built-in invite templates (rejected — D5 return-code).
- Any fnb-minted magic-link token / `invitation` table (rejected U4).
- Exposing `app_api.invite_user` as a GraphQL mutation (rejected U6 — the held-out stub stays retired).

## Open items to confirm during execution (defaults set)
- **v2 endpoint/field confirmation** (Phase 0 checklist) — the one genuine runtime unknown; confirm
  against the running ZITADEL before wiring the calls.
- **Assignment scope for invited users** → default `'user'` (v1; admin/superadmin invites are a later
  role-management action).
- **`onboard_verified` cookie payload** → carry `email`/`displayName` to skip the extra ZITADEL GET,
  vs always GET fresh. Default: GET fresh (freshness over one round-trip) unless it proves costly.
- **Prod password-policy source** for the set-password hint + server re-check → read from ZITADEL vs
  mirror known values in config. Dev is relaxed; default: mirror a minimal length in the UI hint,
  let ZITADEL be the server authority (422 on violation).
