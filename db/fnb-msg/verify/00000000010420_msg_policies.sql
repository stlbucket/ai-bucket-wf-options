select 1/count(*) from pg_policies where schemaname = 'msg' and tablename = 'topic' and policyname = 'view_all_for_tenant';
select 1/count(*) from pg_policies where schemaname = 'msg' and tablename = 'subscriber' and policyname = 'view_all_for_tenant';
select 1/count(*) from pg_policies where schemaname = 'msg' and tablename = 'message' and policyname = 'view_all_for_tenant';
