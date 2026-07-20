-- Deploy fnb-game:00000000011330_game_policies to pg
-- Spec: .claude/specs/game-server/_shared.data.md §RLS + §n8n_worker grants + §Security model.

begin;

--- game_api: the PostGraphile surface (standard broad grants; gates are in the functions)
grant usage on schema game_api to anon, authenticated, service_role;
grant all on all routines in schema game_api to anon, authenticated, service_role;
alter default privileges for role postgres in schema game_api grant all on routines to anon, authenticated, service_role;

--- game: reads are RLS-scoped; writes happen ONLY via game_fn SECURITY DEFINER
grant usage on schema game to anon, authenticated, service_role;
grant select on all tables in schema game to anon, authenticated, service_role;
alter default privileges for role postgres in schema game grant select on tables to anon, authenticated, service_role;

-- game_event_state is DENY-ALL (auth.session pattern): the broad select above is revoked
-- again explicitly — snapshots hold ship positions; only game_fn definers may touch them.
revoke all on game.game_event_state from anon, authenticated, service_role;

--- game_fn: a CLOSED surface — deliberately NOT the broad grant-all-routines house pattern
--- (that pattern lets callers bypass the _api gates — issue 0020). engine_context and
--- record_referee_result are the n8n referee's surface ONLY; the player-path definers are
--- executable solely so the game_api invokers can delegate.
grant usage on schema game_fn to authenticated, service_role;
revoke all on all functions in schema game_fn from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema game_fn revoke execute on functions from public;

grant execute on function
  game_fn.create_game(uuid, text, citext, jsonb),
  game_fn.submit_event(uuid, text, jsonb),
  game_fn.resign_game(uuid, text),
  game_fn.player_view(uuid, text, int)
to authenticated, service_role;

------------------------------------------------------------------------ RLS
-- game_type: global reference data, nothing secret; no write policies (seed/deploy-only)
alter table game.game_type enable row level security;
CREATE POLICY view_all ON game.game_type FOR SELECT USING (true);

-- game: tenant-scoped summaries (not secret — the secret state is in the deny-all table);
-- no INSERT/UPDATE policies — writes only via SECURITY DEFINER game_fn.*
alter table game.game enable row level security;
CREATE POLICY view_all_for_tenant ON game.game FOR SELECT
  USING (jwt.has_permission('p:app-user', tenant_id)
      OR jwt.has_permission('p:app-admin', tenant_id));

alter table game.game_player enable row level security;
CREATE POLICY view_all_for_tenant ON game.game_player FOR SELECT
  USING (jwt.has_permission('p:app-user', tenant_id)
      OR jwt.has_permission('p:app-admin', tenant_id));

-- game_event: applied/rejected events are tenant-readable; a PENDING event (and its
-- payload) is visible ONLY to its submitting seat — simultaneous-submission games
-- (blackjack bets, trivia answers) must not leak held submissions.
alter table game.game_event enable row level security;
CREATE POLICY view_for_tenant ON game.game_event FOR SELECT
  USING (
    (jwt.has_permission('p:app-user', tenant_id)
      OR jwt.has_permission('p:app-admin', tenant_id))
    AND (
      status <> 'pending'
      OR EXISTS (
        SELECT 1 FROM game.game_player gp
        WHERE gp.game_id = game_event.game_id
          AND gp.seat = game_event.seat
          AND gp.resident_urn = res_fn.build_urn(jwt.tenant_id(), 'app', 'resident', jwt.resident_id())
      )
    )
  );

-- game_event_state: RLS enabled, ZERO policies (+ the explicit revoke above) — deny-all
alter table game.game_event_state enable row level security;

------------------------------------------------------------------------ n8n_worker (the referee's entire DB surface)
-- Exactly two EXECUTEs — no table SELECTs, no other schemas (dataset-sync grant
-- discipline). This grant lives HERE, not in fnb-n8n: fnb-n8n deploys before fnb-game
-- exists on a fresh rebuild (owning-package pattern, agent_worker lesson).
grant usage on schema game to n8n_worker;
grant usage on schema game_fn to n8n_worker;
grant execute on function game_fn.engine_context(uuid) to n8n_worker;
grant execute on function game_fn.record_referee_result(uuid, jsonb) to n8n_worker;

commit;
