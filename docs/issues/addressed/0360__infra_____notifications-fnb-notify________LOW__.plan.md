# Notifications — `fnb-notify` pipeline + site-admin test page

> **Execution Directive:** implement this plan via `/fnb-stack-implementor <this plan>` — the
> implementor executes the Suggested Sequence below in order. Source spec:
> `.claude/specs/notifications/` (README + `_shared.data.md` + workflow/infra/page files). Derived
> from that README's Implementation Task List, **scoped to Phases 1, 2, 4** (Phase 3 invitation
> email and Phase 5+ SMS/2FA are deferred — see Out of Scope).

## Status
In progress (2026-07-22). §1–§7 authored & offline-verified; §8 (codegen + builds + deploy +
live verification) is blocked on a user-run env rebuild.

**Done (authored + offline checks):**
- §1 `db/fnb-notify/` package (schema/enums/table, `notify_fn` writers, `notify_api.notifications`,
  policies/RLS/`n8n_worker` grants, revert/verify/pgTAP) + `DEPLOY_PACKAGES` (after `fnb-n8n`).
- §2 `notify`/`notify_api` added to `graphile.config.ts`; smart-tag renames in
  `postgraphile.tags.json5` (`notify_notifications` + drop the table's root list — n8n posture).
- §3 `send-notification` added to `WORKFLOW_REGISTRY` (gated `p:app-admin-super`).
- §4 `n8n/workflows/{send-notification,notification-webhook}.json` (JSON validated) + `fnb-smtp`
  credential template (renders to valid JSON).
- §5 Mailpit compose service + volume + n8n dep; `NOTIFY_*`/`RESEND_*`/`TWILIO_*` in `.env`/`.env.example`;
  `NOTIFY_SMTP_*` on `n8n-import`.
- §6 `fnb-types` `Notification` types (package **builds clean**); `recentNotifications.graphql`;
  `toNotification` mapper; `useRecentNotifications` + `useSendTest` composables + barrels; tenant-app
  re-exports.
- §7 `pages/site-admin/send-test.vue` + nav tool `tenant-site-admin-send-test`.

**Verified live after rebuild (2026-07-22):**
- `fnb-notify` deployed — `notify`/`notify_fn`/`notify_api`, `record_send`/`update_delivery`/
  `status_rank`, `view_notifications_super_admin` RLS all present.
- Codegen succeeded against the live schema; `notifyNotificationsList` + `NotificationChannel`
  (EMAIL/SMS) generated exactly as authored (smart-tag rename confirmed). `graphql-client-api`
  builds green.
- Both workflows imported + active (webhook POSTs → 200). emailSend/If node schemas import cleanly.
- **Full send path proven headlessly:** POST `send-notification` → Mailpit delivered the mail →
  `notify.notification` row `sent | email | mailpit` with the captured `provider_message_id`.
- GraphQL read path exposed + gated: anon `notifyNotificationsList` raises `p:app-admin-super`.

**Remaining (2 items):**
1. **Nav entry not live.** The `tenant-site-admin-send-test` row was edited into the
   already-deployed `db/fnb-app/…010240_app_fn.sql` (in-place, house convention) — it lands on the
   next **full env rebuild / reseed** (asset-manager precedent). The page works by direct URL now.
2. **Authenticated UI click-through** (render page → send → recent-sends table) needs a
   super-admin browser session — not headless-testable. (tenant-app may need an app-container
   restart to pick up the rebuilt `graphql-client-api` dist.)

## Category / severity
`infra` / `LOW` — net-new capability, no existing breakage. Spans db + graphql + n8n + a
tenant-app page.

## Goal

Stand up the multi-channel notification pipeline and prove it end-to-end from a UI:

- **`fnb-notify`** sqitch package — `notify.notification` outbox/log (email + sms channels),
  `notify_fn` SECURITY DEFINER writers, RLS, `n8n_worker` grants.
- **`send-notification`** n8n workflow — the single outbound chokepoint, entered via the
  `triggerWorkflow` registry.
- **`notification-webhook`** n8n workflow — provider delivery events → `update_delivery`.
- **Site-admin `send-test` page** in tenant-app — compose + send an arbitrary notification,
  recent-sends table. Gated `p:app-admin-super`.

Success = a super-admin sends a test email from the page → it appears in **Mailpit** and a
`notify.notification` row goes `queued → sent`.

## Locked decisions (from the spec README)

Resend (prod) / **Mailpit (dev)** · new **`fnb-notify`** package (after `fnb-n8n`) · ZITADEL
return-code → n8n (deferred) · **multi-channel schema from day one** (email + sms enum, sms
dispatch deferred) · site-admin **`send-test`** page · SMS/2FA = Phase 5+.

## Verified anchors (resolved at plan time)

- **`triggerWorkflow` registry** → `apps/graphql-api-app/server/graphile/trigger-workflow.plugin.ts:14`
  (`WORKFLOW_REGISTRY`). Mutation gates claims + `permission`, then POSTs
  `${N8N_INTERNAL_URL}/webhook/<key>` with `x-fnb-webhook-secret` (`N8N_WEBHOOK_SECRET`), injecting
  `tenantId`/`profileId` into the body. Add `'send-notification': { permission: 'p:app-admin-super' }`.
- **n8n has NO Caddy route** — its own host port (`docker/Caddyfile` note; R22). fnb→n8n uses
  `N8N_INTERNAL_URL=http://n8n:5678` (`.env.example:109`) + `N8N_WEBHOOK_SECRET` (`.env.example:107`).
- **DB precedent** → `db/fnb-n8n/deploy/00000000011200_n8n.sql` (flat log table) +
  `…011230_n8n_policies.sql` (RLS `view_*_super_admin` + `n8n_worker` role grants). Mirror both.
- **Workflow precedent** → `n8n/workflows/exerciser.json` (Webhook Trigger + Postgres nodes over the
  `n8n_worker` credential) + the shared `n8n/workflows/error-handler.json` (set as Error Workflow).
- **`n8n_worker` PG credential** already exists (`N8N_WORKER_PG_PASSWORD`, `.env.example:104`) — the
  workflows' Postgres nodes use it; `fnb-notify` grants it execute on `notify_fn`.

## Suggested Sequence

### §1 — DB package `fnb-notify`  (spec: `_shared.data.md`)  → skills: `new-db-package`, `fnb-db-designer`, `sqitch-expert`
1. Scaffold `db/fnb-notify/` (`new-db-package`) and register in `DEPLOY_PACKAGES` **after
   `fnb-n8n`** (`.env` + `.env.example`):
   `… fnb-app fnb-n8n fnb-notify fnb-res fnb-msg …`.
2. `deploy/<ts>_notify.sql` — `create schema notify`; enums `notify.notification_channel`
   (`email`,`sms`) + `notify.notification_status` (`queued`,`sent`,`delivered`,`opened`,
   `bounced`,`failed`) (unique codec names — the collision lesson in `00000000011200_n8n.sql:7`);
   table `notify.notification` + indexes (per `_shared.data.md`).
3. `deploy/<ts>_notify_fn.sql` — SECURITY DEFINER `notify_fn.record_send(...)` (returns uuid) and
   `notify_fn.update_delivery(_provider_message_id, _status, _error)` (match by
   `provider_message_id`; never regress a terminal status — define the transition guard here).
4. `deploy/<ts>_notify_api.sql` — read helpers if needed (the RLS table read covers the recent-sends
   list; keep `notify_fn` unexposed, mirroring storage — no mutation can forge a send).
5. `deploy/<ts>_notify_policies.sql` — grants + `enable row level security` +
   `view_notifications_super_admin` (copy `00000000011230_n8n_policies.sql:17`); `n8n_worker` usage
   + execute-on-`notify_fn` grants (copy lines 41–44).
6. `revert/` + `verify/` for each. **No `git` during the sqitch session.**

### §2 — PostGraphile exposure  (spec: `_shared.data.md`)  → skill: `postgraphile-5-expert`
7. Add **only** `'notify'` to `pgServices.schemas` in
   `apps/graphql-api-app/server/graphile.config.ts` (never `notify_fn`).
8. If any column should be hidden from the read type (`payload`/`error`), add behaviors in
   `apps/graphql-api-app/postgraphile.tags.json5` (`-select -filterBy -orderBy`). Default: expose the
   scalar log fields the test page needs; store template **vars** (not the full rendered body) in
   `payload` to keep PII minimal.

### §3 — Register `send-notification` in the trigger registry
9. Add `'send-notification': { permission: 'p:app-admin-super' }` to `WORKFLOW_REGISTRY`
   (`trigger-workflow.plugin.ts:14`). (v1's only caller is the site-admin page; loosen later when
   invitation/other senders land.)

### §4 — n8n workflows  (spec: `send-notification.workflow.md`, `notification-webhook.workflow.md`)  → skill: `n8n-cli`
10. `n8n/workflows/send-notification.json` — Webhook Trigger (path `send-notification`,
    **respond-immediately**, Header-Auth on `x-fnb-webhook-secret`) → validate (channel ∈
    {email,sms}; `to` present; subject when email) → route by channel:
    - **email**: render template (Code/Set keyed by `templateKey`; inline `test` template for v1) →
      provider by `NOTIFY_EMAIL_PROVIDER` (mailpit = Send Email node to `NOTIFY_SMTP_HOST:PORT`;
      resend = HTTP Request to Resend).
    - **sms**: `log-sink` (record only) for now (D10).
    → Postgres node (`n8n_worker` cred): `select notify_fn.record_send(...)` with `status='sent'` on
    success / `'failed'` on the error branch. Set the shared `error-handler` as Error Workflow.
11. `n8n/workflows/notification-webhook.json` — Webhook Trigger (path `notification-webhook`) →
    verify Resend signature (`RESEND_WEBHOOK_SECRET`) → map event → status → Postgres
    `notify_fn.update_delivery(...)`. Idempotent; unknown `provider_message_id` → 200 no-op.
12. Register both in the `n8n-import` one-shot so they load on env build.

### §5 — Infrastructure  (spec: `infrastructure.md`)
13. Add the **`mailpit`** compose service (`axllent/mailpit`, UI `:8025`, SMTP `1025` internal) +
    `mailpit-data` volume to `docker-compose.yml`. Pass `NOTIFY_*` / `RESEND_*` env into the `n8n`
    service.
14. Add `NOTIFY_EMAIL_PROVIDER`, `NOTIFY_SMS_PROVIDER`, `NOTIFY_SMTP_HOST`, `NOTIFY_SMTP_PORT`,
    `NOTIFY_MAIL_FROM`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET` (+ stubbed `TWILIO_*`) to `.env`
    + `.env.example`. Dev defaults: `NOTIFY_EMAIL_PROVIDER=mailpit`, `NOTIFY_SMS_PROVIDER=log-sink`,
    `NOTIFY_SMTP_HOST=mailpit`, `NOTIFY_SMTP_PORT=1025`.

### §6 — Types + graphql-client-api  (spec: `send-test.data.md`)
15. `packages/fnb-types/src/notification.ts` — `Notification` + `NotificationChannel` /
    `NotificationStatus` (UPPERCASE, R3); barrel-export from `src/index.ts`.
16. `.graphql` docs under `src/graphql/notify/query/recentNotifications.graphql` (+ any fragment).
    The send path **reuses the existing `triggerWorkflow` mutation** — no new mutation doc.
17. Codegen (`pnpm -F @function-bucket/fnb-graphql-client-api generate`); mapper
    `src/mappers/notification.ts` (`toNotification`).
18. Composables `useSendTest()` (wraps the generated `triggerWorkflow` hook) + `useRecentNotifications()`
    in `src/composables/`; **add both to the barrel `src/index.ts`** (the #1 miss). Build the package.

### §7 — Site-admin `send-test` page  (spec: `send-test.ui.md`, `send-test.data.md`)
19. Thin re-exports `apps/tenant-app/app/composables/{useSendTest,useRecentNotifications}.ts`.
20. Page `apps/tenant-app/app/pages/site-admin/send-test.vue` — `UCard`, `UForm` (channel [SMS
    disabled], to, template, subject, body), send → `useToast`, recent-sends `UTable` (v4 API, UC13;
    status badge colors per `send-test.ui.md`); `max-w-5xl mx-auto` (UC12). `p:app-admin-super` page
    guard. Ensure tenant-app declares `@iconify-json/lucide` (icon `i-lucide-send` — verify, UC11).
21. Register the nav tool in the DB (R14) under `site-admin` in
    `db/fnb-app/deploy/00000000010240_app_fn.sql` (goes live on reseed).

### §8 — Verify (read-only; ask the user before any env rebuild)
22. After the user rebuilds the env: open `/tenant/site-admin/send-test`, send a test email →
    confirm a message in Mailpit (`:8025`) **and** a `notify.notification` row (`channel=email`,
    `status` → `sent`) in the recent-sends table.
23. Confirm the send is `POST /graphql-api/api/graphql` `triggerWorkflow` (not REST); missing `to` /
    bad channel → `failed` row, no provider call.
24. Reconcile the spec: flip README Phase 1/2/4 checkboxes; record any live-run corrections.

## Out of Scope (deferred — do NOT build here)

- **Phase 3 — invitation email.** Blocked: no invite surface exists (`app_fn.invite_user` is
  internal-only; the `api/invite-user` endpoint in the SQL comment is a stale Supabase-era stub).
  Needs its own decision (expose `app_api.invite_user` + admin action, vs. hook the internal fn).
  See `invitation-email.data.md`.
- **Phase 5+ — SMS dispatch + 2FA.** Twilio branch, ZITADEL MFA + HTTP-SMS-provider → n8n webhook;
  blocked on verifying the HTTP SMS provider exists on the running ZITADEL version.
  See `sms-2fa.future.md`.
- **ZITADEL return-code email** (`zitadel-codes.data.md`) — deferred past this plan.

## Open items to decide during execution (defaults proposed)

- `record_send` **enqueue-then-update** vs single success/failure insert → default: single insert
  (`queued` only if the enqueue-then-update path is wanted for retries).
- `update_delivery` allowed transitions (terminal-state protection) → default: never regress from
  `bounced`/`failed`.
- `payload` contents → default: template vars only, not the full rendered body (PII).
- test-page body input: free text (for `test`) vs structured vars → default: free text for `test`,
  a small vars textarea for other templates.
