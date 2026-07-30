-----------------------------------------------
-- script  todo_assignee table (multi-assignee refactor)
-----------------------------------------------
-- Join table — NOT a URN-registered resource (no generated urn, no registry FK,
-- no register_resource call; it is a relationship row, not a business object).
create table todo.todo_assignee (
  id uuid not null default res_fn.uuid_generate_v7() primary key
  ,todo_id uuid not null references todo.todo(id) on delete cascade
  ,tenant_id uuid not null references app.tenant(id)
  ,resident_urn text not null references res.resource(urn)
  ,assigned_by_resident_urn text null references res.resource(urn)
  ,created_at timestamptz not null default current_timestamp
  ,constraint uq_todo_assignee unique (todo_id, resident_urn)
);
-----------------------------------------------
create index idx_todo_todo_assignee_todo_id on todo.todo_assignee(todo_id);
create index idx_todo_todo_assignee_resident_urn on todo.todo_assignee(resident_urn);
create index idx_todo_todo_assignee_tenant_id on todo.todo_assignee(tenant_id);
-----------------------------------------------
-- grants ride the schema default privileges set in 00000000010480_todo_policies
alter table todo.todo_assignee enable row level security;
CREATE POLICY manage_all_for_tenant ON todo.todo_assignee
  FOR ALL
  USING (jwt.tenant_id()::uuid = tenant_id)
  WITH CHECK (jwt.tenant_id()::uuid = tenant_id)
  ;
