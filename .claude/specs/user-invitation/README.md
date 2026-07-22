# User Invitation Flow (`user-invitation`) — Spec Index

> **Execution Directive:** plan + build this spec via `/fnb-stack-implementor <this README>` —
> the implementor derives the `.claude/issues/` plan file (R23) from the task list below, then
> executes it.

## Status

**Draft** — locked decisions captured 2026-07-22 (three design forks resolved with the user).
No `[FILL IN]` blockers remain except the two confirm-against-running-ZITADEL items (endpoint
field names, PAT delivery to n8n) called out in Open Questions.

**Supersedes** the notifications spec's deferred **Phase 3 (invitation email)**
(`.claude/specs/notifications/invitation-email.data.md`). That draft deliberately carried **no**
magic link ("just come log in", email-match on first OIDC login). The user has since asked for a
full **ZITADEL-driven onboarding ceremony** (eager user creation → verify-email → set-password →
login). This spec is that richer design; it **reuses** the notifications `send-notification`
pipeline (Phases 1/2, already live) as its delivery mechanism.

## Purpose

Give tenant admins a real **"Invite User"** action. Instead of the current *lazy* invite (a
`resident` row is created `invited`, no email, the person is linked by email-match only if they
happen to log in — `zitadel-login-pattern.md:46,191`), an invite now:

1. Creates the `resident` **and** eagerly creates the human user in **ZITADEL** (no password,
   email unverified).
2. Emails the person an **invitation link** (email #1) through the `send-notification` workflow.
3. Walks them through a two-page **onboarding ceremony** hosted in `auth-app`: verify their email,
   then set their password directly in ZITADEL.
4. Drops them at the login page to sign in with the credentials they just set.

ZITADEL stays the sole credential store (the password is set **in ZITADEL**, never in fnb); n8n
stays the sole email sender (D5 return-code mode — ZITADEL gets no SMTP); the DB keeps its
existing resident/email-match model unchanged. This spec only **adds** an eager path in front of
the lazy one.

## The ceremony (end to end)

```
Admin  (tenant-app /tenant/admin/user)
  └─ "Invite User" → modal (display name + email) → triggerWorkflow('invite-user', {...})
                                                        │  (p:app-admin gate, claims injected)
n8n  invite-user workflow
  ├─ app_fn.invite_user(tenantId, email)               → resident row 'invited' (idempotent)
  ├─ ZITADEL POST /v2/users/human (returnCode, no pw)  → { userId, emailCode }
  └─ send-notification  templateKey=user-invitation    → EMAIL #1
        link: /auth/verify-email?userId=..&code=<emailCode>

Invitee clicks EMAIL #1
  auth-app /auth/verify-email  (unauthenticated)
    ├─ onMounted → POST /auth/api/onboard/verify-email  → ZITADEL email/_verify  ✓ email verified
    └─ button "Send me a link to set my password"
          POST /auth/api/onboard/request-password       → ZITADEL password_reset (returnCode)
                                                        → send-notification templateKey=set-password
        link: /auth/set-password?userId=..&code=<resetCode>  → EMAIL #2

Invitee clicks EMAIL #2
  auth-app /auth/set-password  (unauthenticated)
    └─ double-enter password → POST /auth/api/onboard/set-password
                                                        → ZITADEL POST /v2/users/{id}/password  ✓ pw set
    → redirect /auth/login

Invitee signs in (ZITADEL hosted login) → provision_idp_user email-matches the 'invited' resident.
```

## Locked decisions

| # | Area | Choice | Why |
|---|------|--------|-----|
| U1 | Ceremony pages home | **auth-app** — `/auth/verify-email`, `/auth/set-password` | Pre-login, unauthenticated; auth-app already owns the OIDC ceremony, the ZITADEL split-horizon transport, and the seed-file handoff. (User pick 2026-07-22) |
| U2 | Invite orchestration | **n8n `invite-user` workflow** — create resident + ZITADEL user + email #1, fired via the `triggerWorkflow` registry | R22 (n8n is the sole engine); the ZITADEL PAT lives as one workflow concern; free run log. (User pick 2026-07-22) |
| U3 | Email verification | **Auto-verify on `verify-email` page load** (email #1's link carries the code); a second button then requests the password-reset link (email #2) | Fewest clicks; matches the "verify page → button sends 2nd link" request. (User pick 2026-07-22) |
| U4 | Codes / links | **ZITADEL return-code mode** (D5) — the emailed links carry ZITADEL's own single-use `emailCode` / `verificationCode`; no fnb-minted credential | Password is set **in ZITADEL**, so the set-password step needs ZITADEL's reset code anyway; avoids inventing a second credential path. |
| U5 | Sync vs async | Invite = **async** (fire-and-forget workflow; toast + email are the evidence). Verify / request-pw / set-password = **synchronous auth-app server routes** | The ceremony pages need code-call results in-band; the invite does not. |
| U6 | Resident creation | **Reuse `app_fn.invite_user`** (already exists, SECURITY DEFINER, takes `_tenant_id, _email`) called by `n8n_worker` inside the workflow | No new DB surface; keeps licensing/resident logic in one place. The held-out `app_api.invite_user` stub stays retired (its Supabase comment is obsolete). |
| U7 | Invite gate | **`p:app-admin`** on the `invite-user` registry entry | Mirrors the held-out `app_api.invite_user`'s `jwt.has_permission('p:app-admin')`; tenant admins invite into their own tenant. |
| U8 | ZITADEL admin auth | Both n8n and auth-app authenticate to the ZITADEL **management/v2 API** with the **`fnb-seeder` PAT** from the shared `zitadel-seed` volume, over the internal URL + external-Host split-horizon | Reuses the existing service account + transport; no new machine user. Delivery of the PAT into n8n is the one infra Open Question. |

## Files in this spec

| File | Covers |
|------|--------|
| `_shared.data.md` | Data model + contracts: resident invite surface (`app_fn.invite_user`), the `invite-user` `triggerWorkflow` registry entry, the two email templates, env additions, permission model, the ZITADEL user-lifecycle state machine |
| `zitadel-admin-client.md` | The ZITADEL **management/v2** API contract used by U2/U5 — create-human-user (return-code, no password), email `_verify`, `password_reset` (return-code), set-password; PAT auth + split-horizon transport; endpoint/field confirmation checklist |
| `invite-user.workflow.md` | The n8n `invite-user` workflow — webhook → `app_fn.invite_user` → ZITADEL create-user → `send-notification` (email #1); 409-already-exists handling |
| `admin-invite.ui.md` | tenant-app `admin/user/index.vue` — "Invite User" button + `InviteUserModal` (display name + email), toast, `p:app-admin` gate |
| `admin-invite.data.md` | `useInviteUser()` → `triggerWorkflow('invite-user', …)` carve-out (mirrors `useSendTest`); no new GraphQL read |
| `verify-email.ui.md` | auth-app `/auth/verify-email` — auto-verify state machine, "send password link" button, error/expired states |
| `verify-email.data.md` | auth-app server routes `verify-email` + `request-password`; the short-lived verified-cookie handshake (U5 security note) |
| `set-password.ui.md` | auth-app `/auth/set-password` — double-entry password form, complexity hint, redirect-to-login on success |
| `set-password.data.md` | auth-app server route `set-password` → ZITADEL set-password; validation + error mapping |

## Implementation Task List

Phased build order; each phase is independently verifiable. **Depends on notifications Phases 1/2
(live): `notify.notification`, the `send-notification` + `notification-webhook` workflows, Mailpit.**

### Phase 0 — ZITADEL admin client + PAT delivery (`zitadel-admin-client.md`)
- [ ] Confirm the v4.15.3 v2 endpoint paths + field names (`returnCode`/`sendCode`,
      `verificationCode`, `password_reset`) against the running instance — see the checklist.
- [ ] Make the `fnb-seeder` PAT reachable from n8n (mount the `zitadel-seed` volume ro; a Code
      node reads the PAT file at runtime) **and** from auth-app (it already reads the seed dir for
      `clientId`; add PAT-file read). Split-horizon: reach ZITADEL at `NUXT_ZITADEL_INTERNAL_URL`
      with the external host in the `Host` header.
- [ ] `APP_ORIGIN` available to n8n + auth-app for building ceremony links (already in env).

### Phase 1 — Invite trigger + workflow (`admin-invite.*`, `invite-user.workflow.md`)
- [ ] Register `invite-user` in `WORKFLOW_REGISTRY` (`trigger-workflow.plugin.ts`) with
      `permission: 'p:app-admin'`.
- [ ] `n8n/workflows/invite-user.json` — Webhook (header-auth) → Postgres `app_fn.invite_user`
      → ZITADEL create-human-user (return-code, no password; 409 → look up userId + re-request
      email code) → **Execute Workflow** `send-notification` (email #1, `user-invitation`).
- [ ] `user-invitation` template added to `send-notification`'s inline template store
      (greeting + **Verify your email** CTA → `verifyUrl`).
- [ ] tenant-app: "Invite User" button + `InviteUserModal` on `admin/user/index.vue`;
      `useInviteUser()` → `triggerWorkflow('invite-user', { displayName, email })`.
- [ ] Verify: invite from the admin UI → resident row `invited` + ZITADEL user exists (unverified,
      no password) + a `user-invitation` mail in Mailpit with a working `verifyUrl`.

### Phase 2 — Verify-email ceremony (`verify-email.*`)
- [ ] auth-app `/auth/verify-email` page — auto-`POST` `verify-email` on load; on success set the
      short-lived verified cookie + reveal "Send me a link to set my password".
- [ ] Server routes: `verify-email` (ZITADEL email `_verify`) and `request-password` (ZITADEL
      `password_reset` return-code → `send-notification` email #2, `set-password` template).
- [ ] `set-password` template added to `send-notification` (greeting + **Set your password** CTA →
      `setPasswordUrl`).
- [ ] Verify: opening email #1's link flips the ZITADEL user to email-verified; the button lands a
      `set-password` mail with a working `setPasswordUrl`.

### Phase 3 — Set-password ceremony (`set-password.*`)
- [ ] auth-app `/auth/set-password` page — double-entry form (match + complexity hint), submit →
      `set-password` route → ZITADEL set-password (`changeRequired:false`) → redirect `/auth/login`.
- [ ] Verify (end to end): a fresh invitee completes both emails, sets a password, and signs in via
      the ZITADEL hosted login; `provision_idp_user` email-matches and activates the resident.

### Phase 4 — Hardening (open items)
- [ ] Rate-limit / abuse-guard `request-password` + `set-password` (unauthenticated routes).
- [ ] Re-invite / resend semantics (throttle; reuse vs. rotate the ZITADEL user).
- [ ] Expired/consumed-code UX on both ceremony pages ("request a new link" path).

## Remaining Open Questions

- **PAT into n8n** — mount the `zitadel-seed` volume ro and read the PAT file in a Code node, vs.
  provision a dedicated n8n machine user/key. Recommendation: reuse the `fnb-seeder` PAT file
  (least new surface); confirm n8n can read it post-rebuild (the file is regenerated each fresh
  volume). *(Phase 0)*
- **v2 endpoint/field confirmation** — exact paths + the return-code selector name on ZITADEL
  v4.15.3 (`zitadel-admin-client.md` checklist).
- **`request-password` anti-abuse** — the route is unauthenticated and emails a reset code by
  `userId`. U5 mitigation: the `verify-email` success sets a short-lived signed httpOnly cookie
  that `request-password` requires. Confirm that is sufficient vs. also rate-limiting by IP/userId.
- **ZITADEL user pre-existing** (409) — invitee already in ZITADEL (seeded, or re-invited): the
  workflow looks up the `userId` and re-requests a fresh email code rather than failing. Confirm
  that is the desired resend behavior.
- **Link/code lifetime** — ZITADEL code TTLs (default vs. configured); surface an "expired — request
  a new link" affordance. *(Phase 4)*
- **Prod password complexity** — dev relaxes it (`zitadel-login-pattern.md:119`); the set-password
  page must reflect the **prod** policy (Open Question: read it from ZITADEL vs. mirror in the UI).

## Considered & rejected

- **fnb-minted magic-link token** (own signed token, own `invitation` table) — rejected (U4): the
  password lands in ZITADEL, so ZITADEL's reset code is already the credential-bearing secret;
  minting a parallel one is a second credential path with no benefit.
- **Expose `app_api.invite_user` as a GraphQL mutation** + separate email trigger — rejected (U6):
  two round-trips with a partial-failure window; the workflow does resident + ZITADEL + email as
  one unit. The held-out stub (`00000000010242_app_fn_definers.sql:231`) stays retired.
- **auth-app server route for the whole invite** (instead of n8n) — viable, but the user chose n8n
  (U2) for R22 consistency + the free run log. Kept here as the fallback if PAT-into-n8n proves
  awkward.
- **ZITADEL configures its own SMTP + built-in invite templates** — a second sender + split
  template store; rejected in favor of return-code → `send-notification` (D5). Fallback of last
  resort only (notifications README, Considered & rejected).
- **Keep the lazy email-match invite as the only path** — the current behavior; superseded because
  the user wants an actual email + guided onboarding. Lazy match stays as the login-time linker.
