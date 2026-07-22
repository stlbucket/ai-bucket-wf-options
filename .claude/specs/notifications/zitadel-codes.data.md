# ZITADEL Codes — return-code mode

## Status
Draft — fill in all `[FILL IN]` sections before implementing. **Deferred past v1** (D6 = invitation
only); documented here so the pattern is locked. Depends on the invitation pipeline (Phases 1–2).

## Decision (D5)

ZITADEL never gets SMTP. For any ZITADEL flow that would normally email a code (user **init**,
email **verification**, and — if ever enabled — password reset), the app requests the code be
**returned in the API response** and hands it to `send-notification`. ZITADEL stays a pure identity
engine; n8n remains the single sender.

In this stack most of these never fire (no password path; users seeded verified; invites are lazy
and handled app-side — see README "The email problem"). The realistic case is **creating a human
user via the ZITADEL management API** who then needs an init/verify code — return-code mode covers
it without SMTP.

## How return-code mode works

ZITADEL user-creation / code-request endpoints accept a flag that makes ZITADEL **return** the
generated code instead of sending it (rather than `sendCode`, request the returned code). The app:

1. Calls the ZITADEL management/v2 API (service account: the `fnb-seeder` machine user's PAT,
   already provisioned — `zitadel-login-pattern.md:122`) to create/init the user **with return-code
   requested**. `[FILL IN]` — confirm the exact v2 endpoint + field name against the running
   ZITADEL version (e.g. the user init / email-verify code endpoints; the field is the
   `returnCode`/`sendCode` selector on the request).
2. Receives `{ code, ... }` in the response.
3. Enqueues `triggerWorkflow("send-notification", { channel:"email", templateKey:"zitadel-init"
   | "zitadel-verify", to: email, vars: { code, actionUrl }, ... })`.

The app engages the ZITADEL API through the existing service-account path (`zitadel-expert` skill →
`references/service-users-and-apis.md` for auth: PAT is a ready-made Bearer; management calls are
org-scoped via `x-zitadel-orgid`).

## Templates

- `zitadel-init` — "finish setting up your account", code + action link.
- `zitadel-verify` — "verify your email", code + action link.

Inline in `send-notification` (v1 pattern). `[FILL IN]` — the `actionUrl` ZITADEL expects the code
posted back to (its verify/init completion endpoint or a hosted-login deep link).

## Fallback

If return-code mode is awkward for a flow, configure ZITADEL SMTP at `mailpit:1025` (dev) / Resend
(prod) and use ZITADEL's built-in templates — a second sender, accepted only if needed (README
Considered & rejected).

## Open Questions
- [ ] Exact v2 endpoints + return-code field names on the running ZITADEL version.
- [ ] Which flows are actually reachable here (likely just admin-created users) — may make this a
      thin, rarely-exercised path.
- [ ] `actionUrl` / code-completion endpoint.
