-- Server-side session lifecycle (db/fnb-app/…010290_session.sql): create_session, revoke_session,
-- revoke_my_sessions, and claims_for_session's fail-closed cases (revoked / unknown → null).
-- Spec: .claude/specs/db-testing/fn-behaviour-tests.md. Run as owner (SECURITY DEFINER pre-claims fns).
\set prof '33333333-3333-3333-3333-333333333333'

begin;
set search_path to tap, public;
select plan(8);

insert into app.profile (id, email) values (:'prof'::uuid, 'sess@test.local');

select app_fn.create_session(:'prof'::uuid) as sid1 \gset
select app_fn.create_session(:'prof'::uuid) as sid2 \gset

-- (1) create_session inserts an active session row
select is(
  (select count(*)::int from auth.session where id = :'sid1'::uuid and revoked_at is null), 1,
  'create_session created an active session');
-- (2) two sessions now exist for the profile
select is((select count(*)::int from auth.session where profile_id = :'prof'::uuid), 2,
  'the profile has two sessions');

-- (3) revoke_session revokes exactly the target
select app_fn.revoke_session(:'sid1'::uuid);
select is((select revoked_at is not null from auth.session where id = :'sid1'::uuid), true,
  'revoke_session revoked session 1');
-- (4) ...and leaves the other active
select is((select revoked_at is null from auth.session where id = :'sid2'::uuid), true,
  'session 2 is still active');

-- (5) revoke_my_sessions revokes the remaining active one and returns the count
select is(app_fn.revoke_my_sessions(:'prof'::uuid), 1,
  'revoke_my_sessions revoked the 1 remaining active session');
-- (6) no active sessions remain
select is((select count(*)::int from auth.session where profile_id = :'prof'::uuid and revoked_at is null), 0,
  'no active sessions remain');

-- (7) claims_for_session fails closed for a revoked session
select is(app_fn.claims_for_session(:'sid1'::uuid), null,
  'claims_for_session returns null for a revoked session');
-- (8) ...and for an unknown session
select is(app_fn.claims_for_session(gen_random_uuid()), null,
  'claims_for_session returns null for an unknown session');

select * from finish();
rollback;
