# SMS-Test Page — UI (site-admin) — "Mailpit for SMS"

## Status
Draft — fill in all `[FILL IN]` sections before implementing. **Phase 0 of the SMS work** (D8/D10/D11).

A manual harness + **dev SMS inbox** for site-admins. Because dev SMS uses the **log-sink**
(D10/D11 — no carrier, no external catcher UI), *this page is the "Mailpit for SMS"*: nothing is
dispatched, so the page itself is where a captured SMS is read. It composes an SMS through the same
`send-notification` chokepoint and lists the captured `notify.notification` rows **with their
rendered body** (the log-sink's whole point). Lives in **tenant-app** under `site-admin`, beside
the email `send-test` page (`send-test.ui.md`).

## Why a dedicated page (not just the email `send-test` SMS option)

The email `send-test` page leans on Mailpit for the actual message body — its table only needs
metadata (status/recipient/provider). The SMS log-sink has **no external inbox**, so the *body must
be visible in-app*. That inverts the table's job (content, not just delivery metadata) and justifies
a separate surface. The email page's stubbed-but-disabled `SMS` option (`send-test.ui.md`) is
**removed** once this page lands — a cross-link replaces it.

## Route + gate

- Route: `/tenant/site-admin/sms-test` (in `tenant-app`).
- Permission: **`p:app-admin-super`** — page guard + nav visibility (same gate as `send-test`).
- Nav: registered in the DB (R14) under `site-admin` — icon `i-lucide-message-square-text`
  (verify exists, UC11). Label "SMS Test". Edited in-place into `…010240_app_fn.sql`
  (lands on next reseed — asset-manager/`send-test` precedent).

## Layout (Nuxt UI v4, UC3/UC4)

`UCard` (UC4) inside the standard `PageHeader`.

- **Compose form** (`UForm`):
  | Field | Control | Notes |
  |---|---|---|
  | To | `UInput` | **E.164** phone (`+15551234567`). Client-side E.164 pattern validation |
  | Template | `USelect` | `sms-test` (default), `phone-verify`, `zitadel-otp` (from a static v1 list) |
  | Body / vars | `UTextarea` | free text for `sms-test`; JSON vars for others (`[FILL IN]` — free-body vs. vars form, mirror `send-test`) |
  | Send | `UButton` | primary; loading state while dispatching |

- **Result feedback:** `useToast` (UC7) — success ("Captured — see the SMS inbox below") or error.

- **SMS Inbox** (`UTable`) — the log-sink made browsable. Filtered to `channel = SMS` rows the admin
  can see (RLS super-admin). Columns: created, status (badge), template, recipient (phone),
  **body** (the rendered message — the reason this page exists), provider (`log-sink`). Auto-refresh
  on send. Row click expands full `payload`/`error` (`[FILL IN]` — confirm exposing rendered body
  for SMS rows; see the PII note in `_shared.data.md`). Status badge colors (UC6 tokens):
  | Status | Color |
  |---|---|
  | `QUEUED` | `neutral` |
  | `SENT` | `info` |
  | `DELIVERED` / `OPENED` | `success` |
  | `BOUNCED` / `FAILED` | `error` |
  With `NOTIFY_SMS_PROVIDER=log-sink`, rows land as `SENT` immediately (recorded, not dispatched);
  the `DELIVERED`/`BOUNCED` states only appear once a real Twilio callback is wired (Phase 5+).

## Interactions

| Action | Result |
|---|---|
| Submit form | dispatch via composable → toast → refetch the SMS inbox |
| Click an inbox row | expand to show rendered body + payload/error |

## Responsive (UC5)
Form single-column on mobile; table wrapped in `overflow-x-auto`; long bodies truncate with expand.

## Open Questions
- [ ] Free-body vs. structured `vars` input for non-`sms-test` templates (mirror `send-test`).
- [ ] Expose the rendered SMS body column (needs `payload` or a `body` projection exposed for SMS
      rows — reconcile with the `_shared.data.md` PII/hide decision).
