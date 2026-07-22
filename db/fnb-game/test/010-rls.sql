-- game.* RLS: game_type is public (view_all true); game/game_player/game_event are tenant-scoped
-- (p:app-user|p:app-admin); game_event is EXTRA-redacted — a PENDING event is visible only to its
-- own seat (no held-submission leak); game_event_state is DENY-ALL (RLS + revoke). Human seats
-- need a registered resident (resident_urn FK). Spec: .claude/specs/db-testing/rls-tests.md.
\set t_a     '11111111-1111-1111-1111-111111111111'
\set t_b     '22222222-2222-2222-2222-222222222222'
\set res_a   '55555555-5555-5555-5555-555555555555'
\set res_b2  '66666666-6666-6666-6666-666666666666'
\set g_id    'a0000000-0000-0000-0000-0000000000a1'
\set p1      'a0000000-0000-0000-0000-0000000000b1'
\set p2      'a0000000-0000-0000-0000-0000000000b2'
\set ev_app  'a0000000-0000-0000-0000-0000000000c1'
\set ev_pen  'a0000000-0000-0000-0000-0000000000c2'
\set prof_a  '33333333-3333-3333-3333-333333333333'
\set prof_b2 '44444444-4444-4444-4444-444444444444'
\set prof_bt '77777777-7777-7777-7777-777777777777'

begin;
set search_path to tap, public;
select plan(8);

select test._seed_tenant(:'t_a'::uuid, 'tenant-a');
select test._seed_tenant(:'t_b'::uuid, 'tenant-b');
select test._seed_resident(:'res_a'::uuid,  :'t_a'::uuid);
select test._seed_resident(:'res_b2'::uuid, :'t_a'::uuid);

insert into game.game (id, tenant_id, game_type_id, seat_count, status)
  values (:'g_id'::uuid, :'t_a'::uuid, 'battleship', 2, 'in_progress');
insert into game.game_player (id, tenant_id, game_id, seat, player_kind, resident_urn) values
  (:'p1'::uuid, :'t_a'::uuid, :'g_id'::uuid, 1, 'human',
     res_fn.build_urn(:'t_a'::uuid, 'app', 'resident', :'res_a'::uuid)),
  (:'p2'::uuid, :'t_a'::uuid, :'g_id'::uuid, 2, 'human',
     res_fn.build_urn(:'t_a'::uuid, 'app', 'resident', :'res_b2'::uuid));
insert into game.game_event (id, tenant_id, game_id, event_type, seat, event_number, event_data, status) values
  (:'ev_app'::uuid, :'t_a'::uuid, :'g_id'::uuid, 'setup', null, 1,  '{}'::jsonb, 'applied'),
  (:'ev_pen'::uuid, :'t_a'::uuid, :'g_id'::uuid, 'move',  2,    null, '{}'::jsonb, 'pending');
insert into game.game_event_state (event_id, game_id, event_number, game_state_after, player_views_after)
  values (:'ev_app'::uuid, :'g_id'::uuid, 1, '{}'::jsonb, '{}'::jsonb);

-- (1)(2) RLS enabled on the tenant table + the deny-all snapshot table
select is((select relrowsecurity from pg_class where oid = 'game.game'::regclass), true,
  'RLS enabled on game.game');
select is((select relrowsecurity from pg_class where oid = 'game.game_event_state'::regclass), true,
  'RLS enabled on game.game_event_state');

-- (3) tenant A player sees the game
select test._login(:'prof_a'::uuid, :'t_a'::uuid, array['p:app-user'], :'res_a'::uuid);
select is(
  (select count(*)::int from game.game where id = :'g_id'::uuid), 1,
  'tenant A user sees the game');

-- (4) tenant B user does not see tenant A's game
select test._login(:'prof_bt'::uuid, :'t_b'::uuid, array['p:app-user']);
select is_empty(
  format($$ select 1 from game.game where id = %L $$, :'g_id'),
  'tenant B user cannot see tenant A game');

-- (5) seat 1 (resident A) sees the APPLIED event but NOT seat 2's PENDING event
select test._login(:'prof_a'::uuid, :'t_a'::uuid, array['p:app-user'], :'res_a'::uuid);
select is(
  (select count(*)::int from game.game_event where game_id = :'g_id'::uuid), 1,
  'seat 1 sees the applied event but not seat 2 pending event');

-- (6) seat 2 (resident B2) sees the applied event AND its own pending event
select test._login(:'prof_b2'::uuid, :'t_a'::uuid, array['p:app-user'], :'res_b2'::uuid);
select is(
  (select count(*)::int from game.game_event where game_id = :'g_id'::uuid), 2,
  'seat 2 sees the applied event AND its own pending event');

-- (7) game_event_state is deny-all: authenticated cannot SELECT it (grant revoked)
select test._login(:'prof_a'::uuid, :'t_a'::uuid, array['p:app-user'], :'res_a'::uuid);
select throws_ok('select 1 from game.game_event_state', '42501', null,
  'authenticated is denied SELECT on game.game_event_state');

-- (8) game_type reference data is public (readable by anon)
select test._logout();
set local role anon;
select ok((select count(*) from game.game_type) >= 3, 'anon can read game_type reference data');

select * from finish();
rollback;
