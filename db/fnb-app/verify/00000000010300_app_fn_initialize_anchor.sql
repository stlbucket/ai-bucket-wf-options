-- Verify fnb-app:00000000010300_app_fn_initialize_anchor on pg

begin;

select 1/count(*) from pg_proc
where proname = 'anchor_exists'
  and pronamespace = 'app_fn'::regnamespace;

select 1/count(*) from pg_proc
where proname = 'initialize_anchor'
  and pronamespace = 'app_fn'::regnamespace;

-- both must be callable by the login role (pre-claims carve-out)
select has_function_privilege('authenticator', 'app_fn.anchor_exists()', 'execute');
select has_function_privilege(
  'authenticator',
  'app_fn.initialize_anchor(citext,citext,citext,citext,citext,citext)',
  'execute'
);

rollback;
