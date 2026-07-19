# support — Shared Data Types & Permissions

Referenced by all `support/tickets/*.data.md` files.

## Status
Implemented — GraphQL

## Navigation
```sql
Module: 'Support' / icon: i-lucide-headphones
  row('support-tickets'::citext, 'Tickets'::citext,
      '{"p:app-user","p:app-admin"}'::citext[],
      'i-lucide-ticket'::citext, '/tenant/support/tickets', 0)::app_fn.tool_info
```

## Permission Model
| Action | Required |
|---|---|
| View & submit tickets | `p:app-user` or `p:app-admin` |
| Close / reopen / delete own ticket | Owner (any authenticated resident) |
| Park, mark-duplicate, act on others' tickets | `p:app-admin` or `p:app-admin-support` |
| Enter support mode | `p:app-admin-super` or `p:app-admin-support` |

Enforced at the `app_api` function layer (SECURITY DEFINER) and via RLS policies on `app.support_ticket` and `app.support_ticket_comment`.

## Data Model

### `app.support_ticket`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| tenant_id | uuid | FK, RLS |
| tenant_subscription_id | uuid | FK |
| resident_id | uuid | FK — submitter |
| title | citext | required |
| description | text | required |
| status | SupportTicketStatus | see enum below |
| topic_id | uuid | nullable |
| created_at / updated_at | timestamptz | |

### `app.support_ticket_comment`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| support_ticket_id | uuid | FK |
| resident_id | uuid | FK — commenter |
| body | text | required |
| created_at / updated_at | timestamptz | |

### `SupportTicketStatus` enum (PostGraphile: uppercase values)
`OPEN` | `CLOSED` | `DELETED` | `DUPLICATE` | `PARKED`

Note: the composable lowercases status values via `lc()` so pages/components compare against lowercase.

## GraphQL Types (PostGraphile auto-generated)

| GraphQL Type | Source |
|---|---|
| `SupportTicket` | `app.support_ticket` table |
| `SupportTicketComment` | `app.support_ticket_comment` table |
| `SupportTicketStatus` | `app.support_ticket_status` enum |

TypeScript types exported from `packages/graphql-client-api/src/generated/fnb-graphql-api.ts`.
Fragment types (`SupportTicketFragment`, `SupportTicketCommentFragment`) are exported from `packages/graphql-client-api/src/composables/useSupportTickets.ts`.

## GraphQL Client Setup

- urql plugin: `apps/tenant-app/app/plugins/urql.ts`
  - `preferGetMethod: false`, exchanges: cacheExchange → mapExchange → fetchExchange
- Composable source: `packages/graphql-client-api/src/composables/useSupportTickets.ts`
- Tenant-app re-export: `apps/tenant-app/app/composables/useSupportTickets.ts`

## GraphQL Files (`packages/graphql-client-api/src/graphql/support/`)

### Fragments
- `fragment/SupportTicket.graphql` — core ticket fields
- `fragment/SupportTicketComment.graphql` — core comment fields

### Queries
- `query/allSupportTickets.graphql` → `useAllSupportTicketsQuery()` hook
- `query/supportTicketById.graphql` → `useSupportTicketByIdQuery()` hook (includes nested resident, tenant, commentsList with resident)

### Mutations (from `app_api` functions)
- `mutation/submitSupportTicket.graphql` → `useSubmitSupportTicketMutation()`
- `mutation/closeSupportTicket.graphql` → `useCloseSupportTicketMutation()`
- `mutation/reopenSupportTicket.graphql` → `useReopenSupportTicketMutation()`
- `mutation/deleteSupportTicket.graphql` → `useDeleteSupportTicketMutation()`
- `mutation/parkSupportTicket.graphql` → `useParkSupportTicketMutation()`
- `mutation/markDuplicateSupportTicket.graphql` → `useMarkDuplicateSupportTicketMutation()`
- `mutation/submitSupportTicketComment.graphql` → `useSubmitSupportTicketCommentMutation()`

## DB Functions (`app_api` → `app_fn` two-layer pattern)

| app_api function | Permitted | What it does |
|---|---|---|
| `submit_support_ticket(title, description)` | `p:app-user`, `p:app-admin` | Creates ticket, returns uuid |
| `close_support_ticket(ticket_id)` | Owner or admin/support | → `closed` |
| `reopen_support_ticket(ticket_id)` | Owner or admin/support | → `open` |
| `delete_support_ticket(ticket_id)` | Owner or admin/support | → `deleted` |
| `park_support_ticket(ticket_id)` | `p:app-admin`, `p:app-admin-support` | → `parked` |
| `mark_duplicate_support_ticket(ticket_id)` | `p:app-admin`, `p:app-admin-support` | → `duplicate` |
| `submit_support_ticket_comment(ticket_id, body)` | `p:app-user`, `p:app-admin` | Adds comment |

Sqitch file: `db/fnb-app/deploy/00000000010241_app_fn_support_ticket.sql`
