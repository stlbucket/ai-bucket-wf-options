-- Deploy fnb-game:00000000011310_game_fn to pg
-- Spec: .claude/specs/game-server/_shared.data.md §game_fn. All functions receive explicit
-- args (never call jwt.* — that is the _api layer's job) and are SECURITY DEFINER (every
-- game table is write-locked to this schema; game_event_state is deny-all even for reads).
-- search_path pinned to pg_catalog, public (citext operators live in public).

begin;

------------------------------------------------------------------------ engine_context
-- The referee's ONE read (granted to n8n_worker): game summary + game_type registry row +
-- seat roster + latest applied snapshot + ALL pending events (oldest first — several seats
-- may hold one during simultaneous phases). camelCase keys — consumed by the n8n Code node.
CREATE OR REPLACE FUNCTION game_fn.engine_context(_game_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT jsonb_build_object(
    'game', jsonb_build_object(
      'id', g.id,
      'tenantId', g.tenant_id,
      'gameTypeId', g.game_type_id,
      'status', g.status,
      'seatCount', g.seat_count,
      'expectingSeats', to_jsonb(g.expecting_seats),
      'eventCount', g.event_count
    ),
    'gameType', (
      SELECT jsonb_build_object(
        'id', gt.id,
        'status', gt.status,
        'minPlayerSeats', gt.min_player_seats,
        'maxPlayerSeats', gt.max_player_seats,
        'supportedPlayerKinds', to_jsonb(gt.supported_player_kinds),
        'defaultConfig', gt.default_config
      )
      FROM game.game_type gt WHERE gt.id = g.game_type_id
    ),
    'players', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'seat', gp.seat,
        'kind', gp.player_kind,
        'resigned', gp.resigned_at IS NOT NULL
      ) ORDER BY gp.seat), '[]'::jsonb)
      FROM game.game_player gp WHERE gp.game_id = g.id
    ),
    'gameState', (
      SELECT ges.game_state_after FROM game.game_event_state ges
      WHERE ges.game_id = g.id ORDER BY ges.event_number DESC LIMIT 1
    ),
    'playerViews', (
      SELECT ges.player_views_after FROM game.game_event_state ges
      WHERE ges.game_id = g.id ORDER BY ges.event_number DESC LIMIT 1
    ),
    'pendingEvents', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', ge.id,
        'eventType', ge.event_type,
        'seat', ge.seat,
        'eventData', ge.event_data,
        'createdAt', ge.created_at
      ) ORDER BY ge.created_at), '[]'::jsonb)
      FROM game.game_event ge
      WHERE ge.game_id = g.id AND ge.status = 'pending'
    )
  )
  FROM game.game g
  WHERE g.id = _game_id;
$$;

------------------------------------------------------------------------ record_referee_result
-- The referee's ONE write (granted to n8n_worker): applies the ordered actions list
-- atomically and SERIALLY — pg_advisory_xact_lock on the game id, THEN an optimistic
-- concurrency check (expectedEventCount vs the current event_count read under that lock)
-- discards the WHOLE result as a stale noop if any other execution has written since this
-- one's engine_context read. This is the actual double-apply guard: the per-'apply'-action
-- "still pending" re-check alone is NOT enough — two racing executions can each
-- independently compute and insert their OWN system/machine event from a stale read
-- (neither re-applies the SAME player event, so that check alone never catches it; verified
-- live during implementation — two concurrent triggers each produced their own machine
-- reply). Contract:
-- { actions: [ {kind: system|apply|reject|machine, ...} ], expectingSeats, gameStatus,
--   expectedEventCount, outcomes?, abortReason? } — see
-- .claude/specs/game-server/_shared.data.md. Every applying action carries
-- stateAfter/viewsAfter (its replay snapshot).
CREATE OR REPLACE FUNCTION game_fn.record_referee_result(_game_id uuid, _result jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  _game game.game;
  _action jsonb;
  _next_event int;
  _event_id uuid;
  _event_seat int;
  _applied int := 0;
  _rejected int := 0;
  _machine int := 0;
  _new_status game.game_status;
  _expecting int[];
BEGIN
  -- serialize all referee writes per game (uses the uuid's 128 bits folded to 64)
  PERFORM pg_advisory_xact_lock(hashtextextended(_game_id::text, 0));

  SELECT * INTO _game FROM game.game WHERE id = _game_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GAME NOT FOUND: %', _game_id;
  END IF;

  -- stale-context guard: this execution's referee computed its actions against a snapshot
  -- taken at _result.expectedEventCount events; if the game has moved on since (another
  -- execution won the race), discard the WHOLE result untouched — the caller re-triggers
  -- if there's still real work pending (referee no-ops safely on a re-read).
  IF _result ? 'expectedEventCount'
     AND (_result->>'expectedEventCount')::int IS DISTINCT FROM _game.event_count THEN
    RETURN jsonb_build_object('recorded', false, 'noop', true, 'reason', 'stale_context', 'gameStatus', _game.status);
  END IF;

  _next_event := _game.event_count;

  FOR _action IN SELECT * FROM jsonb_array_elements(coalesce(_result->'actions', '[]'::jsonb))
  LOOP
    CASE _action->>'kind'

    WHEN 'system' THEN
      -- setup is only legal from lobby: a concurrent duplicate initialize skips here
      IF (_action->>'eventType') = 'setup' AND _game.status <> 'lobby' THEN
        CONTINUE;
      END IF;
      _next_event := _next_event + 1;
      INSERT INTO game.game_event
        (tenant_id, game_id, event_type, seat, event_number, event_data, status, applied_at)
      VALUES
        (_game.tenant_id, _game_id, (_action->>'eventType')::game.game_event_type, NULL,
         _next_event, coalesce(_action->'eventData', '{}'::jsonb), 'applied', current_timestamp)
      RETURNING id INTO _event_id;
      INSERT INTO game.game_event_state (event_id, game_id, event_number, game_state_after, player_views_after)
      VALUES (_event_id, _game_id, _next_event, _action->'stateAfter', _action->'viewsAfter');
      _applied := _applied + 1;

    WHEN 'apply' THEN
      -- re-check still pending: the loser of a concurrent duplicate execution no-ops here
      UPDATE game.game_event
      SET status = 'applied', event_number = _next_event + 1, applied_at = current_timestamp
      WHERE id = (_action->>'eventId')::uuid AND game_id = _game_id AND status = 'pending'
      RETURNING id, seat INTO _event_id, _event_seat;
      IF _event_id IS NULL THEN
        CONTINUE;
      END IF;
      _next_event := _next_event + 1;
      INSERT INTO game.game_event_state (event_id, game_id, event_number, game_state_after, player_views_after)
      VALUES (_event_id, _game_id, _next_event, _action->'stateAfter', _action->'viewsAfter');
      -- applying a resign event marks the seat resigned (generic — no engine involvement)
      UPDATE game.game_player gp
      SET resigned_at = current_timestamp
      FROM game.game_event ge
      WHERE ge.id = _event_id AND ge.event_type = 'resign'
        AND gp.game_id = _game_id AND gp.seat = ge.seat AND gp.resigned_at IS NULL;
      _applied := _applied + 1;

    WHEN 'reject' THEN
      UPDATE game.game_event
      SET status = 'rejected', rejection_reason = _action->>'rejectionReason'
      WHERE id = (_action->>'eventId')::uuid AND game_id = _game_id AND status = 'pending';
      IF FOUND THEN
        _rejected := _rejected + 1;
      END IF;

    WHEN 'machine' THEN
      _next_event := _next_event + 1;
      INSERT INTO game.game_event
        (tenant_id, game_id, event_type, seat, event_number, event_data, status, applied_at)
      VALUES
        (_game.tenant_id, _game_id,
         coalesce((_action->>'eventType')::game.game_event_type, 'move'),
         (_action->>'seat')::int, _next_event,
         coalesce(_action->'eventData', '{}'::jsonb), 'applied', current_timestamp)
      RETURNING id INTO _event_id;
      INSERT INTO game.game_event_state (event_id, game_id, event_number, game_state_after, player_views_after)
      VALUES (_event_id, _game_id, _next_event, _action->'stateAfter', _action->'viewsAfter');
      _applied := _applied + 1;
      _machine := _machine + 1;

    ELSE
      RAISE EXCEPTION 'UNKNOWN REFEREE ACTION KIND: %', _action->>'kind';
    END CASE;
  END LOOP;

  _new_status := coalesce((_result->>'gameStatus')::game.game_status, _game.status);

  -- pure noop (rogue/duplicate trigger): nothing applied/rejected, no status change asked
  IF _applied = 0 AND _rejected = 0 AND _new_status = _game.status THEN
    RETURN jsonb_build_object('recorded', false, 'noop', true, 'gameStatus', _game.status);
  END IF;

  _expecting := coalesce(
    (SELECT array_agg(x::int) FROM jsonb_array_elements_text(coalesce(_result->'expectingSeats', '[]'::jsonb)) x),
    '{}'::int[]
  );

  UPDATE game.game
  SET status = _new_status,
      expecting_seats = CASE WHEN _new_status IN ('complete', 'abandoned') THEN '{}'::int[] ELSE _expecting END,
      event_count = _next_event,
      finished_at = CASE WHEN _new_status IN ('complete', 'abandoned') AND finished_at IS NULL
                         THEN current_timestamp ELSE finished_at END,
      updated_at = current_timestamp
  WHERE id = _game_id;

  IF _new_status = 'complete' AND _result ? 'outcomes' THEN
    UPDATE game.game_player gp
    SET outcome = (o.value)::game.seat_outcome
    FROM jsonb_each_text(_result->'outcomes') o
    WHERE gp.game_id = _game_id AND gp.seat = (o.key)::int;
  END IF;

  RETURN jsonb_build_object(
    'recorded', true,
    'appliedEvents', _applied,
    'rejectedEvents', _rejected,
    'machineEvents', _machine,
    'gameStatus', _new_status
  );
END;
$$;

------------------------------------------------------------------------ create_game
-- _players = seats 2..N: [{ "kind": "HUMAN"|"MACHINE_ALGORITHM"|"MACHINE_AGENT",
-- "residentUrn"?: "..." }, ...] (client enum casing accepted via lower()). The creator is
-- always seat 1 (human). Registry validation happens HERE (type live, seat bounds, machine
-- kinds supported — errors 30003/30004/30005); the referee's setup abort remains
-- defense-in-depth for engine-level roster legality.
CREATE OR REPLACE FUNCTION game_fn.create_game(
  _tenant_id uuid,
  _creator_resident_urn text,
  _game_type_id citext,
  _players jsonb
)
RETURNS game.game
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  _gt game.game_type;
  _game game.game;
  _p jsonb;
  _seat int := 1;
  _kind game.player_kind;
  _urn text;
  _seat_count int;
BEGIN
  SELECT * INTO _gt FROM game.game_type WHERE id = _game_type_id;
  IF NOT FOUND OR _gt.status <> 'live' THEN
    RAISE EXCEPTION '30003: GAME TYPE NOT AVAILABLE';
  END IF;

  IF _players IS NULL OR jsonb_typeof(_players) <> 'array' OR jsonb_array_length(_players) < 1 THEN
    RAISE EXCEPTION '30004: INVALID SEAT COUNT';
  END IF;
  _seat_count := 1 + jsonb_array_length(_players);
  IF _seat_count < _gt.min_player_seats OR _seat_count > _gt.max_player_seats THEN
    RAISE EXCEPTION '30004: INVALID SEAT COUNT';
  END IF;

  INSERT INTO game.game (tenant_id, game_type_id, status, seat_count)
  VALUES (_tenant_id, _game_type_id, 'lobby', _seat_count)
  RETURNING * INTO _game;
  PERFORM res_fn.register_resource(_game.id, _tenant_id, 'game', 'game');

  -- seat 1 = creator (human)
  INSERT INTO game.game_player (tenant_id, game_id, seat, player_kind, resident_urn)
  VALUES (_tenant_id, _game.id, 1, 'human', _creator_resident_urn);

  FOR _p IN SELECT * FROM jsonb_array_elements(_players)
  LOOP
    _seat := _seat + 1;
    BEGIN
      _kind := lower(_p->>'kind')::game.player_kind;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION '30005: PLAYER KIND NOT SUPPORTED';
    END;

    IF _kind = 'human' THEN
      _urn := _p->>'residentUrn';
      IF _urn IS NULL THEN
        RAISE EXCEPTION 'INVALID PLAYER: human seat % has no residentUrn', _seat;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM res.resource r
        WHERE r.urn = _urn AND r.tenant_id = _tenant_id
          AND r.module = 'app' AND r.resource_type = 'resident' AND r.archived_at IS NULL
      ) THEN
        RAISE EXCEPTION 'INVALID PLAYER: % is not a resident of this tenant', _urn;
      END IF;
      -- distinctness (incl. ≠ creator) is enforced by uq_game_player_resident
      INSERT INTO game.game_player (tenant_id, game_id, seat, player_kind, resident_urn)
      VALUES (_tenant_id, _game.id, _seat, 'human', _urn);
    ELSE
      IF NOT (_kind = ANY (_gt.supported_player_kinds)) THEN
        RAISE EXCEPTION '30005: PLAYER KIND NOT SUPPORTED';
      END IF;
      INSERT INTO game.game_player (tenant_id, game_id, seat, player_kind, resident_urn)
      VALUES (_tenant_id, _game.id, _seat, _kind, NULL);
    END IF;
  END LOOP;

  RETURN _game;
END;
$$;

------------------------------------------------------------------------ submit_event
-- Records intent as a pending 'move' event. Pre-checks are fail-fast UX only — the referee
-- is authoritative. The one-pending-per-seat partial unique index is the HARD guard.
CREATE OR REPLACE FUNCTION game_fn.submit_event(_game_id uuid, _resident_urn text, _event_data jsonb)
RETURNS game.game_event
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  _game game.game;
  _seat int;
  _event game.game_event;
BEGIN
  SELECT * INTO _game FROM game.game WHERE id = _game_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '30000: NOT AUTHORIZED';
  END IF;

  SELECT gp.seat INTO _seat FROM game.game_player gp
  WHERE gp.game_id = _game_id AND gp.resident_urn = _resident_urn;
  IF _seat IS NULL THEN
    RAISE EXCEPTION '30000: NOT AUTHORIZED';
  END IF;

  IF _game.status <> 'in_progress' THEN
    RAISE EXCEPTION '30002: GAME NOT IN PROGRESS';
  END IF;
  IF NOT (_seat = ANY (_game.expecting_seats)) THEN
    RAISE EXCEPTION '30001: EVENT NOT EXPECTED';
  END IF;

  BEGIN
    INSERT INTO game.game_event (tenant_id, game_id, event_type, seat, event_data)
    VALUES (_game.tenant_id, _game_id, 'move', _seat, coalesce(_event_data, '{}'::jsonb))
    RETURNING * INTO _event;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION '30001: EVENT NOT EXPECTED';  -- this seat already has a pending event
  END;

  RETURN _event;
END;
$$;

------------------------------------------------------------------------ resign_game
-- Resign is an EVENT through the referee, not a direct update — the log has no holes.
-- Any pending event of the resigner is rejected (superseded), then a pending 'resign'
-- event is inserted (accepted regardless of expecting_seats). The composable triggers the
-- referee (op 'event'), which applies it generically.
CREATE OR REPLACE FUNCTION game_fn.resign_game(_game_id uuid, _resident_urn text)
RETURNS game.game_event
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  _game game.game;
  _seat int;
  _event game.game_event;
BEGIN
  SELECT * INTO _game FROM game.game WHERE id = _game_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '30000: NOT AUTHORIZED';
  END IF;

  SELECT gp.seat INTO _seat FROM game.game_player gp
  WHERE gp.game_id = _game_id AND gp.resident_urn = _resident_urn AND gp.resigned_at IS NULL;
  IF _seat IS NULL THEN
    RAISE EXCEPTION '30000: NOT AUTHORIZED';
  END IF;

  IF _game.status <> 'in_progress' THEN
    RAISE EXCEPTION '30002: GAME NOT IN PROGRESS';
  END IF;

  UPDATE game.game_event
  SET status = 'rejected', rejection_reason = 'superseded_by_resign'
  WHERE game_id = _game_id AND seat = _seat AND status = 'pending';

  INSERT INTO game.game_event (tenant_id, game_id, event_type, seat, event_data)
  VALUES (_game.tenant_id, _game_id, 'resign', _seat, '{}'::jsonb)
  RETURNING * INTO _event;

  RETURN _event;
END;
$$;

------------------------------------------------------------------------ player_view
-- The caller's redacted seat view at ANY point in the event stream: _event_number NULL =
-- live (latest snapshot). One function powers live play AND the replay scrubber (forward =
-- increment, backward = decrement). Reads the deny-all table; returns ONLY the caller's
-- seat's view — never another seat's, never game_state_after.
CREATE OR REPLACE FUNCTION game_fn.player_view(
  _game_id uuid,
  _resident_urn text,
  _event_number int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  _seat int;
  _view jsonb;
BEGIN
  SELECT gp.seat INTO _seat FROM game.game_player gp
  WHERE gp.game_id = _game_id AND gp.resident_urn = _resident_urn;
  IF _seat IS NULL THEN
    RAISE EXCEPTION '30000: NOT AUTHORIZED';
  END IF;

  IF _event_number IS NULL THEN
    SELECT ges.player_views_after -> _seat::text INTO _view
    FROM game.game_event_state ges
    WHERE ges.game_id = _game_id
    ORDER BY ges.event_number DESC LIMIT 1;
  ELSE
    SELECT ges.player_views_after -> _seat::text INTO _view
    FROM game.game_event_state ges
    WHERE ges.game_id = _game_id AND ges.event_number = _event_number;
  END IF;

  RETURN _view;  -- NULL before setup / unknown event number
END;
$$;

commit;
