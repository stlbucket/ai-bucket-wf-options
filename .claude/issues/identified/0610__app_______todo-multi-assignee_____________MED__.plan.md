# Plan: Todo multi-assignee — `todo.todo_assignee` replaces `todo.todo.resident_urn`

> **Execution Directive:** Implement this plan via `/fnb-stack-implementor <this-file>`.
> The authoritative spec is `.claude/specs/tenant-app/tools/todo/` (README + `_shared.data.md`
> + the four page files, multi-assignee sections dated 2026-07-28) — this plan sequences it and
> records planning-time corrections; it does not restate the spec (R21). Specialist skills:
> `sqitch-expert` (Phase 1 mechanics), `fnb-db-designer` (RLS/grants dialect),
> `postgraphile-5-expert` (relation naming, Phase 3), `pgtap-expert` (Phase 1 tests).
> Never run `git` in a sqitch session; never rebuild/restart the env yourself — ask the user,
> then verify read-only.

**Severity: MED** (feature refactor) · Category: app · Planned: 2026-07-28
· Spec status: Draft (multi-assignee sections), no `[FILL IN]`s; all decisions locked in the README.

## Context

Todos currently hold a single `resident_urn` slot that conflates creator (set by `create_todo`)
with assignee (overwritten by `assign_todo`; un-assignment impossible — non-null arg). The spec
replaces it with the zero-to-many `todo.todo_assignee` join table (provenance column included),
idempotent `add_todo_assignee`/`remove_todo_assignee` (`p:todo`-gated), an
`assigned_to_resident_urn` search filter + "Assigned to me" toggle, and a multi-assignee chip UI.
All ten locked decisions + the assignment-table convention live in the spec README.

## Planning-time corrections & findings (verified 2026-07-28)

1. **`search_todos_options` lives in `deploy/00000000010450_todo.sql:19`**, not
   `00000000010460_todo_fn_types` as `_shared.data.md` guessed (that change holds only
   `create_todo_options`). No sqitch rework needed anywhere: `fnb-todo` has **no tags** (rework
   requires one), so the refactor ships as **new changes** using
   `alter type todo_fn.search_todos_options add attribute …` + `create or replace function` —
   original changes untouched. Fix the `_shared.data.md` mention during Phase 5 truing.
2. **PostGraphile relation names must be verified post-deploy, before fragments are finalized**
   (PgSimplifyInflection + the `res.resource` double-FK): on `Todo` the child relation is
   expected as `todoAssigneesList`; on `TodoAssignee`, `resident_urn` + `assigned_by_resident_urn`
   are TWO FKs to `res.resource`, so fields disambiguate as `resourceByResidentUrn` /
   `resourceByAssignedByResidentUrn` (cf. issue `0345__graphql___resource-relation-name-clash`).
   Check GraphiQL or the regenerated `src/generated/fnb-graphql-api.ts` first; codegen errors
   loudly if a fragment guesses wrong.
3. **`TodoList.vue` / `TodoListSmall.vue` have no assignee cell today** — `index.ui.md` specced
   one pre-refactor but it was never implemented (verified: zero `resident`/`owner` refs in
   either component). Phase 4's list-page work is **additive**, not a modification.
4. **The `tools/`-level `_shared.data.md`** (`.claude/specs/tenant-app/tools/_shared.data.md`)
   is the file the page specs historically referenced; it still documents `resident_urn`, the
   retired mirror tables, and `assignTodo`. Phase 5 banners it to defer to
   `tools/todo/_shared.data.md` (created 2026-07-28) for the todo schema/API contract.
5. **Issue `0550__specs_____todo-spec-readme-missing________LOW__` is satisfied** by the README
   created in the 2026-07-28 spec session — flag to the user at completion (move only with
   sign-off; R23).
6. **Grants ride the defaults**: `00000000010480_todo_policies.sql` sets
   `alter default privileges in schema todo grant all on tables …`, so the new table needs no
   explicit grant statements — only `enable row level security` + the policy.
7. No new npm dependencies anywhere — R24/catalog untouched. `pnpm build` is the gate
   (repo-wide lint known-broken); DB tests run via `pnpm db-test` (`scripts/db-test.ts`).

## Implementation phases

### Phase 1 — DB (`db/fnb-todo`): two new sqitch changes

**`00000000010490_todo_assignee`** — plan entry
`[00000000010480_todo_policies fnb-res:00000000011000_res]`:
- `todo.todo_assignee` exactly per `_shared.data.md` §DB (v7 PK, `todo_id` cascade FK,
  `tenant_id`, `resident_urn` NOT NULL → `res.resource(urn)`, `assigned_by_resident_urn` NULL →
  `res.resource(urn)`, `created_at`, `uq_todo_assignee (todo_id, resident_urn)`), three indexes,
  `enable row level security` + `manage_all_for_tenant` (same shape as `todo.todo`'s at
  `00000000010480_todo_policies.sql:33`). Not URN-registered (locked decision).
- revert: drop table; verify: table + policy + unique constraint existence
  (sqitch-expert verify patterns).

**`00000000010495_todo_assignee_fn`** — plan entry `[00000000010490_todo_assignee]`:
- `alter type todo_fn.search_todos_options add attribute assigned_to_resident_urn text;`
- `create or replace todo_fn.search_todos` (+ its `_api` passthrough only if its signature
  changes — it doesn't) with the EXISTS predicate from `_shared.data.md`.
- `create or replace todo_fn.create_todo` — remove `resident_urn` from the INSERT column/value
  lists (`00000000010470_todo_fn.sql:108,121`); everything else byte-identical.
- New `todo_api.add_todo_assignee(_todo_id, _resident_urn)` →
  `todo_fn.add_todo_assignee(_todo_id, _resident_urn, _resident_id)` and
  `todo_api.remove_todo_assignee` → `todo_fn.remove_todo_assignee` — gates, idempotency,
  template guard, provenance resolution per `_shared.data.md` §API. (`_api` gate style: the
  explicit `if jwt.has_permission('p:todo') = false then raise '30000…'` form `create_todo`
  uses at `00000000010470_todo_fn.sql:21`.)
- `drop function todo_api.assign_todo(uuid, text); drop function todo_fn.assign_todo(uuid, text);`
- Data migration (INSERT…SELECT from `_shared.data.md` §Migration), then
  `drop index todo.idx_todo_todo_resident_urn;` + `alter table todo.todo drop column resident_urn;`
- revert: reverse order — re-add column + index, best-effort reverse migration (first assignee
  per todo by `created_at`), restore old fn bodies (copy from `00000000010470_todo_fn.sql`),
  re-create `assign_todo`, drop new fns, drop the type attribute.

**pgTAP** (`db/fnb-todo/test/`, run `pnpm db-test`): extend `010-rls.sql` (todo_assignee tenant
isolation — cross-tenant insert fails WITH CHECK, cross-tenant read is empty), `020-api-permissions.sql`
(`p:todo` gate on add/remove; `throws_ok` '30000'), `030-fn-behaviour.sql` (idempotent re-add
keeps original row; remove idempotent; template guard raises; delete_todo cascades assignee rows;
`deep_copy_todo` output has zero assignees; `search_todos` filter matches only assigned todos;
`create_todo` writes no assignee row).

### ⏸ USER GATE — deploy + restart
New sqitch changes land via `pnpm db-deploy` (incremental — no wipe needed), and graphql-api-app
must restart to serve the new schema before codegen. **Ask the user to run the deploy + restart**;
then verify read-only in GraphiQL: `todoAssigneesList` on `Todo`, `addTodoAssignee` /
`removeTodoAssignee` mutations present, `assignTodo` gone, exact relation-field names recorded
(finding 2).

### Phase 2 — graphql-client-api + fnb-types (`packages/`)

- `fragment/Todo.graphql`: drop `residentUrn`. `todoById.graphql`: replace all four
  `owner: resourceByResidentUrn { resident { id displayName } }` levels with the `assignees:`
  selection (`_shared.data.md` §GraphQL); same swap for `residentResource:` in
  `searchTodos.graphql` (+ new `$assignedToResidentUrn: String` variable wired into `_options`).
- New `mutation/addTodoAssignee.graphql` + `mutation/removeTodoAssignee.graphql`; **delete**
  the misfiled `query/assignTodo.graphql`.
- Codegen: `pnpm -F @function-bucket/fnb-graphql-client-api generate` (PostGraphile must be
  up — post-gate).
- `packages/fnb-types/src/todo.ts`: `Todo` drops `residentUrn`; add `TodoAssignee` per spec.
- `src/mappers/todo.ts`: `toTodo` drops `residentUrn`; `toTodoNode` maps
  `assignees: TodoAssigneeView[]` (replaces `owner`); `RawTodoNode` updated.
- `src/composables/useTodoDetail.ts`: `TodoOwner` → exported `TodoAssigneeView` (R4);
  `assignResident` → `addAssignee(urn)` / `removeAssignee(urn)` wrapping the new hooks; full
  `TodoById` reload after each (unchanged posture).
- `src/composables/useTodoList.ts`: `assignedToResidentUrn` in the `variables` ref
  (`useTodoList.ts:12`) + `filterAssignedTo(urn | null)` export.
- Barrels: composable files already exported — **verify** `packages/graphql-client-api/src/index.ts`
  + `packages/fnb-types/src/index.ts` still cover everything (the #1 miss).
- `pnpm -F @function-bucket/fnb-graphql-client-api build` clean.

### Phase 3 — tenant-app UI (`apps/tenant-app`)

- `components/todo/TodoDetailAssign.vue` rewrite per `[id].ui.md` §Assignees: chip group
  (initials avatar + displayName + `i-lucide-x` remove), `i-lucide-plus` → `UPopover` +
  `USelectMenu` excluding current assignees, emits `add-assignee` / `remove-assignee`; hidden
  when `isTemplate`. (Verify `i-lucide-plus` / `i-lucide-x` exist — UC11.)
- `TodoDetail.vue` / `TodoDetailSmall.vue`: pass `assignees` down, re-emit both events;
  `pages/tools/todo/[id].vue`: replace `handleAssignResident` (`[id].vue:83`) with
  add/remove handlers + toasts (UC7).
- `TodoList.vue` / `TodoListSmall.vue`: **add** the assignees cell (avatar group, first 3 +
  "+N", "—" empty) — additive per finding 3.
- `pages/tools/todo/index.vue`: `assignedToMe` ref + "Assigned to me" toggle button (hidden
  while `showTemplates`), resolving the caller's own resident urn client-side per
  `index.data.md`; wire to `filterAssignedTo`.
- Re-exports (`apps/tenant-app/app/composables/useTodo{Detail,List}.ts`) are `export *`-style
  one-liners — confirm they need no change.
- Routes already under tenant-app's wholesale `ssr: false` rules (UC14) — confirm, don't add.

### Phase 4 — gates + spec truing

- `pnpm build` (the gate) + `pnpm db-test` green.
- End-to-end read-only verify: detail page add/remove assignee round-trip, list page
  "Assigned to me" filter, template detail hides the assign UI, network tab shows
  `AddTodoAssignee`/`RemoveTodoAssignee` operations.
- Spec truing: flip the multi-assignee Draft statuses to Implemented in all five
  `tools/todo/` files + README (retro-check task boxes); fix the `00000000010460` →
  `00000000010450` mention (finding 1); banner `tools/_shared.data.md` to defer todo content
  to `tools/todo/_shared.data.md` (finding 4).

## Verification summary

- pgTAP: new assertions green under `pnpm db-test`.
- GraphiQL: `assignTodo` absent; new mutations present; `Todo.todoAssigneesList` resolves.
- `pnpm build` clean; no `residentUrn` references remain outside historical spec banners
  (`grep -rn residentUrn packages/ apps/` → only location/asset/game hits).
- UI round-trip per Phase 4.

## Completion

Ask the user (AskUserQuestion): move this plan to `addressed/`? Also surface finding 5
(`0550` todo-spec-readme-missing is now satisfied — move only with sign-off).
