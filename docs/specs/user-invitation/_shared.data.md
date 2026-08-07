# User Invitation — Shared Data

## Status
Draft — see README for locked decisions. No `[FILL IN]` blockers except the ZITADEL
endpoint/field confirmation (moved to `zitadel-admin-client.md`).

This module adds **no new DB table**. It composes four existing surfaces:
`app_fn.invite_user` (resident), the `triggerWorkflow` registry (dispatch), the
`send-notification` workflow (email), and the ZITADEL management/v2 API (identity). Types below
are the payload/contract shapes that cross those boundaries.

## Resident creation — `app_fn.invite_user` (reused, U6; **profile-fields extension U10 2026-08-07**)

Defined at `db/fnb-app/deploy/00000000010242_app_fn_definers.sql:269`. **Extended (U10)** with four
optional profile-detail params so the Invite-User popup can seed the invitee's profile up front
(the modal collects first name, last name, display name, email, phone — email required, the rest
optional):

```sql
app_fn.invite_user(
    _tenant_id uuid
   ,_email citext
   ,_assignment_scope app.license_type_assignment_scope default 'user'
   ,_first_name   citext default null   -- NEW (U10)
   ,_last_name    citext default null   -- NEW (U10)
   ,_display_name citext default null   -- NEW (U10) — UNIQUE column; explicit collision → raise
   ,_phone        citext default null   -- NEW (U10)
  ) returns app.resident   -- SECURITY DEFINER
```

**Why the new params are appended, with defaults, in place (in-place sqitch edit, rebuild-only env):**
every existing caller passes the first three args positionally
(`create_app_tenant`/`create_workspace`/`initialize_anchor` → `'admin'`/`'superadmin'`,
`set_workspace_membership` → `'user'`, the block cascade path). Appending defaulted params leaves
those calls valid and unchanged. On the rebuild-only env only the new 7-arg signature is ever
created, so there is no 3-arg/7-arg overload ambiguity. **Update the change's revert + verify files**
for the new signature (verify asserts the 7-arg form exists).

Behavior (idempotent per `(email, tenant_id)`, unchanged except for the profile fields):

- **New profile (email not seen before):**
  - `_display_name` **supplied** → check `app.profile.display_name` uniqueness; on collision
    `raise exception '31020: DISPLAY NAME ALREADY TAKEN'` (new errcode, U10 decision 3 — an
    explicitly-typed name earns an explicit error). Otherwise use it.
  - `_display_name` **blank/omitted** → keep today's collision-safe derivation (email local part,
    else null).
  - Insert `app.profile (email, display_name, first_name, last_name, phone)` with the supplied
    values (each `nullif(trim(·),'')` normalized so blank form fields land as `null`).
    `full_name` is `GENERATED` from `first_name||' '||last_name` — nothing to set.
- **Existing profile (re-invite):** **fill only blanks** (U10 decision 2) — set
  `first_name`/`last_name`/`phone` via `coalesce(existing, supplied)`; never overwrite a value the
  person already has. `display_name`: only when the existing value **is null** and one is supplied,
  run the same uniqueness check (collision → `31020`) and set it; if the profile already has a
  display name, the supplied one is ignored (fill-blanks, no error).
- Unchanged: creates the `resident` row (`status='invited'`, type `home`/`guest` by prior
  existence) **already linked to that profile**, registers it in `res.resource`, grants the
  tenant's subscribed licenses at `_assignment_scope`.
- Called by the **`invite-user` workflow** as `n8n_worker` (the role already has execute on
  `app_fn.*`? — **confirm** the grant; if absent, add an `n8n_worker` execute grant in a new
  `fnb-app` change, mirroring the `fnb-notify`/`fnb-storage` worker-grant lesson).
- `_tenant_id` comes from the inviting admin's claims (`triggerWorkflow` injects `tenantId`).
- The held-out `app_api.invite_user` GraphQL stub stays commented out — the workflow is the surface.

The resident stays `invited` until the invitee's first successful OIDC login. Because the profile
is created **eagerly at invite time** (matching the `create_app_tenant` / `initialize_anchor`
precedent), the invitee is a first-class person immediately: visible in the Manage-Residents pool
(`app_fn.workspace_resident_pool` requires `profile_id is not null`) and de-dupable in the subtree
roll-up (which groups on `profile_id`). At first OIDC login `app_fn.provision_idp_user`
**email-matches and adopts** this existing profile (sets its `idp_user_id`;
`zitadel-login-pattern.md:47`) — it does not create a second one. Before this change the profile
was created lazily on first login, which left not-yet-logged-in invitees invisible to the pool and
un-groupable in the roll-up (duplicate rows across a tenant tree).

## Dispatch — `triggerWorkflow` registry entry (new)

Add to `WORKFLOW_REGISTRY` in
`apps/graphql-api-app/server/graphile/trigger-workflow.plugin.ts`:

```ts
// User invitation (user-invitation spec, R22): { displayName, email }. tenantId/profileId are
// injected from claims by the plugin. Gated p:app-admin — tenant admins invite into their tenant.
'invite-user': { permission: 'p:app-admin' },
```

The plugin already: 401s without claims, checks the permission, injects `tenantId`/`profileId`,
and POSTs `${N8N_INTERNAL_URL}/webhook/invite-user` with the `x-fnb-webhook-secret` header.
Respond-immediately webhook → `{ accepted: true, runId: null }`.

**Input contract (from the admin page) — extended U10:**

```ts
interface InviteUserInput {
  email: string          // REQUIRED — the invitee's email (also the ZITADEL username + profile key)
  firstName?: string     // NEW (U10) optional — profile.first_name + ZITADEL givenName
  lastName?: string      // NEW (U10) optional — profile.last_name + ZITADEL familyName
  displayName?: string   // now OPTIONAL (U10) — profile.display_name (UNIQUE); email greeting
  phone?: string         // NEW (U10) optional — profile.phone
  mode?: 'email' | 'link'
}
// plugin appends: tenantId, profileId (inviting admin) → workflow payload
```

The `triggerWorkflow` plugin forwards **arbitrary `inputData` keys** (it only injects
`tenantId`/`profileId` and gates the permission), so the four new keys reach the webhook body with
**no plugin change**. Only the registry gate (`invite-user` → `p:app-admin`) is relevant here.
Blank optional fields are sent as empty strings / omitted; the DB normalizes `'' → null`.

## Email templates (inline in `send-notification`, v1)

Two new `templateKey`s rendered inside the existing `send-notification` workflow (same inline
pattern as `test`). Both are transactional, single-CTA, plain-text fallback.

| templateKey | Subject | CTA → URL | vars |
|---|---|---|---|
| `user-invitation` | *You've been invited to fnb* | **Verify your email** → `verifyUrl` | `displayName`, `verifyUrl` |
| `set-password` | *Set your fnb password* | **Set your password** → `setPasswordUrl` | `displayName`, `setPasswordUrl` |

Link shapes (built by the workflow / the `request-password` route from `APP_ORIGIN`):

```
verifyUrl      = ${APP_ORIGIN}/auth/verify-email?userId=<zitadelUserId>&code=<emailCode>
setPasswordUrl = ${APP_ORIGIN}/auth/set-password?userId=<zitadelUserId>&code=<resetCode>
```

Each `notify.notification` row is written by `send-notification` exactly as today
(`channel=email`, `template_key`, `tenant_id` from payload, `status → sent`) — the invite flow
inherits the full audit trail for free.

## ZITADEL user lifecycle (state machine)

```
(none) ──create human user (no password, email unverified, returnCode)──► UNVERIFIED / NO-PW
UNVERIFIED ──email/_verify(emailCode)──► VERIFIED / NO-PW
VERIFIED   ──password_reset(returnCode) → set-password(resetCode, newPassword)──► VERIFIED / HAS-PW
VERIFIED/HAS-PW ──OIDC login──► app.profile linked via provision_idp_user (email match)
```

- The user is **unusable for login** until it reaches VERIFIED/HAS-PW (no password ⇒ ZITADEL
  rejects sign-in). This is the safety property: an invite that is never completed can never log in.
- `username = email`. `profile.givenName/familyName` now (U10) prefer the explicit
  `firstName`/`lastName` when supplied, then fall back to splitting `displayName` on the first
  space, then to `email` — so a fully-blank name still yields a valid ZITADEL profile. Mirrors
  `docker/zitadel/seed.mjs:223`. The email greeting var (`vars.displayName`) falls back
  `displayName → firstName → email`.
- Full call contract: `zitadel-admin-client.md`.

## Permission model

| Action | Gate | Where enforced |
|---|---|---|
| Invite a user | `p:app-admin` | `triggerWorkflow` registry (`invite-user`) — plugin checks claims |
| verify-email / request-password / set-password | **none** (unauthenticated) | Possession of the emailed ZITADEL code is the proof; U5 adds a short-lived verified cookie between verify → request-password |
| Read `notify.notification` rows | `p:app-admin-super` | existing `notify_api.notifications` RLS (unchanged) |

The ceremony routes are deliberately unauthenticated (the invitee has no session yet). Security
rests on ZITADEL's single-use, expiring codes + the verified-cookie handshake — see
`verify-email.data.md`. No fnb RLS surface is exposed to them.

## Environment additions

Most env already exists (notifications + ZITADEL). New/confirmed needs:

```bash
# Public origin used to build ceremony links (already present as APP_ORIGIN / PORT). Confirm it is
# passed into BOTH the n8n service and auth-app.
APP_ORIGIN=http://localhost:4000

# ZITADEL management API (already present for auth-app; must also reach n8n):
NUXT_ZITADEL_INTERNAL_URL=http://zitadel:8080   # server→ZITADEL (n8n + auth-app)
NUXT_ZITADEL_ISSUER=http://localhost:8200       # external host for the Host header + link `iss`
# PAT delivery — see zitadel-admin-client.md (mount the zitadel-seed volume ro into n8n).
```

No new secrets beyond making the existing `fnb-seeder` PAT readable by n8n (Phase 0). The
`send-notification` webhook secret (`N8N_WEBHOOK_SECRET`) is reused for the internal
Execute-Workflow / webhook hop.

## fnb-types

No new entity types are strictly required (the flow produces a `resident` + a
`notify.notification`, both already typed). If the admin page wants a typed result it can reuse the
existing `TriggerWorkflowResult` (`{ accepted, runId }`). `InviteUserInput` (above) lives with the
composable in `graphql-client-api`, not `fnb-types` (it is a transport payload, not an entity).

## Open Questions
- [ ] `n8n_worker` execute grant on `app_fn.invite_user` — confirm present; add if not.
- [ ] Assignment scope for invited users — default `'user'`; do tenant admins need to pick
      `admin`/`superadmin` at invite time, or is that a later role-management action? (v1 = `user`.)
