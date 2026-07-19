-- RLS enabled on all three tables
select 1/count(*) from pg_class where oid = 'storage.asset'::regclass            and relrowsecurity;

-- both policies present on storage.asset
select 1/count(*) from pg_policies where schemaname = 'storage' and tablename = 'asset' and policyname = 'manage_all_for_tenant';
select 1/count(*) from pg_policies where schemaname = 'storage' and tablename = 'asset' and policyname = 'manage_all_super_admin';

-- anon can execute the public read fn but NOT select the table
select 1/(case when has_function_privilege('anon', 'storage.public_asset(uuid)', 'execute') then 1 else 0 end);
select 1/(case when has_table_privilege('anon', 'storage.asset', 'select') then 0 else 1 end);
select 1/(case when has_table_privilege('authenticated', 'storage.asset', 'select') then 1 else 0 end);
