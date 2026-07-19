begin;

select 1/count(*) from pg_proc
where proname = 'profile_claims_for_user'
  and pronamespace = 'app_fn'::regnamespace;

select 1/count(*) from pg_proc
where proname = 'site_user_by_id'
  and pronamespace = 'app_fn'::regnamespace;

-- Negative checks: divide by zero when the dropped objects still exist.
-- (1/((count=0)::int), NOT `case ... then 1/0` — postgres constant-folds 1/0 at plan time.)
select 1/((count(*) = 0)::int)
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'auth' and c.relname in ('user', 'identities');

select 1/((count(*) = 0)::int) from pg_proc
where proname = 'login_user' and pronamespace = 'auth'::regnamespace;

select 1/((count(*) = 0)::int) from pg_proc
where proname = 'handle_new_user' and pronamespace = 'app_fn'::regnamespace;

rollback;
