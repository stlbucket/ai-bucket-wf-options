select 1/count(*) from pg_type t
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'todo_fn' and t.typname = 'create_todo_options';
