select 1/count(*) from pg_tables
where schemaname = 'poll' and tablename = 'poll' and rowsecurity = true;
select 1/count(*) from pg_policies
where schemaname = 'poll' and tablename = 'response' and policyname = 'own_response';
select 1/count(*) from pg_policies
where schemaname = 'poll' and tablename = 'poll' and policyname = 'read_poll';
