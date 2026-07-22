# Password Self-Service — Shared Data & Contracts

## Status
Draft — no `[FILL IN]` blockers. Two confirm-against-running-ZITADEL items in Open Questions
(the `currentPassword` verification field on set-password; forgot-password code TTL for the
expired-link UX). Everything else reuses primitives already confirmed live by the
`user-invitation` spec (2026-07-22).

## Purpose (both features, one shared surface)

This spec adds the two password touchpoints ZITADEL's hosted UI would otherwise own, but which
the user wants **inside fnb** (not on the ZITADEL landing):

1. **Forgot password** — an unauthenticated "forgot password?" entry on the **home page**, backed
   by an n8n workflow that is the **second half of `invite-user`** (search ZITADEL by email →
   `password_reset` return-code → `set-password` email). It reuses the *entire* existing
   set-password tail (`/auth/set-password` page + `/auth/api/onboard/set-password` route + the
   `set-password` email template) built by `user-invitation` Phase 3 — nothing new past the email.
2. **Change password** — an authenticated, **self-only** form on `/auth/profile` (new column next
   to the profile claims). ZITADEL verifies the caller's *current* password.
3. **Admin reset** (the "p:app-admin in their tenant" half of the RLS ask) — a tenant-app action
   that fires the same forgot-password workflow for a target user's email, tenant-scoped by the
   existing `app.resident` RLS. The admin never learns/sets the password.

ZITADEL stays the sole credential store; n8n stays the sole email sender; the DB adds **no new
tables** — only a small RLS-gated read helper for the self change-password path.

## The RLS model (the user's explicit ask)

> "only the owning user or a p:app-admin in their tenant can do this"

With the resolved design the two capabilities split cleanly, and each is enforced by an
**existing** RLS surface — no new policy is required:

| Capability | Who | Enforcement |
|---|---|---|
| **Direct change password** (set a new password now) | **Owner only** | The route derives the target ZITADEL user id from the **session identity** — it can only ever be the caller's own. Reading that id is an RLS-gated self read of `app.profile.idp_user_id` (policy **`view_self`**, `jwt.uid() = id`, `00000000010250_app_policies.sql:30`). ZITADEL additionally requires the caller's **current password**. There is no code path that targets another profile. |
| **Reset password** (send the target a set-password email) | **p:app-admin in the target's tenant** (or super) | The admin action operates on a **resident** the admin can already see. `app.resident` RLS (`manage_own_tenant_residencies` = `jwt.has_permission('p:app-admin', tenant_id)`, plus `view_all_for_tenant`, `00000000010250_app_policies.sql:42-67`) already scopes visible residents to the admin's tenant. The reset only ever emails an address the admin is RLS-authorized to read. |

**Why no direct admin "change" path:** an admin setting a password they'd then know is poor
practice; the user chose "admin reset = send reset email" (2026-07-22). So the *direct* set is
owner-only (with current-password proof); the admin path is a reset email. The gate is therefore
expressed entirely through identity + existing resident RLS — no `p:app-admin`-can-change-profile
policy is added to `app.profile`.

### New DB surface — one RLS-gated read helper

```sql
-- fnb-app (new migration, after 00000000010270_profile_idp_user.sql)
-- SECURITY INVOKER: relies on app.profile RLS `view_self` — returns the CALLER'S OWN
-- idp_user_id and nothing else. Used by the change-password route to find the ZITADEL user
-- to re-key. No _fn/_api two-layer (R8) — this is a read, not a mutation.
create or replace function app_api.my_idp_user_id()
  returns text
  language sql
  stable
  security invoker            -- RLS decides: view_self → own row only
  set search_path = pg_catalog, public
  as $$
    select idp_user_id from app.profile where id = jwt.uid();
  $$;
grant execute on function app_api.my_idp_user_id() to authenticated;
```

Called from the auth-app change-password route via the **`withClaims(claims, fn)`** db-access
carve-out (R5) — the same pattern the onboard routes would use for any claims-gated DB touch.
Returns `null` when the caller has no linked ZITADEL user (never OIDC-logged-in) → route 409.

## ZITADEL calls (all confirmed v4.15.3 unless noted)

Reuse `apps/auth-app/server/utils/zitadel-admin.ts` (PAT + split-horizon transport). Existing
helpers cover the whole forgot-password tail. **Two additions:**

| # | Call | Path | Body | For |
|---|------|------|------|-----|
| A | Search by email | `POST /v2/users` | `{ queries: [{ emailQuery: { emailAddress } }] }` → `{ result: [{ userId }] }` | forgot-password workflow (already inline in `invite-user.json`) |
| B | Request pw reset | `POST /v2/users/{id}/password_reset` | `{ returnCode: {} }` → `{ verificationCode }` | forgot-password workflow (existing `requestPasswordReset` helper) |
| C | Set w/ reset code | `POST /v2/users/{id}/password` | `{ newPassword: { password, changeRequired:false }, verificationCode }` | existing set-password route (unchanged) |
| **D** | **Change (verify current)** | `POST /v2/users/{id}/password` | `{ newPassword: { password, changeRequired:false }, currentPassword }` | **new** `changeOwnPassword` helper (self change) |

**D — CONFIRMED live v4.15.3 (2026-07-22 probe, throwaway user).** The `currentPassword`
verification arm works as designed:
- correct current password → **`200`**.
- wrong current password → **`400`** with a **typed** detail
  `@type: type.googleapis.com/zitadel.v1.CredentialsCheckError` (`id: COMMAND-3M0fs`,
  `message: "Password is invalid"`). → map to `401 wrong-current`.
- weak/policy-violating new password → **`400`** with a *different* detail
  `@type: …zitadel.v1.ErrorDetail` (`id: DOMAIN-HuJf6`, `message: "Password is too short"`). → `422 policy`.

**Discriminator (robust, typed — not string-matching):** on a 4xx, if any
`details[].@type` contains `CredentialsCheckError` → `wrong-current`; otherwise → `policy`
(fall back to the message regex only if the details array is absent).

### New `zitadel-admin.ts` helper (D)

```ts
export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; kind: 'wrong-current'; message: string }   // → 401
  | { ok: false; kind: 'policy'; message: string }           // → 422
// POST /v2/users/{id}/password { newPassword:{ password, changeRequired:false }, currentPassword }
// 2xx → ok. 4xx: details[].@type contains 'CredentialsCheckError' → wrong-current; else policy.
export async function changeOwnPassword(
  userId: string, currentPassword: string, newPassword: string,
): Promise<ChangePasswordResult>
```

The forgot-password workflow needs a `searchUserByEmail` primitive; it already exists **inline in
the `invite-user` Code node**. The workflow Code node reuses that same block (no auth-app util —
the search runs in n8n).

## Workflow registry (`trigger-workflow.plugin.ts`)

One new entry — for the **authenticated admin-reset** path only. The **public** forgot-password
entry does NOT use `triggerWorkflow` (it is unauthenticated; it POSTs the webhook server-to-server
with the shared secret, exactly like the onboard `request-password` route calls `send-notification`).

```ts
// Fires the forgot-password workflow for a target user's email. Gated p:app-admin — tenant admins
// reset within their own tenant; the email is one the admin is already RLS-authorized to read
// (app.resident). Bounded harm: sends a set-password email only (no account access).
'forgot-password': { permission: 'p:app-admin' }
```

Registry input `{ email }` (+ the plugin-injected `tenantId`/`profileId`, which the workflow
ignores). See `admin-reset.data.md` for the residual "arbitrary-email" note and Phase 2 hardening.

## ZITADEL config — hide the built-in reset link (gap-fill 2026-07-22)

The forgot-password entry must be the fnb home-page flow, **not** ZITADEL's hosted-login built-in
"Forgot password?" link (user directive "not zitadel landing"). ZITADEL runs in return-code mode
with **no SMTP** (n8n is the sole email sender), so its built-in reset is also a dead end. So the
instance login policy sets **`hidePasswordReset: true`** — applied live via
`PUT /admin/v1/policies/login` and persisted in `docker/zitadel/seed.mjs` (`ensureLoginPolicy`,
mirrors `ensureBranding`'s GET-merge-PUT; runs dev + prod) so it survives rebuilds. The anchor org
inherits the instance default (isDefault). This removes ZITADEL's competing link; the home-page
"forgot password?" → `/auth/forgot-password` is the single path.

## Environment

**No new env.** Everything is already wired for `user-invitation` / `notifications`:
- auth-app: `ZITADEL_PAT_FILE`, `runtimeConfig.zitadelInternalUrl` / `.zitadelIssuer` (transport),
  `N8N_INTERNAL_URL` + `N8N_WEBHOOK_SECRET` (the onboard routes already POST send-notification).
- n8n: the `zitadel-seed` volume (ro) + `fnb-webhook-secret` credential + `NUXT_PUBLIC_AUTH_APP_URL`
  (built into the set-password link by `invite-user.json` already).

## Permission keys

| Key | Used by |
|---|---|
| — (authenticated) | change-password route (self; identity is the gate) |
| `p:app-admin` | admin-reset action + the `forgot-password` registry entry |
| `p:app-admin-super` | inherits admin-reset (super sees all tenants) |

## Files in this spec

| File | Covers |
|------|--------|
| `_shared.data.md` | this file — RLS model, the one DB helper, ZITADEL calls, registry, env |
| `forgot-password.ui.md` | home-page "forgot password?" link + `/auth/forgot-password` page |
| `forgot-password.data.md` | `POST /auth/api/forgot-password` (unauth) → n8n webhook; no-enumeration contract |
| `forgot-password.workflow.md` | the n8n `forgot-password` workflow (second half of `invite-user`) |
| `change-password.ui.md` | `/auth/profile` new column + 3-field change-password form |
| `change-password.data.md` | `POST /auth/api/profile/change-password` (auth) → `my_idp_user_id` + ZITADEL call D |
| `admin-reset.data.md` | tenant-app "send password reset" action → `triggerWorkflow('forgot-password', { email })` |

## Open Questions

- [x] **ZITADEL `currentPassword` field (call D)** — CONFIRMED live v4.15.3 (2026-07-22): the
      `currentPassword` arm works; wrong current → 400 `CredentialsCheckError`, weak new → 400
      `ErrorDetail`. Discriminate on the detail `@type`. *(Phase 0 done)*
- [ ] **Forgot-password rate-limit** — the unauthenticated route emails a reset code by email. Bound
      by IP + email (Phase 2); pair with the "no enumeration" always-200 response.
- [ ] **Code/link TTL** — reuse the set-password page's expired-link UX (already built); confirm the
      ZITADEL reset-code TTL for copy. *(shared with `user-invitation` Phase 4)*
- [ ] **Admin-reset arbitrary email** — the `p:app-admin` registry gate does not itself check the
      email belongs to the caller's tenant (UI + resident RLS do). Bounded harm (reset email only).
      Hardened variant (pass `residentId`, DB tenant re-check) noted in `admin-reset.data.md`. *(Phase 2)*
- [ ] **Reuse `set-password` email template vs. a distinct `password-reset` subject** — reuse is the
      default; a "Reset your password" subject variant is optional polish.
