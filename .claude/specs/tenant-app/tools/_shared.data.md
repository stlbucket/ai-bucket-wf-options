# tools — Shared Data Types & Permissions (Todo)

> **URN-registry migration (2026-07-10):** the `<module>_tenant`/`<module>_resident` mirror
> tables, `ensure_<module>_resident`, and the `handle_update_profile` triggers described below
> are **removed**. Resident references are now URN columns (`posted_by_resident_urn`,
> `resident_urn` — `text REFERENCES res.resource(urn)`); `tenant_id` FKs point at
> `app.tenant(id)`; display names resolve via `resourceBy…Urn { resident { displayName } }`;
> the resident picker is the shared `residentsList` query (`ActiveTenantResidents`). Registered
> tables carry a generated `urn` column. Authoritative contract: `.claude/specs/urn-registry/`
> (`_shared.data.md` §5–§6). Mirror-table details below are historical.


Referenced by all `tools/todo/*.data.md` files.

## Status
Implemented — GraphQL (status trued up 2026-07-19 by the recurring spec/code reconciliation; no [FILL IN] markers remained and the pages/composables exist as specified).

## Navigation
```sql
Module: 'Tools' / key: 'tools' / icon: i-lucide-message-square / ordinal: 40
  row('todo'::citext, 'Todo'::citext,
      '{"p:app-user","p:app-admin"}'::citext[],
      'i-lucide-tool-case'::citext, '/tenant/tools/todo', 0)::app_fn.tool_info
```
Already installed in `db/fnb-app/deploy/00000000010240_app_fn.sql` (line 356).

## Permission Model
| Action | Required |
|---|---|
| View & manage todos | `p:app-user` or `p:app-admin` |
| Create / edit / delete todos | `p:todo` (granted to `p:app-user` and above) |
| Manage templates | `p:todo` |
| Admin actions (assign, pin) | `p:todo` |

`p:todo` is checked at the DB layer via `jwt.has_permission('p:todo')` inside `todo_api.*` functions.
`p:todo` is included in `p:app-user`, `p:app-admin`, and all higher license types.
RLS on `todo.todo` scopes all queries to the current tenant.

## Data Model

### `todo.todo_status` enum
| Value | Meaning |
|---|---|
| `incomplete` | Active, not yet done |
| `complete` | All subtasks (if any) finished |
| `archived` | Explicitly archived, no longer active |
| `unfinished` | Started but abandoned |

### `todo.todo_type` enum
| Value | Meaning |
|---|---|
| `task` | Leaf node — no children |
| `milestone` | Has one or more child todos; type is set automatically by DB |

### `todo.todo` table
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| parentTodoId | uuid | null = root todo |
| rootTodoId | uuid | always set; equals id for root todos |
| tenantId | uuid | FK, RLS |
| residentId | uuid | nullable — assigned resident |
| locationId | uuid | nullable — linked location |
| topicId | uuid | auto-created msg topic |
| name | citext | min 3 chars |
| description | citext | nullable |
| status | TodoStatus | default 'incomplete' |
| type | TodoType | default 'task'; DB sets to 'milestone' when children added |
| ordinal | integer | display order among siblings |
| pinned | boolean | default false |
| tags | citext[] | default '{}' |
| isTemplate | boolean | default false |
| createdAt / updatedAt | timestamptz | |

### `todo.todo_tenant`
Mirrors `app.tenant` for RLS scoping. Auto-provisioned by `todo_fn.ensure_todo_resident()`.

### `todo.todo_resident`
Mirrors `app.resident` for display names. Auto-provisioned by `todo_fn.ensure_todo_resident()`.

## GraphQL Types (PostGraphile auto-generated)

| GraphQL Type | Source |
|---|---|
| `Todo` | `todo.todo` table |
| `TodoResident` | `todo.todo_resident` table |
| `TodoTenant` | `todo.todo_tenant` table |
| `TodoStatus` | `todo.todo_status` enum |
| `TodoType` | `todo.todo_type` enum |

TypeScript types exported from `packages/graphql-client-api/src/generated/fnb-graphql-api.ts`.
Fragment type `TodoFragment` comes from `Todo.graphql` fragment.

## GraphQL Client Setup

- urql plugin: `apps/tenant-app/app/plugins/urql.ts`
  - `preferGetMethod: false`, exchanges: cacheExchange → mapExchange → fetchExchange
- Composable source: `packages/graphql-client-api/src/composables/useTodos.ts` (to be created)
- Tenant-app re-export: `apps/tenant-app/app/composables/useTodos.ts` (to be created)

## GraphQL Files (`packages/graphql-client-api/src/graphql/todo/`)

All files already exist and are codegen'd into `api.ts`.

### Fragment
- `fragment/Todo.graphql` — core todo fields (id, name, description, type, status, dates, parentTodoId, rootTodoId, isTemplate, topicId)

### Queries
- `query/searchTodos.graphql` → `useSearchTodosQuery()` hook
  - Variables: `searchTerm`, `todoType`, `rootsOnly`, `isTemplate`
  - Returns: nodes with Todo fragment + resident displayName + parentTodo + tenant name
- `query/todoById.graphql` → `useTodoByIdQuery()` hook
  - Variables: `id: UUID!`
  - Returns: todo with location, owner (resident), and children 4 levels deep (each with location + owner)
- `query/todoByIdForRefresh.graphql` → `useTodoByIdForRefreshQuery()` hook
  - Lightweight: id + status only, 12 levels of parentTodo chain (for status rollup after update)

### Mutations
- `mutation/createTodo.graphql` → `useCreateTodoMutation()`
  - Variables: `name`, `description`, `parentTodoId`
  - Returns: new todo id, name, status, type, dates
- `mutation/updateTodo.graphql` → `useUpdateTodoMutation()`
  - Variables: `todoId`, `name`, `description`
- `mutation/updateTodoStatus.graphql` → `useUpdateTodoStatusMutation()`
  - Variables: `todoId`, `status: TodoStatus!`
  - Returns: status + 12 levels of parentTodo status (for cascading UI updates)
- `mutation/deleteTodo.graphql` → `useDeleteTodoMutation()`
  - Variables: `todoId`; recursively deletes children at DB layer
- `mutation/makeTemplateFromTodo.graphql` → `useMakeTemplateFromTodoMutation()`
  - Variables: `todoId`; deep-copies todo tree with isTemplate=true; returns new todo id
- `mutation/makeTodoFromTemplate.graphql` → `useMakeTodoFromTemplateMutation()`
  - Variables: `todoId`; deep-copies template tree with isTemplate=false; returns new todo id
- `query/assignTodo.graphql` → `useAssignTodoMutation()`
  - Variables: `todoId`, `residentId`; returns updated todo with owner
- `mutation/pinTodo.graphql` → `usePinTodoMutation()` ⚠️ **does not exist yet — create before implementing pin**
- `mutation/unpinTodo.graphql` → `useUnpinTodoMutation()` ⚠️ **does not exist yet — create before implementing pin**

## DB Functions (`todo_api` → `todo_fn` two-layer pattern)
Sqitch file: `db/fnb-todo/deploy/00000000010470_todo_fn.sql`

| todo_api function | What it does |
|---|---|
| `create_todo(name, options)` | Provisions todo_resident, creates msg topic, inserts todo; sets parent type to 'milestone' |
| `update_todo(todo_id, name, description)` | Updates name/description |
| `update_todo_status(todo_id, status)` | Updates status; cascades up to parent when all children complete |
| `delete_todo(todo_id)` | Recursively deletes all children then parent; resets parent type to 'task' if last child |
| `pin_todo(todo_id)` | Sets pinned=true |
| `unpin_todo(todo_id)` | Sets pinned=false |
| `assign_todo(todo_id, resident_id)` | Sets resident_id |
| `search_todos(options)` | Filtered query: searchTerm, type, status, rootsOnly, isTemplate |
| `make_template_from_todo(todo_id)` | Deep copies tree with isTemplate=true |
| `make_todo_from_template(todo_id)` | Deep copies template tree with isTemplate=false |
