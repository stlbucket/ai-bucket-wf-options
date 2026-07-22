# Password Self-Service (`password-self-service`) — Spec Index

> **Execution Directive:** plan + build this spec via `/fnb-stack-implementor <this README>` —
> the implementor derives the `.claude/issues/` plan file (R23) from the task list below, then
> executes it.

## Status

**Draft** — locked decisions captured 2026-07-22 (three design forks resolved with the user). No
`[FILL IN]` blockers; the only unresolved items are the two confirm-against-running-ZITADEL points
in Open Questions (the `currentPassword` verification field; reset-code TTL for copy).

**Builds on `user-invitation` (Phases 1–3, live 2026-07-22) + `notifications` (live).** It adds
**no new tables** and **no new ZITADEL transport** — it reuses `zitadel-admin.ts`, the
`send-notification` pipeline, the `set-password` email template, and the `/auth/set-password`
page/route verbatim. New code is: one home-page link, one public page, two auth-app routes, one
n8n workflow (a trimmed `invite-user`), one `zitadel-admin.ts` helper, one RLS-gated DB read
function, and one tenant-app admin button.

## Purpose

Bring the two password touchpoints ZITADEL's hosted UI would own **into fnb**, per the user:

1. **"I forgot my password"** — a *"forgot password?"* link on the **home page** next to `sign in`
   (not the ZITADEL landing) → a public `/auth/forgot-password` page → an n8n workflow that is the
   **second half of `invite-user`** (search by email → `password_reset` → `set-password` email) →
   the existing set-password tail.
2. **"Change password"** — a self-service form on **`/auth/profile`**, in a new column next to the
   profile claims. ZITADEL verifies the user's current password.
3. **Admin reset** — the "p:app-admin in their tenant" capability from the RLS ask, realized as a
   *send-reset-email* action on the tenant-app user detail page (the admin never sets the password).

## Locked decisions

| # | Area | Choice | Why |
|---|------|--------|-----|
| P1 | Forgot-pw entry | **Muted "forgot password?" text link** under `sign in` on the home hero → `/auth/forgot-password` | User pick 2026-07-22 — keep the hero's single primary CTA; not on the ZITADEL landing. |
| P2 | Forgot-pw engine | **n8n `forgot-password` workflow** = `invite-user`'s second half (search → `password_reset` → `set-password` email) | User ask ("n8n workflow similar to invite user, second half only") + R22. Reuses the proven 409-branch code + the set-password template/page. |
| P3 | Forgot-pw trigger (public) | **Unauthenticated auth-app route** POSTs the n8n webhook with the shared secret (NOT `triggerWorkflow` — no claims pre-login) | Same server-to-server pattern as the onboard `request-password` → `send-notification` call. |
| P4 | No account enumeration | Route **always 200** for a well-formed email; the workflow **`return []`** (no email) for unknown users | Standard forgot-password hygiene; the page shows one generic "if an account exists…" message. |
| C1 | Change-pw verify | **Require the current password** (3-field form) → ZITADEL `currentPassword` verification | User pick 2026-07-22 — phishing-resistant, matches account-page norms; a leaked session cannot silently rotate the password. |
| C2 | Change-pw scope | **Self only** — target derived from the **session**, never the body; RLS `view_self` gates the idp-user read | Makes "only the owning user" structural (no cross-user code path) with no new policy. |
| C3 | Change-pw engine | **Direct auth-app route → ZITADEL** (NOT n8n) | Passwords must never transit the n8n run log; auth-app already holds the PAT + transport. |
| A1 | Admin capability | **Admin "send password reset"** (email), not a direct set | User pick 2026-07-22 — the admin never learns/sets another user's password. |
| A2 | Admin gate | `triggerWorkflow('forgot-password', { email })` gated **`p:app-admin`**; tenant-scope from `app.resident` RLS on the email the admin can already see | Reuses the same workflow; enforcement composes the registry gate with existing resident RLS. Residual arbitrary-email hardening deferred (bounded harm). |
| R1 | New DB surface | **One RLS-gated read** `app_api.my_idp_user_id()` (SECURITY INVOKER, `view_self`) | The change-pw route's only DB touch; no new table, no new policy. |

## Files in this spec

| File | Covers |
|------|--------|
| `_shared.data.md` | RLS model (the user's ask), the one DB read helper, ZITADEL calls (incl. new call D), registry entry, env, permission keys |
| `forgot-password.ui.md` | home-page link + `/auth/forgot-password` page (no-enumeration UI) |
| `forgot-password.data.md` | `POST /auth/api/forgot-password` (unauth) → n8n webhook |
| `forgot-password.workflow.md` | the n8n `forgot-password` workflow — the trimmed second half of `invite-user` |
| `change-password.ui.md` | `/auth/profile` two-column layout + `ChangePasswordForm` (3-field) |
| `change-password.data.md` | `POST /auth/api/profile/change-password` (auth) → `my_idp_user_id` + ZITADEL call D |
| `admin-reset.data.md` | tenant-app "send password reset" button → `triggerWorkflow('forgot-password', …)` |

## Implementation Task List

Phased; each phase independently verifiable. **Depends on `user-invitation` Phases 1–3 (live):
`zitadel-admin.ts`, the `set-password` template/page/route, `send-notification`, the
`fnb-webhook-secret` credential + `zitadel-seed` volume on n8n.**

### Phase 0 — ZITADEL confirmation (no code)
- [ ] Confirm the `SetPassword` **`currentPassword`** verification arm on v4.15.3 (call D) and that
      a wrong current password returns a **distinguishable 4xx** → mapped to `401 wrong-current`
      (vs. a `422` policy fail). Note the reset-code TTL for the expired-link copy.

### Phase 1 — Forgot password (the core "second half" ask)
- [ ] `n8n/workflows/forgot-password.json` — 3-node trim of `invite-user.json`: Webhook
      (`forgot-password`, headerAuth) → Code node (PAT read → search by email → **no user ⇒
      `return []`** → `password_reset` returnCode → `setPasswordUrl`) → HTTP Request →
      `send-notification` (`set-password` template, subject "Reset your fnb password").
- [ ] `apps/auth-app/server/api/forgot-password.post.ts` — validate email, POST the n8n webhook with
      `x-fnb-webhook-secret`, **always 200**; `502` only on webhook-transport failure.
- [ ] `apps/auth-app/app/pages/forgot-password.vue` — public page, email form → generic `sent`
      state (no enumeration).
- [ ] `apps/home-app/app/pages/index.vue` — "forgot password?" `ULink` under `sign in`
      (logged-out hero only).
- [ ] Verify live: home link → page → email in Mailpit with a working `setPasswordUrl` → existing
      set-password page sets the password → login. Unknown email → 200 + **no** email sent.

### Phase 2 — Change password (self, on the profile page)
- [ ] fnb-app migration: `app_api.my_idp_user_id()` (SECURITY INVOKER, RLS `view_self`) +
      `grant execute … to authenticated`.
- [ ] `zitadel-admin.ts`: `changeOwnPassword(userId, current, next)` helper (call D; wrong-current
      vs. policy discrimination).
- [ ] `apps/auth-app/server/api/profile/change-password.post.ts` — `getEventClaims` (401) →
      `withClaims(claims, my_idp_user_id)` (409 if null) → `changeOwnPassword` → error map.
- [ ] `packages/auth-layer` `ChangePasswordForm.vue` (3-field, mirror set-password validation) +
      two-column `profile.vue` layout; remove the "ZITADEL self-service" note.
- [ ] Verify live: correct current → password updates + can re-login with the new one; wrong current
      → inline "incorrect"; weak new → policy toast.

### Phase 3 — Admin reset (the "p:app-admin in their tenant" half)
- [ ] Register `'forgot-password': { permission: 'p:app-admin' }` in `trigger-workflow.plugin.ts`.
- [ ] `useAdminResetPassword()` (graphql-client-api) + tenant-app re-export.
- [ ] "Send password reset" button + confirm modal on `tenant/admin/user/[id].vue` (p:app-admin
      only), firing `triggerWorkflow('forgot-password', { email })`.
- [ ] Verify live: admin resets a tenant user → that user gets a set-password email; button hidden
      for non-admins.

### Phase 4 — Hardening (open items)
- [ ] Rate-limit / abuse-guard `forgot-password` (unauthenticated; IP + email).
- [ ] Expired/consumed-code UX already exists on the set-password page — confirm copy for the
      forgot-password entry point.
- [ ] Admin-reset strict tenant enforcement (`residentId` + `SECURITY DEFINER` tenant check) if the
      bounded-harm residual is deemed insufficient.

## Remaining Open Questions

- **ZITADEL `currentPassword` field + wrong-password 4xx** (Phase 0) — the one unconfirmed contract.
- **Forgot-password rate-limit** — pair with the always-200 no-enumeration response (Phase 4).
- **Self change-password + fnb session** — confirm the sealed session survives a ZITADEL self
  password change (expected: yes, independent credential).
- **Admin-reset arbitrary-email residual** — accept bounded harm for v1 vs. build the `residentId`
  DB-gated variant (Phase 4).
- **Reset-email template** — reuse `set-password` (default) vs. a distinct `password-reset` subject.

## Considered & rejected

- **Change password via an n8n workflow** — rejected (C3): a chosen password would land in the n8n
  run log. Change-password is a direct auth-app route; only the *reset* (which carries no chosen
  password, just a code request) uses n8n.
- **Admin directly sets another user's password** (force-set, `changeRequired:true`) — rejected
  (A1): the admin would transiently know the credential. A reset email keeps the password known
  only to its owner.
- **Public forgot-password via `triggerWorkflow`** — impossible (C/P3): `triggerWorkflow` is
  claims-gated and forgot-password is pre-login. The unauthenticated route + shared-secret webhook
  is the only workable path (and matches the onboard routes).
- **A new `app.profile` policy letting `p:app-admin` read/change tenant members' credentials** —
  unnecessary: the direct change is self-only (identity gate) and the admin path is a reset email
  scoped by the *existing* `app.resident` RLS. No new policy is added.
- **A brand-new `password-reset` email template** — deferred: the `set-password` template already
  carries the CTA → `setPasswordUrl`; only the subject differs. Optional polish.
- **ZITADEL's own hosted forgot-password / account pages** — rejected by the user ("not zitadel
  landing"): the entry points must live in fnb (home page + `/auth/profile`).
