# tools/todo — Shared Data Contract

## Status
Draft (multi-assignee refactor, 2026-07-28) — the base module is Implemented; the
**multi-assignee** sections below describe the target contract, not the deployed schema.
The deployed schema still has `todo.todo.resident_urn`. No `[FILL IN]` markers remain.

> This file was created as part of the multi-assignee refactor (see `README.md`) — the
> module predates the `_shared.data.md` requirement and page specs already referenced it.

## Permission model

| Concern | Gate |
|---|---|
| Page access | `p:app-user` or `p:app-admin` (nav tool entry) |
| Mutations (`todo_api.*`) | `jwt.has_permission('p:todo')` — today only `create_todo` checks; the new `add_todo_assignee` / `remove_todo_assignee` **must** check (Known Gap: the other legacy mutations rely on RLS alone) |
| Row visibility | RLS `manage_all_for_tenant` — `jwt.tenant_id() = tenant_id` on `todo.todo` **and** `todo.todo_assignee` (R9) |

## Enums

- `todo.todo_status`: `incomplete · complete · archived · unfinished` (GraphQL/fnb-types: UPPERCASE)
- `todo.todo_type`: `task · milestone`

## DB schema

### `todo.todo` (changed)

As deployed (`db/fnb-todo/deploy/00000000010450_todo.sql`) **minus `resident_urn`**:

- The `resident_urn text null references res.resource(urn)` column and
  `idx_todo_todo_resident_urn` are **dropped** — assignment moves to `todo.todo_assignee`.
- The creator is *not* lost: `res.resource.created_by_resident_id` is written by
  `res_fn.register_resource(...)` in `todo_fn.create_todo` and remains the creator record.
- Everything else (hierarchy columns, generated `urn`, deferred registry FK, RLS policy)
  is unchanged.

### `todo.todo_assignee` (new)

Join table — **not** a URN-registered resource (no generated `urn`, no registry FK, no
`register_resource` call; it is a relationship, not a business object).

```sql
create table todo.todo_assignee (
  id uuid not null default res_fn.uuid_generate_v7() primary key   -- new-table convention (v7)
  ,todo_id uuid not null references todo.todo(id) on delete cascade
  ,tenant_id uuid not null references app.tenant(id)               -- RLS key
  ,resident_urn text not null references res.resource(urn)
  ,assigned_by_resident_urn text null references res.resource(urn) -- provenance; null = pre-refactor migration row
  ,created_at timestamptz not null default current_timestamp       -- doubles as assigned_at
  ,constraint uq_todo_assignee unique (todo_id, resident_urn)
);
create index idx_todo_todo_assignee_todo_id on todo.todo_assignee(todo_id);
create index idx_todo_todo_assignee_resident_urn on todo.todo_assignee(resident_urn);
create index idx_todo_todo_assignee_tenant_id on todo.todo_assignee(tenant_id);
```

- `on delete cascade` because `todo_fn.delete_todo` hard-deletes todos (bottom-up recursion) —
  assignee rows must not orphan or block.
- RLS (same tier as `todo.todo`):

```sql
alter table todo.todo_assignee enable row level security;
CREATE POLICY manage_all_for_tenant ON todo.todo_assignee
  FOR ALL
  USING (jwt.tenant_id()::uuid = tenant_id)
  WITH CHECK (jwt.tenant_id()::uuid = tenant_id);
```

- Schema-level grants are already in place for the `todo` schema
  (`00000000010480_todo_policies.sql` uses `grant all on all tables in schema todo` +
  default privileges) — no new grant statements needed for the table itself.

## API functions (`todo_api` → `todo_fn`, R8)

### Removed
- `todo_api.assign_todo(_todo_id, _resident_urn)` / `todo_fn.assign_todo(...)` — the
  single-slot overwrite. (It also never supported *un*assignment — `residentUrn` was
  non-null in the GraphQL op.)

### New

Both `_api` wrappers are `SECURITY INVOKER`, gate on `jwt.has_permission('p:todo')`
(raise `30000: PERMISSION DENIED`), and delegate; `_fn` bodies never call `jwt.*`.

```sql
todo_api.add_todo_assignee(_todo_id uuid, _resident_urn text) returns todo.todo_assignee
  -- delegates: todo_fn.add_todo_assignee(_todo_id, _resident_urn, jwt.resident_id())
  -- _fn: resolves the actor's urn from app.resident (same lookup create_todo does),
  --      insert ... on conflict (todo_id, resident_urn) do nothing; return the row
  --      (idempotent — re-adding an existing assignee is a no-op, not an error;
  --      the original assigned_by/created_at are kept on conflict).
  --      tenant_id is copied from the todo row; assigned_by_resident_urn = actor's urn.
  --      Guard: raise if the target todo is_template (templates carry no assignees).

todo_api.remove_todo_assignee(_todo_id uuid, _resident_urn text) returns boolean
  -- _fn: delete where todo_id/resident_urn match; returns true (idempotent).
```

### Changed
- `todo_fn.create_todo` — stop writing `resident_urn`. New todos start with **zero
  assignees** (locked decision; creator lives in the registry).
- `todo_fn.deep_copy_todo` — copies **never** carry assignees (locked decision); no code
  change needed beyond the column removal, but the pgTAP suite must assert it.
- `todo_fn.search_todos_options` — new field `assigned_to_resident_urn text`
  (composite-type change → sqitch rework of `00000000010460_todo_fn_types` + dependents;
  mechanics per `sqitch-expert`).
- `todo_fn.search_todos` — new predicate:

```sql
and (
  _options.assigned_to_resident_urn is null
  or exists (
    select 1 from todo.todo_assignee ta
    where ta.todo_id = t.id
      and ta.resident_urn = _options.assigned_to_resident_urn
  )
)
```

## Data migration (one-time, in the sqitch change that drops the column)

```sql
insert into todo.todo_assignee (todo_id, tenant_id, resident_urn)
select id, tenant_id, resident_urn
from todo.todo
where resident_urn is not null
  and is_template = false          -- templates never carry assignees
on conflict do nothing;
-- assigned_by_resident_urn stays null: the old column recorded no provenance
```

Then drop `idx_todo_todo_resident_urn` and the column. (Existing `resident_urn` values
conflated creator-at-insert with later reassignment; migrating them as assignees preserves
what users currently *see* as "owner".)

## GraphQL / client contract

- **Fragment `Todo`** (`graphql/todo/fragment/Todo.graphql`): remove `residentUrn`.
- **Assignee selection** (used at every level that previously selected
  `owner: resourceByResidentUrn { resident { id displayName } }` — `TodoById` ×4 nesting
  levels, `SearchTodos` nodes):

```graphql
assignees: todoAssigneesList {
  id
  residentUrn
  resourceByResidentUrn {
    resident { id displayName }
  }
}
```

- **Mutations**: `addTodoAssignee.graphql` + `removeTodoAssignee.graphql` in
  `graphql/todo/mutation/`. Delete `graphql/todo/query/assignTodo.graphql` (note: it was
  misfiled under `query/`).
- Re-run codegen after schema redeploy.

## Types (R3 / R4)

- **fnb-types `Todo`** (`packages/fnb-types/src/todo.ts`): remove `residentUrn`.
- **fnb-types `TodoAssignee`** (new):

```ts
export interface TodoAssignee {
  id: string
  todoId: string
  tenantId: string
  residentUrn: Urn
  assignedByResidentUrn: Urn | null // null on pre-refactor migration rows
  createdAt: Date
}
```

`assignedByResidentUrn`/`createdAt` are stored but **not selected** by the current UI
queries — add them to the `todoAssigneesList` selection when a "assigned by X on Y"
tooltip needs them; no page renders provenance in this phase.

- **Composable view type** (R4, in `useTodoDetail.ts` — replaces `TodoOwner`):

```ts
export interface TodoAssigneeView {
  residentUrn: string
  residentId: string
  displayName: string | null
}
// TodoNode: owner: TodoOwner | null  →  assignees: TodoAssigneeView[]
```

- **Mappers** (`src/mappers/todo.ts`): `toTodo` drops `residentUrn`; `toTodoNode` maps
  `assignees` instead of `owner`.

## Shared queries

- Resident picker: unchanged — the shared `residentsList` query (`ActiveTenantResidents`),
  already consumed by `useTodoDetail`.
