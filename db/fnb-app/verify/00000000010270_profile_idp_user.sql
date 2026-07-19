begin;

select idp_user_id from app.profile where false;

select 1/count(*) from pg_proc
where proname = 'provision_idp_user'
  and pronamespace = 'app_fn'::regnamespace;

rollback;
