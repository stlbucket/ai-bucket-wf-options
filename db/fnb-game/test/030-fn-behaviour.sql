-- game_fn.create_game behaviour: builds a lobby with the creator at seat 1 (human) + the roster
-- from _players, registers the game resource, and enforces game-type availability + seat bounds.
-- Spec: .claude/specs/db-testing/fn-behaviour-tests.md. Run as owner (create_game is SECURITY DEFINER).
\set t_a   '11111111-1111-1111-1111-111111111111'
\set res_a '55555555-5555-5555-5555-555555555555'

begin;
set search_path to tap, public;
select plan(8);

select test._seed_tenant(:'t_a'::uuid, 'tenant-a');
select test._seed_resident(:'res_a'::uuid, :'t_a'::uuid);

-- battleship: creator (seat 1, human) + one machine opponent → 2 seats (min=max=2)
select game_fn.create_game(
  :'t_a'::uuid,
  res_fn.build_urn(:'t_a'::uuid, 'app', 'resident', :'res_a'::uuid),
  'battleship',
  '[{"kind":"machine_algorithm"}]'::jsonb);

-- (1) game created in the lobby with 2 seats
select is((select seat_count from game.game where tenant_id = :'t_a'::uuid), 2,
  'create_game set seat_count = 1 + players');
-- (2) status lobby
select is((select status::text from game.game where tenant_id = :'t_a'::uuid), 'lobby',
  'new game starts in the lobby');
-- (3) two player rows
select is(
  (select count(*)::int from game.game_player gp join game.game g on g.id = gp.game_id
     where g.tenant_id = :'t_a'::uuid), 2,
  'create_game seated both players');
-- (4) seat 1 is the creator (human) with the creator urn
select is(
  (select gp.resident_urn from game.game_player gp join game.game g on g.id = gp.game_id
     where g.tenant_id = :'t_a'::uuid and gp.seat = 1),
  res_fn.build_urn(:'t_a'::uuid, 'app', 'resident', :'res_a'::uuid),
  'seat 1 is the creator resident');
-- (5) seat 2 is the machine opponent
select is(
  (select gp.player_kind::text from game.game_player gp join game.game g on g.id = gp.game_id
     where g.tenant_id = :'t_a'::uuid and gp.seat = 2),
  'machine_algorithm', 'seat 2 is the machine opponent');
-- (6) the game is registered in res.resource
select is(
  (select count(*)::int from res.resource r join game.game g on g.id = r.id
     where g.tenant_id = :'t_a'::uuid and r.module = 'game'), 1,
  'create_game registered a res.resource (module game)');

-- (7) an unavailable (non-live) game type is rejected (30003)
select throws_ok(
  format($$ select game_fn.create_game(%L, %L, 'tic_tac_toe', '[{"kind":"machine_algorithm"}]'::jsonb) $$,
         :'t_a', res_fn.build_urn(:'t_a'::uuid, 'app', 'resident', :'res_a'::uuid)),
  'P0001', null, 'create_game rejects a non-live game type');

-- (8) an invalid seat count (no opponents) is rejected (30004)
select throws_ok(
  format($$ select game_fn.create_game(%L, %L, 'battleship', '[]'::jsonb) $$,
         :'t_a', res_fn.build_urn(:'t_a'::uuid, 'app', 'resident', :'res_a'::uuid)),
  'P0001', null, 'create_game rejects an invalid seat count');

select * from finish();
rollback;
