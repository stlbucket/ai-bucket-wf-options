# support/tickets/index — Ticket List UI

## Status
Implemented

## Route
`/tenant/support/tickets` → `apps/tenant-app/app/pages/support/tickets/index.vue`

## Required Permission
`p:app-user` or `p:app-admin`

## Layout
`TicketList.vue` table

## Component: `TicketList.vue`
Props: ticket array (SupportTicket[])

- Sortable table
- Columns: title, status badge, createdAt
- Each row links to `/support/tickets/{id}`

**Status badge colors:**
| Status | Color |
|---|---|
| open | info (blue) |
| closed | neutral (gray) |
| deleted | error (red) |
| duplicate | warning (orange) |
| parked | warning (orange) |

## User Interactions
- Click row → navigate to `/support/tickets/{id}`
- "New Ticket" button → navigate to `/support/tickets/new`

## Known Gap
No search or filter implemented.
