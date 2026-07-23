-- notify channel preferences (D12) + phone verification (D13):
--  * channel_pref_self RLS — a user sees only their own preference rows
--  * set_channel_preference upsert, and the D13 gate (enabling sms unverified raises)
--  * the phone-verification round-trip (wrong code fails + increments; correct code verifies,
--    marks the sms preference verified, mirrors the number to app.profile.phone) and then sms enables
-- Runs each mutation as the authenticated caller (test._login sets the jwt claims); RLS-scoped
-- assertions are read back as the (superuser) test role to stay independent of app.profile RLS.
\set t_a  '11111111-1111-1111-1111-111111111111'
\set p1   '33333333-3333-3333-3333-333333333333'
\set p2   '44444444-4444-4444-4444-444444444444'

begin;
set search_path to tap, public;
select plan(9);

select test._seed_tenant(:'t_a'::uuid, 'tenant-a');
insert into app.profile (id, email) values
  (:'p1'::uuid, 'prefs-p1@example.com'),
  (:'p2'::uuid, 'prefs-p2@example.com')
on conflict (id) do nothing;

-- (1) RLS enabled on channel_preference
select is(
  (select relrowsecurity from pg_class where oid = 'notify.channel_preference'::regclass),
  true, 'RLS enabled on notify.channel_preference');

-- p1 enables email (implicitly verified)
select test._login(:'p1'::uuid, :'t_a'::uuid, array['p:app-user']);
select lives_ok(
  $$ select notify_api.set_channel_preference('email', true) $$,
  'p1 can enable the email channel');

-- (2) enabling sms without a verified phone is rejected (D13)
select throws_ok(
  $$ select notify_api.set_channel_preference('sms', true) $$,
  'sms channel requires a verified phone',
  'enabling sms is blocked while the phone is unverified');

-- seed a known OTP for p1 (bcrypt-hashed, unconsumed) — stands in for request_phone_verification
select test._logout();
insert into notify.phone_verification (profile_id, phone, code_hash, expires_at)
values (:'p1'::uuid, '+15551230000', crypt('123456', gen_salt('bf')), current_timestamp + interval '10 minutes');

-- (3) a wrong code does not verify
select test._login(:'p1'::uuid, :'t_a'::uuid, array['p:app-user']);
select is(
  (notify_api.verify_phone_code('+15551230000', '000000'))->>'verified',
  'false', 'a wrong code is rejected');

-- (4) the correct code verifies
select is(
  (notify_api.verify_phone_code('+15551230000', '123456'))->>'verified',
  'true', 'the correct code verifies the phone');

-- read back the effects as the test (superuser) role, RLS-independent
select test._logout();
-- (5) the sms preference is now marked verified
select isnt(
  (select verified_at from notify.channel_preference where profile_id = :'p1'::uuid and channel = 'sms'),
  null, 'sms preference verified_at is set after verification');
-- (6) the number is mirrored onto app.profile.phone (F6)
select is(
  (select phone::text from app.profile where id = :'p1'::uuid),
  '+15551230000', 'verified phone mirrored to app.profile.phone');

-- (7) sms can now be enabled
select test._login(:'p1'::uuid, :'t_a'::uuid, array['p:app-user']);
select lives_ok(
  $$ select notify_api.set_channel_preference('sms', true) $$,
  'sms can be enabled once the phone is verified');

-- (8) RLS: p2 cannot see p1's preferences
select test._login(:'p2'::uuid, :'t_a'::uuid, array['p:app-user']);
select is_empty(
  format($$ select 1 from notify.channel_preference where profile_id = %L $$, :'p1'),
  'a different user cannot see p1''s preferences');

select * from finish();
rollback;
