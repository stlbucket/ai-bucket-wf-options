-- Verify fnb-notify:00000000011300_notify_prefs_policies on pg

select 1/count(*) from pg_policies
  where schemaname = 'notify' and tablename = 'channel_preference' and policyname = 'channel_pref_self';

-- phone_verification: RLS enabled with NO policy (deny-all to clients)
select case when relrowsecurity then 1 else 1/0 end
  from pg_class where oid = 'notify.phone_verification'::regclass;
select case when count(*) = 0 then 1 else 1/0 end
  from pg_policies where schemaname = 'notify' and tablename = 'phone_verification';

select case when pg_catalog.has_schema_privilege('authenticated', 'notify_fn', 'usage') then 1 else 1/0 end;
select pg_catalog.has_function_privilege('n8n_worker', 'notify_fn.request_phone_verification(uuid, citext)', 'execute');
