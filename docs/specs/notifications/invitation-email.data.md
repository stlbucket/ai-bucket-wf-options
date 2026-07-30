# Invitation Email — v1 sender

## Status
Draft — fill in all `[FILL IN]` sections before implementing. **This is the v1 goal (D6).**

Turns the currently-lazy residency invite into an actual email, riding the pipeline everything else
will reuse.

## Today's flow (context)

Self-registration is disabled; invites are lazy. An admin invites someone → a `resident` row is
created with `status = 'invited'` and no email is sent. The person later logs in via ZITADEL and is
linked by **email-match** (`app.resident … where email = _email and status not in …`, per
`zitadel-login-pattern.md:46-47`). v1 keeps that linking exactly as-is and **adds** an email at the
moment of invitation so the person knows to log in.

## The hook point (`[FILL IN]`)

Locate the fnb-app function that creates/marks a resident `invited` — `[FILL IN]` (confirm the
exact `app_api` / `app_fn` name; likely an `invite_resident` / `add_resident` surface). Two options
for firing the send; pick one when the fn is confirmed:

1. **App-side enqueue (preferred).** Wherever the invite mutation is called (or in a thin server
   handler around it), call `triggerWorkflow(workflowKey: "send-notification", inputData: {...})`
   after the invite commits. Keeps the DB free of outbound-network concerns.
2. **DB `AFTER INSERT` trigger** on the `invited` transition that POSTs to the n8n webhook. Only if
   there is no single app call site. More coupling; use option 1 unless forced.

## Enqueue payload

```jsonc
{
  "channel": "email",
  "templateKey": "user-invitation",
  "to": "<resident.email>",
  "subject": "You've been invited to fnb",
  "vars": {
    "displayName": "<resident display name or email local-part>",
    "tenantName": "<inviting tenant name>",
    "loginUrl": "https://<host>/auth"        // ZITADEL login entry (no token — email-match links on login)
  },
  "tenantId": "<inviting tenant id>",
  "profileId": null                            // no profile yet — created on first login
}
```

**Security note:** the invite email carries **no auth token or magic link** — it is purely a
"come log in" nudge. Identity is still established by ZITADEL + the existing email-match linking on
first login (`email_verified` gate unchanged). This deliberately avoids inventing a second
credential path alongside the IdP.

## Template `user-invitation`

Rendered inside `send-notification` (inline, v1). Content: greeting with `displayName`, who invited
them (`tenantName`), a single **Log in** CTA button to `loginUrl`, plain-text fallback. Keep it
minimal; branding/i18n is deferred.

## Verify
- [ ] Inviting a resident enqueues the workflow → a `user-invitation` message lands in Mailpit.
- [ ] A `notify.notification` row exists (`channel=email`, `template_key=user-invitation`,
      `tenant_id` set, `status` → `sent`).
- [ ] The invited person can still log in via ZITADEL and gets email-matched to the resident row
      (existing behavior — regression check only).

## Open Questions
- [ ] Exact invite fn + call site (`[FILL IN]`).
- [ ] Re-invite / resend semantics (new row each time? throttle?).
- [ ] Does the invite email need a tenant-branded from-address, or is the global `NOTIFY_MAIL_FROM`
      enough for v1? (v1 = global.)
