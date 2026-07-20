-- Deploy fnb-game:00000000011320_game_api to pg
-- Spec: .claude/specs/game-server/_shared.data.md §game_api. SECURITY INVOKER surface for
-- PostGraphile: gate jwt.enforce_any_permission('{p:app-user,p:app-admin}') first, then
-- delegate to game_fn, passing jwt values as parameters (house rule). The caller's resident
-- urn is rebuilt with the app.resident generated-column formula.

begin;

------------------------------------------------------------------------ create_game
CREATE OR REPLACE FUNCTION game_api.create_game(_game_type_id citext, _players jsonb)
RETURNS game.game
LANGUAGE plpgsql
VOLATILE
AS $$
BEGIN
  PERFORM jwt.enforce_any_permission('{p:app-user,p:app-admin}'::citext[]);
  RETURN game_fn.create_game(
    jwt.tenant_id(),
    res_fn.build_urn(jwt.tenant_id(), 'app', 'resident', jwt.resident_id()),
    _game_type_id,
    _players
  );
END;
$$;

------------------------------------------------------------------------ submit_event
CREATE OR REPLACE FUNCTION game_api.submit_event(_game_id uuid, _event_data jsonb)
RETURNS game.game_event
LANGUAGE plpgsql
VOLATILE
AS $$
BEGIN
  PERFORM jwt.enforce_any_permission('{p:app-user,p:app-admin}'::citext[]);
  RETURN game_fn.submit_event(
    _game_id,
    res_fn.build_urn(jwt.tenant_id(), 'app', 'resident', jwt.resident_id()),
    _event_data
  );
END;
$$;

------------------------------------------------------------------------ resign_game
CREATE OR REPLACE FUNCTION game_api.resign_game(_game_id uuid)
RETURNS game.game_event
LANGUAGE plpgsql
VOLATILE
AS $$
BEGIN
  PERFORM jwt.enforce_any_permission('{p:app-user,p:app-admin}'::citext[]);
  RETURN game_fn.resign_game(
    _game_id,
    res_fn.build_urn(jwt.tenant_id(), 'app', 'resident', jwt.resident_id())
  );
END;
$$;

------------------------------------------------------------------------ my_games
-- Games where the caller holds a seat (RLS also applies), newest first.
CREATE OR REPLACE FUNCTION game_api.my_games(_game_type_id citext DEFAULT NULL)
RETURNS SETOF game.game
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  PERFORM jwt.enforce_any_permission('{p:app-user,p:app-admin}'::citext[]);
  RETURN QUERY
  SELECT g.*
  FROM game.game g
  WHERE (_game_type_id IS NULL OR g.game_type_id = _game_type_id)
    AND EXISTS (
      SELECT 1 FROM game.game_player gp
      WHERE gp.game_id = g.id
        AND gp.resident_urn = res_fn.build_urn(jwt.tenant_id(), 'app', 'resident', jwt.resident_id())
    )
  ORDER BY g.created_at DESC;
END;
$$;

------------------------------------------------------------------------ game_view
-- The caller's redacted view blob at _event_number (NULL = live); the replay scrubber
-- calls it per step.
CREATE OR REPLACE FUNCTION game_api.game_view(_game_id uuid, _event_number int DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  PERFORM jwt.enforce_any_permission('{p:app-user,p:app-admin}'::citext[]);
  RETURN game_fn.player_view(
    _game_id,
    res_fn.build_urn(jwt.tenant_id(), 'app', 'resident', jwt.resident_id()),
    _event_number
  );
END;
$$;

commit;
