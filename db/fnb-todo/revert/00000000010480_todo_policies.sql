drop policy if exists manage_all_for_tenant on todo.todo;
alter table todo.todo disable row level security;

revoke usage on schema todo_api from anon, authenticated, service_role;
revoke all on all tables in schema todo_api from anon, authenticated, service_role;
revoke all on all routines in schema todo_api from anon, authenticated, service_role;
revoke all on all sequences in schema todo_api from anon, authenticated, service_role;

revoke usage on schema todo_fn from anon, authenticated, service_role;
revoke all on all tables in schema todo_fn from anon, authenticated, service_role;
revoke all on all routines in schema todo_fn from anon, authenticated, service_role;
revoke all on all sequences in schema todo_fn from anon, authenticated, service_role;

revoke usage on schema todo from anon, authenticated, service_role;
revoke all on all tables in schema todo from anon, authenticated, service_role;
revoke all on all routines in schema todo from anon, authenticated, service_role;
revoke all on all sequences in schema todo from anon, authenticated, service_role;
