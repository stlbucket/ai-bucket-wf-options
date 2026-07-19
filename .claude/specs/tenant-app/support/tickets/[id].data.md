# support/tickets/[id] — Ticket Detail Data

## Status
Implemented — GraphQL

## Route
`/tenant/support/tickets/[id]` — see `[id].ui.md` for UI details

## GraphQL

### Query on load
- Query name: `SupportTicketById`
- File: `packages/graphql-client-api/src/graphql/support/query/supportTicketById.graphql`
- Generated hook: `useSupportTicketByIdQuery()` in `src/generated/fnb-graphql-api.ts`
- Variables: `{ id: UUID! }`
- Returns: `SupportTicket` with nested:
  - `resident` — submitter (id, profileId, displayName, email, status, type)
  - `tenant` — tenant info (id, name, status, type)
  - `supportTicketCommentsList(orderBy: CREATED_AT_ASC)` — comments with nested `resident` (id, displayName, email)

### Mutations
| Mutation name | File | Input | Payload |
|---|---|---|---|
| `CloseSupportTicket` | `mutation/closeSupportTicket.graphql` | `_ticketId: UUID!` | `{ supportTicket { ...SupportTicket } }` |
| `ReopenSupportTicket` | `mutation/reopenSupportTicket.graphql` | `_ticketId: UUID!` | `{ supportTicket { ...SupportTicket } }` |
| `DeleteSupportTicket` | `mutation/deleteSupportTicket.graphql` | `_ticketId: UUID!` | `{ supportTicket { ...SupportTicket } }` |
| `ParkSupportTicket` | `mutation/parkSupportTicket.graphql` | `_ticketId: UUID!` | `{ supportTicket { ...SupportTicket } }` |
| `MarkDuplicateSupportTicket` | `mutation/markDuplicateSupportTicket.graphql` | `_ticketId: UUID!` | `{ supportTicket { ...SupportTicket } }` |
| `SubmitSupportTicketComment` | `mutation/submitSupportTicketComment.graphql` | `_ticketId: UUID!, _body: String!` | `{ supportTicketComment { ...SupportTicketComment } }` |

All mutation files are in `packages/graphql-client-api/src/graphql/support/`.
All mutations call `executeQuery({ requestPolicy: 'network-only' })` after completion to refresh the detail query.

## Composable

- Source: `packages/graphql-client-api/src/composables/useSupportTickets.ts`
- Re-export: `apps/tenant-app/app/composables/useSupportTickets.ts`

```ts
const {
  ticket,       // computed: SupportTicket (with nested resident/tenant/comments) | null
  comments,     // computed: SupportTicketComment[] (each with nested resident)
  fetching,     // boolean reactive loading state
  refresh,      // () => void — re-executes query with network-only
  closeTicket,          // () => Promise<void>
  reopenTicket,         // () => Promise<void>
  deleteTicket,         // () => Promise<void>
  parkTicket,           // () => Promise<void>
  markDuplicateTicket,  // () => Promise<void>
  addComment,           // (body: string) => Promise<void>
} = useSupportTicket(id)
```

All action mutations are pre-bound to the ticket id passed to `useSupportTicket(id)`.
Each mutation throws on error (passes through `result.error`).
The page wraps each action in a `doAction(fn, label)` helper for toast feedback.

Note: `ticket.status` is lowercased via `lc()` in the composable. Nested `tenant.status`, `tenant.type`, `submitter.status`, `submitter.type` are raw uppercase GraphQL enum values — use `.toLowerCase()` in templates for display.

## Types
See `_shared.data.md` → SupportTicket, SupportTicketComment, SupportTicketFragment, SupportTicketCommentFragment
