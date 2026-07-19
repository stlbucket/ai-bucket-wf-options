# tools/todo/index — Todo List Data

## Status
Draft — fill in all [FILL IN] sections before implementing.

## Route
`/tenant/tools/todo` — see `index.ui.md` for UI details

## GraphQL

### Query on load
- **Query name**: `SearchTodos`
- **File**: `packages/graphql-client-api/src/graphql/todo/query/searchTodos.graphql`
- **Generated hook**: `useSearchTodosQuery()` in `src/generated/fnb-graphql-api.ts`
- **Variables** (all optional):
  - `searchTerm: String` — partial match on name/description
  - `rootsOnly: Boolean` — `true` on load (show only root todos, not subtasks)
  - `isTemplate: Boolean` — `false` on load; `true` when user shows templates
  - `todoType: TodoType` — not used on index page (show all types)
- **Returns**: `nodes: TodoSummary[]` — each node includes Todo fragment + resident (displayName) + parentTodo + tenant name
- **Auth**: RLS scopes results to current tenant automatically

### Mutation: Create Todo
- **Mutation name**: `CreateTodo`
- **File**: `packages/graphql-client-api/src/graphql/todo/mutation/createTodo.graphql`
- **Generated hook**: `useCreateTodoMutation()` in `src/generated/fnb-graphql-api.ts`
- **Variables**: `name: String!`, `description: String` (optional), `parentTodoId: UUID` (null for root)
- **Returns**: new todo `id`, `name`, `status`, `type`
- On success: call `navigateTo('/tenant/tools/todo/{id}')` with the new todo's id

## Composable

- **Source (to create)**: `packages/graphql-client-api/src/composables/useTodoList.ts`
- **Re-export (to create)**: `apps/tenant-app/app/composables/useTodoList.ts`

```ts
const { todos, fetching, error, search, createTodo, pinTodo, unpinTodo } = useTodoList()
```

| Export | Shape | Usage |
|---|---|---|
| `todos` | `Ref<TodoSummary[]>` | bound to list components; pre-sorted: pinned first |
| `fetching` | `Ref<boolean>` | loading state |
| `error` | `Ref<CombinedError \| undefined>` | error state |
| `search(searchTerm, isTemplate)` | `(string, boolean) => void` | updates variables ref; rootsOnly is always true |
| `createTodo(name, description?)` | `Promise<{ id: string }>` | executes CreateTodo mutation |
| `pinTodo(todoId)` | `Promise<void>` | executes PinTodo mutation, re-sorts list |
| `unpinTodo(todoId)` | `Promise<void>` | executes UnpinTodo mutation, re-sorts list |

The composable initializes with `{ rootsOnly: true, isTemplate: false }`.
The page watches `searchTerm` with a 300ms debounce and calls `search()` on change.
Toggling `showTemplates` calls `search(searchTerm, !showTemplates)` immediately (no debounce).
`todos` is sorted client-side: pinned todos first, then by `updatedAt` descending.

## Types
See `_shared.data.md` → Todo, TodoStatus, TodoType, TodoResident

`TodoSummary` is derived from `SearchTodosQuery['searchTodos']['nodes'][number]` — use the generated
GraphQL type directly rather than defining a separate interface.

## Decisions
- **Composable split**: two composables — `useTodoList` (index page) and `useTodoDetail` (detail page). See `[id].data.md`.
- **Pin/unpin**: exposed on `useTodoList`; the list page may add pin actions in a future iteration.
- **Search**: `watch` + 300ms debounce on `searchTerm`; `showTemplates` toggle fires immediately.
