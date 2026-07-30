> **Execution Directive:** plan + build this spec via `/fnb-stack-implementor <this-README>` —
> the implementor derives the `.claude/issues/` plan file (R23) from the task list below,
> then executes it.

# tools/todo — Todo module

## Status
Base module **Implemented — GraphQL** (list + detail + templates + attachments + discussion).
**Multi-assignee refactor: Implemented 2026-07-30** (plan
`0610__app_______todo-multi-assignee`; sqitch changes `00000000010490_todo_assignee` +
`00000000010495_todo_assignee_fn` + `00000000010497_todo_deep_copy_fix` — the last fixes a
latent `deep_copy_todo` options-row arity bug the new pgTAP suite exposed; Make/Clone Template
had been broken at runtime). The task list below is retro-checked.

## Purpose
Tenant-scoped hierarchical todos (tasks/milestones, 4-level UI nesting, templates,
pin, location, attachments, discussion). This refactor replaces the single
`todo.todo.resident_urn` slot with a zero-to-many **`todo.todo_assignee`** join table, adds
un-assignment (impossible today — the old op was overwrite-only with a non-null urn), and an
assignee filter on search.

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| Table name | `todo.todo_assignee` (singular) | House convention — `todo.todo`, `app.resident`, `game.game_player` are all singular |
| Creator auto-assignment | **Start unassigned** — `create_todo` writes no assignee row | Cleanest zero-to-many semantics; the creator is preserved independently in `res.resource.created_by_resident_id` (user decision 2026-07-28) |
| API shape | Granular `add_todo_assignee` / `remove_todo_assignee`, both idempotent | Maps 1:1 to chip add/remove UI clicks (user decision 2026-07-28) |
| Add-assignee UI | **Multi-select** `USelectMenu` (in the `+` popover) seeded with current assignees; selection deltas fire one granular add/remove each; chips keep the `i-lucide-x` remove | User decision 2026-07-30 (replaces the single-pick popover); no API change — the granular mutations absorb multi-pick as a client-side diff |
| Copy/template semantics | Assignees **never** copy through `deep_copy_todo`; templates cannot hold assignees (guard in `add_todo_assignee`) | Least surprising; a template with assignees is meaningless (user decision 2026-07-28) |
| Assignee search filter | **In scope** — `assigned_to_resident_urn` in `search_todos_options` + "Assigned to me" toggle on the list page | The usual payoff of multi-assignee (user decision 2026-07-28) |
| Registry status | `todo_assignee` is **not** URN-registered | It is a relationship row, not a business object — no `urn` column, no `register_resource` |
| Deletion | `todo_id` FK is `on delete cascade` | `todo_fn.delete_todo` hard-deletes; assignee rows must follow |
| Permission gates | New `_api` functions check `jwt.has_permission('p:todo')` | Fixes the inconsistency where only `create_todo` gated (legacy mutations left as a Known Gap) |
| Data migration | Existing non-null `resident_urn` on non-template rows becomes an assignee row | Preserves what users currently see as "owner"; template values are dropped |
| Filter mechanics | Client passes an explicit `assigned_to_resident_urn`; "Assigned to me" resolves the caller's urn client-side | Keeps `_fn` free of `jwt.*` (house rule) and the filter general (filter by anyone later) |
| Provenance | **In scope** — `assigned_by_resident_urn` (nullable) + `created_at`-as-assigned-at; `_api` passes `jwt.resident_id()`, `_fn` resolves the urn; migration rows stay null | Cheap now, painful to backfill later; stored but not yet rendered (user decision 2026-07-28) |
| Cross-entity "assigned to me" | **Design for it now, build it later**: `todo_assignee` follows the assignment-table convention below; the feature itself ships as a future read-layer spec (union view or `res_api` search fn), not as storage | Locking the column signature now makes the future read layer mechanical; building a dashboard feature inside the todo spec would be scope creep (user decision 2026-07-28) |

### Assignment-table convention (for future modules and the future read layer)

Any module that grows assignees/watchers copies this exact signature, so a cross-entity
"everything assigned to me" read layer can be a mechanical `union all` (or `res_api` search
function) over the per-module tables:

```
<module>.<entity>_assignee (
  id uuid v7 pk
  ,<entity>_id uuid not null references <module>.<entity>(id) on delete cascade
  ,tenant_id uuid not null references app.tenant(id)          -- RLS key, manage_all_for_tenant
  ,resident_urn text not null references res.resource(urn)
  ,assigned_by_resident_urn text null references res.resource(urn)
  ,created_at timestamptz not null default current_timestamp  -- = assigned_at
  ,unique (<entity>_id, resident_urn)
)
```

The parent entity is URN-registered, so the subject urn (and its type, for grouping in a
dashboard) is join-derivable — assignee tables never store it redundantly. When a **second**
module adopts this, promote the convention to a `.claude/specs/` pattern file (R21) instead
of leaving it here.

## Files in this spec

| File | Covers |
|---|---|
| `README.md` | This index |
| `_shared.data.md` | Schema (todo + **todo_assignee**), permission model, API functions, migration, GraphQL/type contract |
| `index.ui.md` / `index.data.md` | List page — assignee column + "Assigned to me" toggle |
| `[id].ui.md` / `[id].data.md` | Detail page — multi-assignee display + add/remove |

## Implementation Task List — multi-assignee refactor

### Phase 1 — DB (`db/fnb-todo`, sqitch mechanics per `sqitch-expert`)
- [x] New change: `todo.todo_assignee` table (incl. `assigned_by_resident_urn` provenance) + indexes + RLS policy (contract in `_shared.data.md`)
- [x] Rework/change: `add_todo_assignee` + `remove_todo_assignee` (`_api` + `_fn`, `p:todo` gate, idempotent, template guard, provenance from `jwt.resident_id()`); drop `assign_todo`
- [x] Rework: `search_todos_options` + `assigned_to_resident_urn`; `search_todos` EXISTS predicate
- [x] Rework: `create_todo` stops writing `resident_urn`
- [x] Same change: data migration (non-template `resident_urn` → assignee rows), then drop `idx_todo_todo_resident_urn` + the column
- [x] pgTAP: `010-rls` (todo_assignee tenant isolation), `020-api-permissions` (`p:todo` gates), `030-fn-behaviour` (idempotent add/remove, template guard, cascade on delete, deep-copy carries no assignees, search filter)

### Phase 2 — GraphQL client (`packages/graphql-client-api`, `packages/fnb-types`)
- [x] Fragment `Todo`: drop `residentUrn`; `TodoById` (all 4 levels) + `SearchTodos`: `owner:`/`residentResource:` → `assignees: todoAssigneesList { … }`
- [x] New `mutation/addTodoAssignee.graphql` + `mutation/removeTodoAssignee.graphql`; delete misfiled `query/assignTodo.graphql`; re-run codegen
- [x] fnb-types: `Todo` drops `residentUrn`; add `TodoAssignee` (R3)
- [x] Mappers: `toTodo` / `toTodoNode` (owner → assignees)
- [x] `useTodoDetail`: `assignResident` → `addAssignee(urn)` / `removeAssignee(urn)`; `TodoNode.assignees: TodoAssigneeView[]`
- [x] `useTodoList`: `assignedToResidentUrn` variable + `filterAssignedTo(urn | null)`

### Phase 3 — UI (`apps/tenant-app`)
- [x] `TodoDetailAssign.vue` rewrite: avatar-group + chips with remove, `+` popover with a multi-select `USelectMenu` seeded with current assignees (2026-07-30 locked decision; `[id].ui.md`)
- [x] `TodoDetail` / `TodoDetailSmall`: pass `assignees`, re-emit `add-assignee` / `remove-assignee`; `[id].vue` wires the composable
- [x] `TodoList` / `TodoListSmall`: assignee cell → avatar group / "—"
- [x] `index.vue`: "Assigned to me" toggle (resolves own resident urn client-side)
- [x] `pnpm build` gate (repo-wide lint is known-broken)

### Phase 4 — Spec truing
- [x] Flip statuses in all five data/ui files + this README to Implemented; retro-check boxes

## Remaining Open Questions
- [ ] Should assignment emit a `fnb-notify` notification to the assignee? (Deferred — would
  ride the existing send-notification n8n workflow; nothing todo-related runs on n8n today.)

*Resolved 2026-07-28: provenance is in scope (locked decision above). The cross-entity
"assigned to me" feature is confirmed future work — it gets its own spec (read layer over the
assignment-table convention) when scheduled; nothing further in this refactor.*

## Known Gaps (pre-existing, out of scope)
- Legacy `todo_api` mutations (`update_todo`, `delete_todo`, `pin_todo`, …) have no `p:todo`
  gate — RLS tenant scoping is the only guard. Only the new assignee functions add the gate.

## Considered & rejected
- **Keep a creator/owner column on `todo.todo`** — redundant; `res.resource.created_by_resident_id` already records it.
- **Auto-assign the creator on create** — recreates today's conflation of creator and assignee.
- **`set_assignees(urn[])` as the only API** — whole-list writes for single-chip clicks; granular add/remove matches the UI. A set-based wrapper can be added later if bulk edit appears.
- **Copy assignees todo→todo in `deep_copy_todo`** — surprising, and the template path must strip them anyway.
- **URN-registering `todo_assignee`** — it is not a business object; registry rows would be noise.
- **A generic `res.edge` table** (`subject_urn` / descriptor like `'assigned'` / `object_urn`)
  **instead of module-local assignee tables** (considered 2026-07-28) — rejected because:
  (a) honest RLS is impossible at the registry level — edge visibility must follow the subject's
  per-module posture (todo is tenant-wide, game state is deny-all), so `fnb-res` policies would
  dispatch on module semantics and every new module would edit `fnb-res` (deploy-order/dependency
  inversion: `fnb-res` deploys before its consumers); (b) integrity degrades to convention — "must
  point at a resident", "cascade with the todo", "no assignees on templates" aren't declarable on a
  generic table; (c) no FK to `todo.todo` means PostGraphile can't build the typed nested
  `assignees` relation — stringly-typed client filtering; (d) edge kinds grow attributes and the
  table sprouts a `jsonb props` column (EAV). House precedent: polymorphic references are owned by
  the *consuming* module (`msg.topic.subject_urn`), never by `res`. The edge table's one real
  benefit — cross-entity "assigned to me" — is captured instead by the assignment-table convention
  + a future read-layer spec.
