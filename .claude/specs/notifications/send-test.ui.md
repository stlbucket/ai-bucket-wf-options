# Send-Test Page — UI (site-admin)

## Status
Draft — fill in all `[FILL IN]` sections before implementing. Phase 4 (D7).

A manual harness for site-admins to compose and send an arbitrary notification and confirm the
pipeline end-to-end. Lives in **tenant-app** under the `site-admin` module.

## Route + gate

- Route: `/tenant/site-admin/send-test` (in `tenant-app`).
- Permission: **`p:app-admin-super`** — page guard + nav visibility.
- Nav: registered in the DB (R14) under the `site-admin` module — icon
  `i-lucide-send` (verify exists, UC11). `[FILL IN]` confirm label ("Send Test").

## Layout (Nuxt UI v4, UC3/UC4)

`UCard` (UC4) as the page container, inside the standard `PageHeader`.

- **Compose form** (`UForm`):
  | Field | Control | Notes |
  |---|---|---|
  | Channel | `USelect` | `EMAIL` (v1). `SMS` option present but **disabled** until Phase 5+ (D8) |
  | To | `UInput` | email address (v1); phone later. Basic client validation |
  | Template | `USelect` | `test` (default), `user-invitation`, `zitadel-init`… (from a small static list for v1) |
  | Subject | `UInput` | email only; hidden/disabled when channel = SMS |
  | Body / vars | `UTextarea` | free text for the `test` template; JSON vars for others (`[FILL IN]` — decide free-body vs. vars form) |
  | Send | `UButton` | primary; loading state while dispatching |

- **Result feedback:** `useToast` (UC7) — success ("Queued — check Mailpit") or error. No
  persistent `UAlert` unless a hard failure.

- **Recent sends** (`UTable`): the last N `notify.notification` rows the admin can see (RLS super
  admin). Columns: created, channel, status (badge), template, recipient, provider. Auto-refresh on
  send. Status badge colors (UC6 tokens):
  | Status | Color |
  |---|---|
  | `QUEUED` | `neutral` |
  | `SENT` | `info` |
  | `DELIVERED` / `OPENED` | `success` |
  | `BOUNCED` / `FAILED` | `error` |

## Interactions

| Action | Result |
|---|---|
| Submit form | dispatch via composable → toast → refetch recent sends |
| Change channel → SMS | disabled in v1 (tooltip: "SMS coming in a later phase") |
| Click a recent row | (optional) expand to show payload/error — `[FILL IN]` if needed |

## Responsive (UC5)
Form single-column on mobile; table wrapped in `overflow-x-auto`.
