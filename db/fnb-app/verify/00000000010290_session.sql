begin;

select id, profile_id, created_at, last_seen_at, revoked_at
from auth.session where false;

select 1/count(*) from pg_class
where relname = 'session'
  and relnamespace = 'auth'::regnamespace
  and relrowsecurity = true;

select 1/count(*) from pg_proc
where proname = 'create_session'
  and pronamespace = 'app_fn'::regnamespace;

select 1/count(*) from pg_proc
where proname = 'claims_for_session'
  and pronamespace = 'app_fn'::regnamespace;

select 1/count(*) from pg_proc
where proname = 'revoke_session'
  and pronamespace = 'app_fn'::regnamespace;

select 1/count(*) from pg_proc
where proname = 'revoke_my_sessions'
  and pronamespace = 'app_fn'::regnamespace;

select 1/count(*) from pg_proc
where proname = 'revoke_my_sessions'
  and pronamespace = 'app_api'::regnamespace;

rollback;
