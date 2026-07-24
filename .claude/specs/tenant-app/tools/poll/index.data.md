# tools/poll/index — Poll List Data

## Status
Implemented — GraphQL (2026-07-23). See README for verification + the deferred OTP phase.

## Route
`/tenant/tools/poll` — see `index.ui.md` for UI details

## GraphQL

### Query on load
- **Query name**: `SearchPolls`
- **File** (to create): `packages/graphql-client-api/src/graphql/poll/query/searchPolls.graphql`
- **Generated hook**: `useSearchPollsQuery()`
- **Variables** (all optional): `searchTerm: String`, `status: PollStatus`, `mineOnly: Boolean`
- **Returns**: `nodes: PollSummary[]` — each node: poll fragment (`id`, `urn`, `title`,
  `status`, `closesAt`, `resultsVisibility`, `createdAt`) + `createdByResident { displayName }`
  (resolved via `resourceByCreatedByResidentUrn`) + question count + response count +
  the caller's own response `{ submittedAt }` (whether *I* have answered/submitted).
- **Auth**: RLS scopes to the current tenant. **`draft` polls are filtered to the caller's own**
  (the composable adds `status != 'draft' OR mine` — RLS can't distinguish, §5). Requires `p:poll`.

### Mutation: Create Poll
- **Mutation name**: `CreatePoll`
- **File** (to create): `packages/graphql-client-api/src/graphql/poll/mutation/createPoll.graphql`
- **Generated hook**: `useCreatePollMutation()`
- **Variables**: `title: String!`, `description: String`
- **Returns**: new poll `id`, `urn`, `status` (`DRAFT`)
- On success: `navigateTo('/tenant/tools/poll/{id}')` (opens the new draft in the editor)

## Composable

- **Source (to create)**: `packages/graphql-client-api/src/composables/usePollList.ts`
- **Re-export (to create)**: `apps/tenant-app/app/composables/usePollList.ts`

```ts
const { polls, fetching, error, search, createPoll } = usePollList()
```

| Export | Shape | Usage |
|---|---|---|
| `polls` | `Ref<PollSummary[]>` | bound to list; sorted `open` first, then `updatedAt` desc |
| `fetching` | `Ref<boolean>` | loading state |
| `error` | `Ref<CombinedError \| undefined>` | error state |
| `search(searchTerm, status?, mineOnly?)` | updates variables ref | 300ms debounce on `searchTerm` (page owns the debounce) |
| `createPoll(title, description?)` | `Promise<{ id: string }>` | `CreatePoll` mutation |

`PollSummary` is derived from `SearchPollsQuery['searchPolls']['nodes'][number]` — use the generated
type directly (do not hand-write an interface). Re-run codegen via `executeQuery({ requestPolicy:
'network-only' })` after `createPoll` (there is no `refresh`).

## Types
See `_shared.data.md` §3 (enums), §7 (`Poll`), and the composable-local `PollSummary` view type.

## Decisions
- **Composable split**: `usePollList` (index) and `usePollDetail` (detail) — two files, no shared
  composable (todo precedent).
- **Draft filtering**: client-side (`status != 'draft' OR mine`) because RLS tenant-scopes but
  can't hide others' drafts without breaking the creator's own view.
- **"Answered" indicator**: `PollSummary` carries the caller's own `response.submittedAt` so the
  list can badge "You answered" / "Not answered yet" (see `index.ui.md`).
