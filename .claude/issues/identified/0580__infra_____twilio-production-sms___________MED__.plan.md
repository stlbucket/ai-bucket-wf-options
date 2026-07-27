# Plan: Twilio production SMS cutover (log-sink → real dispatch + authenticated delivery callbacks)

> **Execution Directive:** implement via `/fnb-stack-implementor <this-file>` — execute the
> phases below in order. Spec (source of truth): `.claude/specs/twilio-production-sms/`
> (README + `sms-cutover.md` + `status-callbacks.md`; all Open Questions resolved 2026-07-27).
> **Never run `git`. Never rebuild/restart the env — ask the user, then verify read-only.**

**Severity: MED** · Category: infra · Identified: 2026-07-27 (spec authored + planned same day)

## PARKED (2026-07-27, user decision — "sms can be added later")

Phases 1–2 + the dev side of Phase 4 are **built, shipped to the tree, and dev-verified**
(log-sink renders `payload.body`; forged-callback gate + Resend passthrough proven; see the
ticked items). The tree is safe to deploy while parked: prod tpl/compose were reverted to
`NOTIFY_SMS_PROVIDER=log-sink` with blank-tolerant `TWILIO_*` vars, so **prod behaves exactly
as before and deploys need no Twilio secrets**. The `fnb-twilio` credential imports blank
everywhere; the Twilio branch is unreachable until the provider flips.

**To resume:** run Phase 0 (Twilio console), then Phase 3 exactly as written (GH secrets + the
tpl swap noted inline) — no code changes needed. Then the Phase 4 prod verification + the
notifications spec Mode-3 sync.

## Context

Prod (`do-prod`, function-bucket.com) sends real email via Resend, but SMS is still the dev
log-sink: `send-notification`'s non-email branch records a `notify.notification` row
(`provider='log-sink'`) and dispatches nothing — so production phone verification can't
complete. This plan wires Twilio as the prod SMS provider behind an env-driven branch
(`NOTIFY_SMS_PROVIDER`), exactly mirroring the shipped Resend email cutover
(`.claude/specs/resend-production-updates/`, deployed 2026-07-26). **Zero DDL** — the
`fnb-notify` schema is multi-channel from day one, and `notify_fn.update_delivery` already has
the monotonic `status_rank` guard (`db/fnb-notify/deploy/00000000011250_notify_fn.sql:91`).

Verified anchors (2026-07-27):

- `n8n/workflows/send-notification.json` — nodes `Webhook → If Email → (Render → Send Email →
  Record Sent/Record Failed) | Record Sms Sink`; the sink is the 12-arg
  `notify_fn.record_send` call with a `'log-sink'` literal and **no rendered body**.
- `n8n/workflows/notification-webhook.json` — `Map Status` (`m1` already falls back to
  `body.MessageSid`; `m2` maps only Resend `email.*` types), no auth/signature check.
- `n8n/credentials/fnb-smtp.json.tpl` + `n8n/scripts/render-credentials.mjs` — template
  pattern; renderer fails only on **undefined** env (empty strings render fine).
- Dev `docker-compose.yml`: `n8n-import` NOTIFY_SMTP block at :690-695; `n8n` service at :728+
  with `N8N_BLOCK_ENV_ACCESS_IN_NODE: "false"` and
  `NODE_FUNCTION_ALLOW_BUILTIN: "fs,http,https"`.
- Prod `infra/compose/docker-compose.prod.yml`: env-driven `NOTIFY_SMTP_*` at :214-219
  (n8n-import); `n8n` service at :246+.
- `infra/env/.env.prod.tpl:85-96` — the notifications block ("SMS stays log-sink" comment to
  retire); `.github/workflows/deploy.yml:121` — `RESEND_API_KEY` precedent for secret plumbing.
- `.env.example:118,130-132` — `NOTIFY_SMS_PROVIDER=log-sink` + the three blank `TWILIO_*` vars
  already declared.
- Twilio node on the pinned image (2.30.7) exposes `options.statusCallback` (verified in
  `n8n-nodes-base/dist/nodes/Twilio/Twilio.node.js` inside `fnb_n8n`) — no HTTP-Request
  fallback needed.
- Prod Caddy: `n8n.{$DOMAIN} { reverse_proxy n8n:5678 }` (`infra/docker/Caddyfile:75-77`) —
  Host preserved, `X-Forwarded-Proto` set → signature URL reconstruction works.
- SMS-Test inbox reads `payload.body` / `payload.code`
  (`apps/tenant-app/app/pages/site-admin/sms-test.vue:26-29`) — recording `vars ∪ {body}` is a
  strict superset, display-compatible.
- `phone-verification.json` → `Send OTP SMS` POSTs
  `{channel:'sms', templateKey:'phone-verify', to, vars:{code}, …}` internally — becomes a real
  text on prod automatically once the branch lands. OTP TTL = 10 min
  (`db/fnb-notify/deploy/00000000011290_notify_prefs_fn.sql:74`).

## Phase 0 — Twilio console prerequisites (USER-SIDE — report, don't block local work)

Owner: user, in the Twilio console. Needed before **Phase 3** only:
- [ ] Upgraded (non-trial) account; capture `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`.
- [ ] SMS-capable number purchased → `TWILIO_FROM_NUMBER` (E.164).
- [ ] US A2P 10DLC registration (or toll-free verification) on that number.
- [ ] Geo permissions limited to actual destination countries.

## Phase 1 — Credential + env plumbing (dev stays green)

- [x] Create `n8n/credentials/fnb-twilio.json.tpl` — id `fnbtwilio1`, name `fnb-twilio`, type
      `twilioApi`, data `{ authType: "authToken", accountSid: "${TWILIO_ACCOUNT_SID}",
      authToken: "${TWILIO_AUTH_TOKEN}" }` (spec `sms-cutover.md` §Credential; mirror
      `fnb-smtp.json.tpl`).
- [x] Dev `docker-compose.yml`:
      - `n8n-import` env += `TWILIO_ACCOUNT_SID: "${TWILIO_ACCOUNT_SID:-}"`,
        `TWILIO_AUTH_TOKEN: "${TWILIO_AUTH_TOKEN:-}"` (blank-tolerant — **not** `:?`).
      - `n8n` env += `NOTIFY_SMS_PROVIDER: "${NOTIFY_SMS_PROVIDER:?}"`,
        `TWILIO_FROM_NUMBER: "${TWILIO_FROM_NUMBER:-}"`,
        `TWILIO_AUTH_TOKEN: "${TWILIO_AUTH_TOKEN:-}"`;
        `NODE_FUNCTION_ALLOW_BUILTIN` → `"fs,http,https,crypto"`.
- [x] Prod `infra/compose/docker-compose.prod.yml`: same keys in the same two services, all
      `:?`-required; same `NODE_FUNCTION_ALLOW_BUILTIN` extension.
- [x] `.env.example`: update the Twilio comment ("Phase 5+ SMS" → spec pointer). Vars exist.
- [x] **Stop and ask the user to restart dev** (`docker compose down && up`), then verify
      read-only: `n8n-import` logs show 6 credentials rendered; n8n healthy; a Mailpit email
      send still works.

## Phase 2 — `send-notification` SMS branch (spec `sms-cutover.md` §Target node flow)

- [x] `Render Sms` Code node (SMS branch head): `phone-verify` → "fnb: your phone verification
      code is {code}. It expires in 10 minutes."; `otp-login` → login-code variant; fallback
      `vars.body ?? vars.text ?? templateKey`. Output `{ body }`.
- [x] `If Twilio` If node: `$env.NOTIFY_SMS_PROVIDER` equals `twilio`.
- [x] `Send Sms` Twilio node (cred `fnb-twilio`): From `$env.TWILIO_FROM_NUMBER`, To
      `body.to`, Message from `Render Sms`; `options.statusCallback` =
      `https://n8n.<domain>/webhook/notification-webhook` derived from env (reuse the prod
      `N8N_EXTERNALDOMAIN`/`WEBHOOK_URL` value — pick the exact expression against the compose
      env; dev never dispatches); `onError: continueErrorOutput`.
- [x] `Record Sms Sent` / `Record Sms Failed` Postgres nodes (12-arg `record_send` shape):
      provider `$env.NOTIFY_SMS_PROVIDER`, providerMessageId `$json.sid` (sent) / `''`
      (failed), status `'sent'`/`'failed'`, payload `JSON.stringify({ ...vars, body })`,
      error populated on the failed path. Sink keeps `'log-sink'` literal but gains
      `payload.body`.
- [x] Wire connections: `If Email` false → `Render Sms` → `If Twilio` → (true: `Send Sms` →
      sent/failed records; false: `Record Sms Sink`). Email branch untouched;
      `settings.errorWorkflow` untouched.
- [x] Edit `n8n/workflows/send-notification.json` in the repo (definitions are code, R22);
      dev-iterate via `n8n-cli` if useful but the repo JSON is the artifact.
- [x] Verify (dev, after user restart): SMS-Test page send → row `sms`/`log-sink`/`sent` with
      rendered body visible in the inbox; phone-verification round-trip green; email
      regression check (Mailpit).

## Phase 3 — Prod cutover

- [ ] User adds GH repo secrets `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` /
      `TWILIO_FROM_NUMBER` (values from Phase 0).
- [x] `.github/workflows/deploy.yml`: pass the three secrets in the render-env step env block
      (next to `RESEND_API_KEY`, :121).
- [ ] `infra/env/.env.prod.tpl`: set `NOTIFY_SMS_PROVIDER=twilio` + swap the three blank
      `TWILIO_*=` lines for `${TWILIO_*}` tokens (render-env fails loud if a secret is
      missing — deploy is blocked until Phase 0 lands). *Was done 2026-07-27, then
      deliberately reverted to log-sink/blanks at park time so unrelated prod deploys don't
      require Twilio secrets — the tpl comment shows the exact swap.*
- [x] `infra/README.md`: secrets checklist 22 → 25, list the three.
- [ ] **User dispatches the deploy** (env-only: same image tag, `deploy.README.md` gotcha #2).
      Verify: prod SMS-Test send → real text arrives; row `provider='twilio'`,
      `provider_message_id` = `SM…`; bad number → `failed` row; prod phone verification
      completes and the SMS preference toggle unlocks.

## Phase 4 — Delivery callbacks + signature (spec `status-callbacks.md`)

- [x] `notification-webhook.json` `Map Status`: when `body.MessageSid` present map
      `MessageStatus` (`delivered`→`delivered`; `undelivered`/`failed`→`failed` +
      `{errorCode: ErrorCode}`; `queued`/`sending`/`sent`/`accepted`→`sent`); else keep the
      Resend `email.*` map. (`update_delivery`'s rank guard makes stray `sent` callbacks
      no-ops — already confirmed.)
- [x] `Verify Twilio Signature` Code node between `Webhook` and `Map Status`: gate on
      `body.MessageSid` presence (Resend passes through); rebuild URL from
      `x-forwarded-proto` + `host` headers; `require('node:crypto')` HMAC-SHA1 base64 over
      URL + alphabetically-sorted `name+value` params; `timingSafeEqual` vs
      `X-Twilio-Signature`; mismatch → throw (lands in `error-handler`).
- [ ] Verify (prod, with the user): real send advances `sent → delivered`; forged `curl`
      callback errors and mutates nothing; a Resend email delivery event still advances email
      rows.

## Spec sync (Mode 3, after Phases land)

- [ ] `.claude/specs/notifications/`: README status + `infrastructure.md` env table +
      `send-notification.workflow.md` / `notification-webhook.workflow.md` node flows +
      `sms-test.data.md` body-projection note → reflect env-branched Twilio-on-prod. Fold into
      issue `0370` (notify-sms-spec-reconcile) if that housekeeping runs first; otherwise tick
      it here and note on 0370.

## Out of scope

ZITADEL auth-grade SMS 2FA (notifications D9, `sms-2fa.future.md`); Resend svix webhook
verification (`resend-production-updates` OQ2); Messaging Service SID (env-compatible later
upgrade); `notify.template` table; email provider-label de-hardcode (`'mailpit'` literal —
resend spec Phase 2).
