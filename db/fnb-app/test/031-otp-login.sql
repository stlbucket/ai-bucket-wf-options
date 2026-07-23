-- OTP login surface (db/fnb-app/…010295_otp_login.sql): schema shape + session auth_method.
-- Behavioral OTP-flow tests (deep_link → code → verify → residency activation) need the notify +
-- tenant/resident fixtures and are exercised end-to-end in the plan's Phase 5. Spec:
-- .claude/specs/otp-login/. Run as owner (SECURITY DEFINER pre-claims fns).
\set prof '44444444-4444-4444-4444-444444444444'

begin;
set search_path to tap, public;
select plan(9);

-- schema shape
select has_table('auth', 'deep_link', 'auth.deep_link exists');
select has_table('auth', 'otp_login', 'auth.otp_login exists');
select has_column('auth', 'session', 'auth_method', 'auth.session has auth_method');
select has_function('app_fn', 'get_deep_link', array['uuid'], 'app_fn.get_deep_link(uuid) exists');
select has_function('app_fn', 'request_otp_login', array['uuid', 'text'], 'app_fn.request_otp_login(uuid,text) exists');
select has_function('app_fn', 'verify_otp_login', array['uuid', 'text'], 'app_fn.verify_otp_login(uuid,text) exists');
select has_function('app_api', 'create_deep_link', array['text', 'text'], 'app_api.create_deep_link exists');

-- auth_method behavior
insert into app.profile (id, email) values (:'prof'::uuid, 'otp@test.local');

select app_fn.create_session(:'prof'::uuid, 'otp') as osid \gset
select is((select auth_method from auth.session where id = :'osid'::uuid), 'otp',
  'create_session(_, ''otp'') stamps auth_method = otp');

select app_fn.create_session(:'prof'::uuid) as zsid \gset
select is((select auth_method from auth.session where id = :'zsid'::uuid), 'zitadel',
  'create_session default auth_method = zitadel');

rollback;
