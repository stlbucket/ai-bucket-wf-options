# Plan: `todo_fn.add_todo_assignee` accepts an unvalidated `_resident_urn`

> **Execution Directive:** Implement via the `fnb-stack-implementor` skill — invoke it on *this*
> plan file (`.claude/issues/identified/0640__security__todo-assignee-urn-validation____MED__.plan.md`).
> DB fix via `sqitch-expert` + `fnb-db-designer`. Gate is `pnpm build`. Never run `git` in a
> sqitch session; never redeploy the DB yourself — ask the user, then verify read-only.

**Severity: MED** · Workstream: WS2 (DB security) · Identified: 2026-07-30 (recurring 0030 RLS sweep)

## Details

The multi-assignee refactor (`db/fnb-todo/deploy/00000000010495_todo_assignee_fn.sql`, landed
since 2026-07-23) added `todo_api.add_todo_assignee(_todo_id, _resident_urn)` →
`todo_fn.add_todo_assignee(_todo_id, _resident_urn, _resident_id)`. The `_api` layer gates on
`jwt.has_permission('p:todo')` and the todo lookup is RLS-fenced (cross-tenant `_todo_id`
raises `30030: NO TODO FOR ID`), but **`_resident_urn` is inserted verbatim** into
`todo.todo_assignee.resident_urn` with no validation beyond the FK to `res.resource(urn)`:

- It is **not checked to be a `resident`-type resource** — any registered URN passes the FK
  (a todo's URN, a tenant's URN, an asset's URN can be "assigned" a todo).
- It is **not checked to be in the caller's tenant** — a member of tenant A with `p:todo` can
  attach tenant B's resident URN as an assignee (URNs are guessable/enumerable text). The
  `todo_assignee` RLS WITH CHECK only fences the row's `tenant_id` (taken from the todo), not
  the referenced URN.

Related, not duplicated: `0630__app_______resident-picker-tenant-pin______MED__.plan.md` fixes
the UI picker leak (memory `residentslist-not-tenant-scoped`); this item is the DB-level
defense-in-depth so a direct GraphQL call can't bypass the fixed picker.

## Implication

Cross-tenant data pollution and information leak by construction: foreign-resident URNs become
readable to every member of the assigning tenant via the `resourceByResidentUrn { resident
{ displayName } }` relation on the assignee row (the assignee list resolves display names).
Assignment lists also become semantically corrupt (non-resident URNs). No cross-tenant *read*
of todos is possible — impact is bounded to reference integrity + name disclosure — hence MED.

## Suggested fix

One sqitch change in `db/fnb-todo` (rework or follow-on to `00000000010495_todo_assignee_fn`):

1. In `todo_fn.add_todo_assignee`, resolve the URN before insert:
   ```sql
   select r.* into _resource from res.resource r
   where r.urn = _resident_urn
     and r.resource_type = 'resident'
     and r.tenant_id = _todo.tenant_id
     and r.archived_at is null;
   if _resource.id is null then
     raise exception '30032: NOT A RESIDENT IN THIS TENANT';
   end if;
   ```
   (columns verified against `db/fnb-res/deploy/00000000011000_res.sql`; confirm the
   `resource_type` value the resident registration writes — `app.resident` registers via
   `res_fn.register_resource` — and keep the error-code series consistent with `30030`/`30031`.)
2. Mirror the pgTAP coverage: extend `db/fnb-todo/test/030-fn-behaviour.sql` with a
   cross-tenant URN case and a non-resident URN case (both must raise).

## Verification

- pgTAP: new `throws_ok` cases green (`pg_prove` over `db/fnb-todo/test/`).
- Read-only GraphQL check after the user redeploys: `addTodoAssignee` with a same-tenant
  resident URN succeeds; with a foreign or non-resident URN returns the new exception.
- `pnpm build` unaffected (SQL-only change).
