# support/tickets/index — Ticket List Data

## Status
Implemented — GraphQL

## Route
`/tenant/support/tickets` — see `index.ui.md` for UI details

## GraphQL

### Query on load
- Query name: `AllSupportTickets`
- File: `packages/graphql-client-api/src/graphql/support/query/allSupportTickets.graphql`
- Generated hook: `useAllSupportTicketsQuery()` in `src/generated/fnb-graphql-api.ts`
- Variables: none
- Returns: `tickets: SupportTicket[]` — all tickets visible to current user (RLS filters by resident or admin)

## Composable

- Source: `packages/graphql-client-api/src/composables/useSupportTickets.ts`
- Re-export: `apps/tenant-app/app/composables/useSupportTickets.ts`

```ts
const { tickets, fetching, error, refresh, submitTicket } = useSupportTickets()
```

- `tickets` — computed `SupportTicket[]` with status lowercased via `lc()`
- `fetching` — boolean, reactive loading state
- `submitTicket(title, description)` — executes `SubmitSupportTicket` mutation, returns ticket uuid string

## Types
See `_shared.data.md` → SupportTicket, SupportTicketFragment
