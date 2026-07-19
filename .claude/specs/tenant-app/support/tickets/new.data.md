# support/tickets/new — New Ticket Data

## Status
Implemented — GraphQL

## Route
`/tenant/support/tickets/new` — see `new.ui.md` for UI details

## GraphQL

### Mutation on submit
- Mutation name: `SubmitSupportTicket`
- File: `packages/graphql-client-api/src/graphql/support/mutation/submitSupportTicket.graphql`
- Generated hook: `useSubmitSupportTicketMutation()` in `src/generated/fnb-graphql-api.ts`
- Input: `{ _title: String!, _description: String! }`
- Returns: `SubmitSupportTicketPayload { uuid }` — the new ticket's UUID

## Composable

- Source: `packages/graphql-client-api/src/composables/useSupportTickets.ts`
- Re-export: `apps/tenant-app/app/composables/useSupportTickets.ts`

```ts
const { submitTicket } = useSupportTickets()
const id = await submitTicket(title, description)  // returns uuid string
```

On success: page navigates to `/support/tickets/{id}`.

## Types
See `_shared.data.md` → SupportTicket
