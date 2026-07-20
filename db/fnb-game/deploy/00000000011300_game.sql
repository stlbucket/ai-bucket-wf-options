-- Deploy fnb-game:00000000011300_game to pg
-- Spec: .claude/specs/game-server/_shared.data.md (event-sourced N-seat game platform)

begin;

create schema game;
create schema game_fn;
create schema game_api;

------------------------------------------------------------------------ enums
-- Enum SQL names are final — PostGraphile 5's typeCodecName inflector ignores @name smart
-- tags on types (fnb-n8n lesson). game_type is NOT an enum — it is the registry table below.
CREATE TYPE game.game_status       AS ENUM ('lobby', 'in_progress', 'complete', 'abandoned');
CREATE TYPE game.game_type_status  AS ENUM ('live', 'coming_soon', 'retired');
CREATE TYPE game.player_kind       AS ENUM ('human', 'machine_algorithm', 'machine_agent');
CREATE TYPE game.game_event_type   AS ENUM ('setup', 'move', 'resign');
CREATE TYPE game.game_event_status AS ENUM ('pending', 'applied', 'rejected');
CREATE TYPE game.seat_outcome      AS ENUM ('won', 'lost', 'drew');

------------------------------------------------------------------------ game_type registry
-- Game types are rows, not enum values (locked 2026-07-19): per-type rules (seat bounds,
-- machine support, availability, engine config) are data the DB enforces at create time.
-- Reference data — seeded here, no write API; registry management is deploy-only for now.
CREATE TABLE game.game_type (
  id citext PRIMARY KEY,            -- 'battleship' | 'tic_tac_toe' | 'checkers' (referee dispatch key)
  name citext NOT NULL,
  description text,
  icon citext,                      -- i-lucide-* (game UI; nav tool rows carry their own — R14)
  ordinal int NOT NULL DEFAULT 0,
  status game.game_type_status NOT NULL DEFAULT 'coming_soon',
  min_player_seats int NOT NULL,
  max_player_seats int NOT NULL,
  supported_player_kinds game.player_kind[] NOT NULL DEFAULT '{human}',
  default_config jsonb NOT NULL DEFAULT '{}'::jsonb,  -- per-type engine config passed to setup
  created_at timestamptz NOT NULL DEFAULT current_timestamp,
  updated_at timestamptz NOT NULL DEFAULT current_timestamp,
  CONSTRAINT chk_game_type_seat_bounds
    CHECK (min_player_seats >= 2 AND max_player_seats >= min_player_seats)
);

INSERT INTO game.game_type
  (id, name, description, icon, ordinal, status, min_player_seats, max_player_seats, supported_player_kinds, default_config)
VALUES
  ('battleship', 'Battleship', 'Classic two-board naval battle — sink the enemy fleet.',
   'i-lucide-ship', 0, 'live', 2, 2,
   '{human,machine_algorithm,machine_agent}', '{"boardSize": 10}'::jsonb)
 ,('tic_tac_toe', 'Tic-Tac-Toe', 'Three in a row wins.',
   'i-lucide-hash', 1, 'coming_soon', 2, 2, '{human}', '{}'::jsonb)
 ,('checkers', 'Checkers', 'Diagonal capture classic.',
   'i-lucide-circle-dot', 2, 'coming_soon', 2, 2, '{human}', '{}'::jsonb);

------------------------------------------------------------------------ game
-- The agnostic game record (registered URN business table). No game-type columns, no
-- per-seat columns — seats live in game.game_player; state lives in the event snapshots.
CREATE TABLE game.game (
  id uuid NOT NULL DEFAULT res_fn.uuid_generate_v7() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES app.tenant(id),
  game_type_id citext NOT NULL REFERENCES game.game_type(id),
  status game.game_status NOT NULL DEFAULT 'lobby',
  seat_count int NOT NULL,
  expecting_seats int[] NOT NULL DEFAULT '{}',  -- seats the game awaits events from; referee-owned
  event_count int NOT NULL DEFAULT 0,           -- applied events (= max event_number)
  urn text NOT NULL
    GENERATED ALWAYS AS (res_fn.build_urn(tenant_id, 'game', 'game', id)) STORED,
  created_at timestamptz NOT NULL DEFAULT current_timestamp,
  updated_at timestamptz NOT NULL DEFAULT current_timestamp,
  finished_at timestamptz,
  CONSTRAINT uq_game_urn UNIQUE (urn),
  CONSTRAINT chk_game_seat_count CHECK (seat_count >= 2),
  CONSTRAINT fk_game_resource FOREIGN KEY (id) REFERENCES res.resource(id)
    DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX idx_game_game_tenant ON game.game (tenant_id);
CREATE INDEX idx_game_game_type ON game.game (game_type_id);

------------------------------------------------------------------------ game_player
-- The seat roster (N-seat model). Seats 1..seat_count; seat 1 is always the creator (human).
-- Machine seats: player_kind machine_*, resident_urn NULL. Immutable after create except
-- resigned_at/outcome. Unregistered child table.
CREATE TABLE game.game_player (
  id uuid NOT NULL DEFAULT res_fn.uuid_generate_v7() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES app.tenant(id),
  game_id uuid NOT NULL REFERENCES game.game(id) ON DELETE CASCADE,
  seat int NOT NULL CHECK (seat >= 1),
  player_kind game.player_kind NOT NULL DEFAULT 'human',
  resident_urn text REFERENCES res.resource(urn),   -- NULL ⟺ machine seat
  outcome game.seat_outcome,                        -- NULL until the game completes (per-seat; no winner_seat)
  resigned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT current_timestamp,
  CONSTRAINT uq_game_player_seat UNIQUE (game_id, seat),
  CONSTRAINT chk_game_player_kind_urn
    CHECK ((player_kind = 'human') = (resident_urn IS NOT NULL))
);
CREATE UNIQUE INDEX uq_game_player_resident
  ON game.game_player (game_id, resident_urn) WHERE resident_urn IS NOT NULL;
CREATE INDEX idx_game_player_resident ON game.game_player (resident_urn);
CREATE INDEX idx_game_player_tenant ON game.game_player (tenant_id);

------------------------------------------------------------------------ game_event
-- The event log — the source of truth (event-sourced rule): every state change is a row
-- (setup carries the generated initial state; resigns are events too — the log has no
-- holes). Applied events form the dense replayable sequence event_number 1..N.
CREATE TABLE game.game_event (
  id uuid NOT NULL DEFAULT res_fn.uuid_generate_v7() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES app.tenant(id),
  game_id uuid NOT NULL REFERENCES game.game(id) ON DELETE CASCADE,
  event_type game.game_event_type NOT NULL DEFAULT 'move',
  seat int CHECK (seat >= 1),                        -- NULL for system events (setup)
  event_number int,                                  -- dense 1..N, assigned by the referee on apply
  event_data jsonb NOT NULL,
  status game.game_event_status NOT NULL DEFAULT 'pending',
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT current_timestamp,
  applied_at timestamptz,
  CONSTRAINT uq_game_event_number UNIQUE (game_id, event_number)
);
-- ONE pending event per seat per game — a hard invariant, not a soft check. Multiple seats
-- may hold a pending event at once (simultaneous phases: blackjack bets, trivia answers).
CREATE UNIQUE INDEX uq_game_event_pending
  ON game.game_event (game_id, seat) WHERE status = 'pending';
CREATE INDEX idx_game_event_game ON game.game_event (game_id, status, created_at);
CREATE INDEX idx_game_event_tenant ON game.game_event (tenant_id);

------------------------------------------------------------------------ game_event_state
-- Deny-all per-event snapshots (auth.session pattern — policies change adds the revoke).
-- One row per APPLIED event: authoritative state + per-seat redacted views AFTER the event.
-- Current state = max event_number; replay = walk event_number. Only SECURITY DEFINER
-- game_fn functions touch it; smart-tagged out of the GraphQL schema entirely.
CREATE TABLE game.game_event_state (
  event_id uuid NOT NULL PRIMARY KEY REFERENCES game.game_event(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES game.game(id) ON DELETE CASCADE,
  event_number int NOT NULL,
  game_state_after jsonb NOT NULL,    -- authoritative engine state (ship positions!)
  player_views_after jsonb NOT NULL,  -- { "1": <view>, "2": <view>, ... } redacted per seat
  created_at timestamptz NOT NULL DEFAULT current_timestamp,
  CONSTRAINT uq_game_event_state_number UNIQUE (game_id, event_number)
);

------------------------------------------------------------------------ registry visibility
INSERT INTO res.module_permission (module, permission_key)
VALUES ('game', 'p:app-user')
ON CONFLICT (module) DO NOTHING;

------------------------------------------------------------------------ notify trigger
-- Channel game:{id}:state, payload { event, id } — minimal, never business data
-- (sockets-pattern). Every referee write updates game.game, so notifies fire per write.
CREATE FUNCTION game_fn.tg__on_game_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify(
    'game:' || NEW.id::text || ':state',
    json_build_object('event', 'update', 'id', NEW.id)::text
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER tg__game_state
  AFTER UPDATE ON game.game
  FOR EACH ROW EXECUTE PROCEDURE game_fn.tg__on_game_update();

commit;
