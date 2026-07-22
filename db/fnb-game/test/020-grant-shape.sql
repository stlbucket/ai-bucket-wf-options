-- game_fn is a CLOSED surface (db/fnb-game/…011330_game_policies.sql): unlike the house
-- broad-grant pattern, execute is REVOKED from public/anon/authenticated and re-granted only for
-- the four player-path fns; engine_context + record_referee_result are the n8n referee's surface
-- ONLY (n8n_worker). This is the anti-grant-bypass boundary (issue 0020) — assert it holds.
-- Spec: .claude/specs/db-testing/api-permission-tests.md.
\set t_a  '11111111-1111-1111-1111-111111111111'
\set prof '33333333-3333-3333-3333-333333333333'

begin;
set search_path to tap, public;
select plan(5);

-- (1)(2) the referee-only definers are NOT executable by request roles
select function_privs_are('game_fn', 'engine_context', array['uuid'],
  'authenticated', array[]::text[], 'authenticated CANNOT execute game_fn.engine_context');
select function_privs_are('game_fn', 'engine_context', array['uuid'],
  'anon', array[]::text[], 'anon CANNOT execute game_fn.engine_context');

-- (3) record_referee_result is likewise closed to authenticated
select function_privs_are('game_fn', 'record_referee_result', array['uuid', 'jsonb'],
  'authenticated', array[]::text[], 'authenticated CANNOT execute game_fn.record_referee_result');

-- (4) the player-path definer IS granted to authenticated (so game_api invokers can delegate)
select function_privs_are('game_fn', 'create_game', array['uuid', 'text', 'citext', 'jsonb'],
  'authenticated', array['EXECUTE'], 'authenticated CAN execute game_fn.create_game');

-- (5) game_api.create_game enforces p:app-user|p:app-admin before doing anything
select test._login(:'prof'::uuid, :'t_a'::uuid, array[]::text[]);
select throws_ok(
  $$ select game_api.create_game('battleship', '[]'::jsonb) $$,
  'P0001', null, 'game_api.create_game without an app permission raises');

select * from finish();
rollback;
