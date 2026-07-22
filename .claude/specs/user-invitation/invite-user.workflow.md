# `invite-user` — n8n workflow

## Status
Draft — see README (U2). Definition lands at `n8n/workflows/invite-user.json`, loaded by the
`n8n-import` service like every other workflow. Fired via the `triggerWorkflow` registry
(`invite-user`, `p:app-admin`).

## Trigger + payload

Webhook Trigger (respond-immediately), header-auth `x-fnb-webhook-secret` = `N8N_WEBHOOK_SECRET`
(the existing invariant). Body from the `triggerWorkflow` plugin:

```jsonc
{ "displayName": "Ada Lovelace", "email": "ada@example.com",
  "tenantId": "<inviting tenant>", "profileId": "<inviting admin>" }
```

Respond `200 { accepted: true }` immediately; the rest runs async (fire-and-forget, U5).

## Nodes (happy path)

1. **Webhook** — validate secret; parse payload.
2. **Read PAT** (Code node) — `fs.readFileSync(<seed-volume PAT file>)` → the `fnb-seeder` bearer
   (Phase 0 wiring). Resolve `orgId` once if needed.
3. **Postgres — create resident** (`n8n_worker` credential):
   ```sql
   select * from app_fn.invite_user(:tenantId::uuid, :email::citext);  -- default scope 'user'
   ```
   Idempotent; returns the `resident` row. (Grant check: `_shared.data.md` Open Question.)
4. **ZITADEL — create human user** (HTTP Request, split-horizon + `Host` header —
   `zitadel-admin-client.md` call 1): `POST /v2/users/human`, `email.returnCode`, **no password**.
   - On **2xx** → `{ userId, emailCode }`.
   - On **409 already-exists** → branch to **4b**.
5. **Build link** (Set/Code): `verifyUrl = ${APP_ORIGIN}/auth/verify-email?userId=<userId>&code=<emailCode>`.
6. **Execute Workflow → `send-notification`** (in-engine sub-workflow call; no HTTP hop):
   ```jsonc
   { "channel": "email", "templateKey": "user-invitation", "to": "<email>",
     "subject": "You've been invited to fnb",
     "vars": { "displayName": "<displayName>", "verifyUrl": "<verifyUrl>" },
     "tenantId": "<tenantId>", "profileId": "<profileId>" }
   ```
   `send-notification` renders the inline `user-invitation` template, sends via Mailpit (dev), and
   writes the `notify.notification` row. (If Execute-Workflow is awkward, POST the
   `send-notification` webhook internally with the shared secret — same effect, one HTTP hop.)

### 4b. 409 already-exists (re-invite / seeded email)

- **ZITADEL search** (`zitadel-admin-client.md` call 1b) → `userId` by email.
- **ZITADEL re-request email code** (call 2) `POST /v2/users/{userId}/email` `returnCode` →
  fresh `verificationCode`.
- Continue at node 5 with that code. (Resend semantics — README Open Question / Phase 4.)

## Error handling

- Any ZITADEL/DB node error → the workflow's error branch logs to the n8n run log (the free audit
  trail, R22). No `notify.notification` row is written unless `send-notification` ran (so a failed
  invite leaves no "sent" record — correct).
- `app_fn.invite_user` being idempotent means a retried invite does not duplicate the resident; the
  409 branch means it does not duplicate the ZITADEL user either.

## Registration + import

- `WORKFLOW_REGISTRY['invite-user'] = { permission: 'p:app-admin' }`
  (`trigger-workflow.plugin.ts`).
- `n8n/workflows/invite-user.json` loaded by `n8n-import` (same as `send-notification`).
- Reuses the `fnb-smtp` credential (via `send-notification`) and the `n8n_worker` Postgres
  credential (already present for the notification + game workflows).

## Verify
- [ ] `triggerWorkflow('invite-user', { displayName, email })` from the admin UI returns
      `{ accepted: true }`.
- [ ] `app.resident` has an `invited` row for the email in the inviting tenant.
- [ ] ZITADEL has the human user: email **unverified**, **no password**.
- [ ] Mailpit shows a `user-invitation` mail; `verifyUrl` opens `/auth/verify-email`.
- [ ] `notify.notification` row: `channel=email`, `template_key=user-invitation`, `tenant_id` set,
      `status → sent`.
- [ ] Re-inviting the same email does not error (409 branch) and re-sends a working link.
