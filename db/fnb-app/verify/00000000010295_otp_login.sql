-- Verify fnb-app:00000000010295_otp_login on pg

begin;

-- table shapes
select id, subject_urn, subject_label, target_tenant_id,
       created_by_resident_id, expires_at, revoked_at, created_at
from auth.deep_link where false;

select id, deep_link_id, profile_id, channel, destination, code_hash,
       expires_at, attempts, consumed_at, created_at
from auth.otp_login where false;

-- RLS enabled (deny-all)
select 1/count(*) from pg_class
where relname = 'deep_link' and relnamespace = 'auth'::regnamespace and relrowsecurity = true;
select 1/count(*) from pg_class
where relname = 'otp_login' and relnamespace = 'auth'::regnamespace and relrowsecurity = true;

-- functions present
select 1/count(*) from pg_proc where proname = 'get_deep_link' and pronamespace = 'app_fn'::regnamespace;
select 1/count(*) from pg_proc where proname = 'request_otp_login' and pronamespace = 'app_fn'::regnamespace;
select 1/count(*) from pg_proc where proname = 'verify_otp_login' and pronamespace = 'app_fn'::regnamespace;
select 1/count(*) from pg_proc where proname = 'activate_profile_residency_in_tenant' and pronamespace = 'app_fn'::regnamespace;
select 1/count(*) from pg_proc where proname = 'session_info' and pronamespace = 'app_fn'::regnamespace;
select 1/count(*) from pg_proc where proname = 'resolve_tenant_recipient' and pronamespace = 'app_fn'::regnamespace;
select 1/count(*) from pg_proc where proname = 'create_deep_link' and pronamespace = 'app_fn'::regnamespace;
select 1/count(*) from pg_proc where proname = 'create_deep_link' and pronamespace = 'app_api'::regnamespace;
select 1/count(*) from pg_proc where proname = 'resolve_send_recipients' and pronamespace = 'app_fn'::regnamespace;

-- composite types present
select 1/count(*) from pg_type where typname = 'deep_link_public' and typnamespace = 'app_fn'::regnamespace;
select 1/count(*) from pg_type where typname = 'otp_login_dispatch' and typnamespace = 'app_fn'::regnamespace;
select 1/count(*) from pg_type where typname = 'otp_login_result' and typnamespace = 'app_fn'::regnamespace;

rollback;
