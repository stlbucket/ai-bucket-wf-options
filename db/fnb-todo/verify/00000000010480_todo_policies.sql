select 1/count(*) from pg_tables
where schemaname = 'todo' and tablename = 'todo' and rowsecurity = true;
