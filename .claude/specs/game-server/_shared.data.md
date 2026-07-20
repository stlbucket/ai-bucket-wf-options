---
name: game-server-shared
description: Shared data architecture for the game server — the db/fnb-game package (agnostic N-seat game record + player roster + replayable event log + deny-all per-event snapshots), state-shape contracts, pg_notify channels, n8n_worker grants, the game-event registry entry, PostGraphile exposure, fnb-types, composables, and the security model.
---

# Game Server — Shared Data

## Status
Draft — decisions locked 2026-07-19; multi-player (N-seat) generalization + **event-sourced
model** (every state change is a replayable event; per-event snapshots; `expecting_seats`;
per-seat outcomes) locked 2026-07-19 (see `README.md`). No `[FILL IN]` markers.

Referenced by all `game-server/*.data.md` files. Do not duplicate here.

---

## Architecture at a glance

```
tenant-app page ──composable (R1)──▶ PostGraphile (game_api)   ── create_game / submit_event / resign / my_games / game_view(event#)
        │                               │
        │                               └─ triggerWorkflow('game-event', { op, gameId })   (R22 registry, engine: 'n8n')
        │                                        │ POST /webhook/game-event  (X-Fnb-Webhook-Secret)
        │                                        ▼
        │                               n8n `game-event` workflow (the REFEREE)
        │                                 engine_context ── Code node: engine (battleship.ts) ──▶ record_referee_result
        │                                        │ as n8n_worker (SECURITY DEFINER game_fn.*)
        │                                        ▼ appends game_event rows + per-event snapshots (event-sourced)
        │                               game.game UPDATE ──trigger──▶ pg_notify('game:{id}:state', {event,id})
        │                                                                       │
        └── WS  /game/_ws/games/{id}  (game-layer LISTEN bridge) ◀──────────────┘
            on notify → re-execute the GraphQL detail query (network-only)
```

**Event-sourcing rule (locked 2026-07-19):** every state change — setup, player moves, machine
moves, resigns — is a `game.game_event` row with a dense `event_number`, and every applied
event stores a full post-event snapshot (`game.game_event_state`). The game is replayable
forward **and** backward by walking `event_number`; "current state" is simply the latest
applied event's snapshot. A game expects events from **one or more seats at once**
(`expecting_seats int[]` — always one seat for 1v1 games; several during simultaneous phases
like blackjack bets or trivia answers).

---

## The `db/fnb-game` sqitch package (new)

Scaffold via `new-db-package`; register in `DEPLOY_PACKAGES` (`.env` + `.env.example`) at the
**end of the list** (needs `fnb-app` tenants, `fnb-res` URNs, and the `fnb-n8n` `n8n_worker`
role). Sqitch deps via `sqitch-expert` at implementation: the first change depends on
`fnb-res` (registry) and `fnb-app:00000000010250_app_policies` (jwt helpers precedent); the
policies change depends on `fnb-n8n`'s role-creating change.

### Schema trio (R8): `game` / `game_fn` / `game_api`

```sql
CREATE SCHEMA game;

-- Enum SQL names are final — PostGraphile 5 typeCodecName ignores @name tags on types
-- (n8n-parallel-engine lesson). Values are lowercase snake; GraphQL mirrors UPPERCASE.
CREATE TYPE game.game_status       AS ENUM ('lobby', 'in_progress', 'complete', 'abandoned');
CREATE TYPE game.game_type_status  AS ENUM ('live', 'coming_soon', 'retired');
CREATE TYPE game.player_kind       AS ENUM ('human', 'machine_algorithm', 'machine_agent');
CREATE TYPE game.game_event_type   AS ENUM ('setup', 'move', 'resign');
CREATE TYPE game.game_event_status AS ENUM ('pending', 'applied', 'rejected');
CREATE TYPE game.seat_outcome      AS ENUM ('won', 'lost', 'drew');
```

### `game.game_type` — the game-type registry (reference table, seeded; NOT an enum)

Game types are **rows, not enum values** (locked 2026-07-19) — adding a game becomes a seed
row + engine module, and per-type rules (seat bounds, machine support, availability) are data
the DB can enforce at create time.

```sql
CREATE TABLE game.game_type (
  id citext PRIMARY KEY,            -- 'battleship', 'tic_tac_toe', 'checkers' (referee dispatch key)
  name citext NOT NULL,             -- 'Battleship'
  description text,
  icon citext,                      -- i-lucide-* (game UI; nav tool rows carry their own — R14)
  ordinal int NOT NULL DEFAULT 0,   -- display order
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
```

Seed rows (in the deploy change — global reference data, tenant-agnostic, no write API):

| id | name | icon | ordinal | status | min/max seats | supported_player_kinds | default_config |
|---|---|---|---|---|---|---|---|
| `battleship` | Battleship | `i-lucide-ship` | 0 | `live` | 2 / 2 | `{human, machine_algorithm, machine_agent}` | `{"boardSize": 10}` |
| `tic_tac_toe` | Tic-Tac-Toe | `i-lucide-hash` | 1 | `coming_soon` | 2 / 2 | `{human}` | `{}` |
| `checkers` | Checkers | `i-lucide-circle-dot` | 2 | `coming_soon` | 2 / 2 | `{human}` | `{}` |

RLS enabled with a global read policy (`FOR SELECT USING (true)` — reference data, nothing
secret); no INSERT/UPDATE/DELETE policies (registry management is seed/deploy-only for now).

### `game.game` — the agnostic game record (registered business table)

```sql
CREATE TABLE game.game (
  id uuid NOT NULL DEFAULT res_fn.uuid_generate_v7() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES app.tenant(id),
  game_type_id citext NOT NULL REFERENCES game.game_type(id),
  status game.game_status NOT NULL DEFAULT 'lobby',
  seat_count int NOT NULL,
  expecting_seats int[] NOT NULL DEFAULT '{}',  -- seats the game awaits events from ('{}' in lobby/terminal);
                                                --   referee-owned; length 1 for 1v1, >1 in simultaneous phases
  event_count int NOT NULL DEFAULT 0,           -- applied events (= max event_number)
  urn text NOT NULL
    GENERATED ALWAYS AS (res_fn.build_urn(tenant_id, 'game', 'game', id)) STORED,
  CONSTRAINT uq_game_urn UNIQUE (urn),
  CONSTRAINT chk_game_seat_count CHECK (seat_count >= 2),
  created_at timestamptz NOT NULL DEFAULT current_timestamp,
  updated_at timestamptz NOT NULL DEFAULT current_timestamp,
  finished_at timestamptz
);
CREATE INDEX idx_game_tenant ON game.game (tenant_id);
CREATE INDEX idx_game_game_type ON game.game (game_type_id);
```

**No game-type-specific columns, no per-seat columns** — seats live in the `game.game_player`
roster (below), so game types with any player count need zero DDL. URN registration per the
urn-registry spec: deferred FK `(id) REFERENCES res.resource(id)`,
`res_fn.register_resource(id, tenant_id, 'game', 'game')` in the `_fn` create path, and a
`game` row in `res.module_permission`.

### `game.game_player` — the seat roster (N-seat model)

```sql
CREATE TABLE game.game_player (
  id uuid NOT NULL DEFAULT res_fn.uuid_generate_v7() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES app.tenant(id),
  game_id uuid NOT NULL REFERENCES game.game(id) ON DELETE CASCADE,
  seat int NOT NULL CHECK (seat >= 1),
  player_kind game.player_kind NOT NULL DEFAULT 'human',
  resident_urn text REFERENCES res.resource(urn),   -- NULL ⟺ machine seat
  outcome game.seat_outcome,                        -- NULL until the game completes; per-seat
                                                    --   (there is NO game.winner_seat — blackjack/trivia
                                                    --   resolve per seat; draws are 'drew')
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
```

- Seats are `1..seat_count`; **seat 1 is always the creator (human)**. The creator seats
  everyone at create time (locked decision — no join/lobby ceremony); the roster is immutable
  after create except `resigned_at`.
- **Machine seats**: `player_kind` is `machine_algorithm`/`machine_agent`, `resident_urn`
  NULL. Per-game-type legality (seat bounds, machine support, availability) is enforced by
  `game_fn.create_game` against the `game.game_type` registry row; engine-level roster rules
  remain the referee's (setup `abort` as defense-in-depth).
- A resident holds at most one seat per game (partial unique index).
- Unregistered child table (msg.message precedent).

### `game.game_event` — the event log (the source of truth)

```sql
CREATE TABLE game.game_event (
  id uuid NOT NULL DEFAULT res_fn.uuid_generate_v7() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES app.tenant(id),
  game_id uuid NOT NULL REFERENCES game.game(id) ON DELETE CASCADE,
  event_type game.game_event_type NOT NULL DEFAULT 'move',
  seat int CHECK (seat >= 1),                        -- NULL for system events (setup)
  event_number int,                                  -- dense 1..N, assigned by the referee on apply
  event_data jsonb NOT NULL,                         -- raw payload as submitted, e.g. {"row":3,"col":4};
                                                     --   NEVER the secret state — setup carries only a
                                                     --   non-secret marker (this table is tenant-readable
                                                     --   once applied); see the note below
  status game.game_event_status NOT NULL DEFAULT 'pending',
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT current_timestamp,
  applied_at timestamptz,
  CONSTRAINT uq_game_event_number UNIQUE (game_id, event_number)
);
CREATE UNIQUE INDEX uq_game_event_pending
  ON game.game_event (game_id, seat) WHERE status = 'pending';  -- ONE pending event per seat per game
CREATE INDEX idx_game_event_game ON game.game_event (game_id, status, created_at);
CREATE INDEX idx_game_event_tenant ON game.game_event (tenant_id);
```

- **Every state change is an event row** — setup (system, seat NULL), human moves, machine
  moves, resigns. Applied events form the dense replayable sequence `event_number 1..N`.
- **`event_data` is never the authoritative/secret record — `game_event` is tenant-readable
  once applied** (RLS below), so nothing that must stay hidden may land in it. A `move`'s
  `event_data` (`{row, col}`) is fine — shots are public knowledge in battleship — but the
  **`setup` event's `event_data` is a non-secret marker only** (`{gameType, boardSize}`),
  never the generated fleet layout. The real replay/authoritative record is
  `stateAfter`/`viewsAfter`, written **only** to the deny-all `game_event_state` table below
  — that is what makes the stream replayable, not `event_data`. (Caught live during
  implementation verification: a cross-seat RLS check showed both fleets leaking through
  `event_data` before this was locked down — the fix is the rule stated here.)
- **One pending event per seat** (partial unique index — a hard invariant, not a soft check);
  multiple seats may have pending events at once during simultaneous phases.
- **Pending visibility rule**: a pending event's payload is visible only to its submitting
  seat (RLS below). Simultaneous-submission games (blackjack bets, trivia answers) hold
  submissions `pending` until the phase completes, then the referee applies them together —
  applied `move` event data is public (never secret for battleship-shaped games; a future
  game type whose *moves* carry secret data would need its own redaction, same as setup).
- Unregistered child table (msg.message precedent).

### `game.game_event_state` — deny-all per-event snapshots (`auth.session` pattern)

```sql
CREATE TABLE game.game_event_state (
  event_id uuid NOT NULL PRIMARY KEY REFERENCES game.game_event(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES game.game(id) ON DELETE CASCADE,
  event_number int NOT NULL,
  game_state_after jsonb NOT NULL,    -- authoritative engine state AFTER this event (ship positions!)
  player_views_after jsonb NOT NULL,  -- { "1": <view>, "2": <view>, ... } redacted per seat, AFTER this event
  created_at timestamptz NOT NULL DEFAULT current_timestamp,
  CONSTRAINT uq_game_event_state_number UNIQUE (game_id, event_number)
);
ALTER TABLE game.game_event_state ENABLE ROW LEVEL SECURITY;  -- NO policies
REVOKE ALL ON game.game_event_state FROM anon, authenticated, service_role;
```

One row per **applied** event (rejected events snapshot nothing). **Current state** = the row
with the max `event_number`; **replay forward/backward** = walk `event_number` and read the
caller's seat view at each step — no engine in the replay path, immune to engine-version
drift (locked decision: snapshots over deterministic re-fold). Only SECURITY DEFINER
`game_fn.*` functions read/write it; smart-tag `behavior: '-*'` to keep it out of the graph
entirely.

### pg_notify trigger (sockets-pattern conventions)

```sql
CREATE OR REPLACE FUNCTION game_fn.tg__on_game_update()
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
```

Channel: `game:{gameId}:state`; payload `{ event: 'update', id }` — minimal, never business
data. Every referee write updates `game.game` (at minimum `event_count`/`updated_at`), so
notifies fire per referee write batch (clients refetch idempotently).

---

## `game_fn` — internal logic

### Granted to `n8n_worker` (SECURITY DEFINER, `search_path` pinned `pg_catalog, public`)

| Function | Signature | Purpose |
|---|---|---|
| `engine_context` | `(_game_id uuid) → jsonb` | Everything the referee needs in one read: the `game.game` row (summary fields incl. `expecting_seats`, `event_count`), the **`game_type` registry row** (id, seat bounds, `supported_player_kinds`, `default_config`), the **seat roster** (`game_player` rows: seat, kind, outcome, resigned), the **latest applied snapshot** (`game_state`, `player_views` from `game_event_state` at max `event_number`; null before setup), and **all `pending` events** (oldest first — several seats may have one). Shape: `{ "game": {...}, "gameType": {...}, "players": [...], "gameState": {...} \| null, "playerViews": {...} \| null, "pendingEvents": [{ "id": ..., "eventType": ..., "seat": ..., "eventData": ... }, ...] }` |
| `record_referee_result` | `(_game_id uuid, _result jsonb) → jsonb` | Applies the whole referee output **atomically and serially**: takes `pg_advisory_xact_lock` on the game id, reads `game.game … FOR UPDATE`, then compares `_result.expectedEventCount` (the `event_count` the referee assumed when it read `engine_context`) against the just-read `event_count` — **any mismatch discards the entire result as a stale noop**, untouched. This is the real double-apply guard (locked down after live testing showed the per-`apply`-action "still pending" re-check alone is insufficient: two concurrent executions can each independently compute and insert their OWN `system`/`machine` event from a stale read without ever re-touching the same player event — the per-row check never catches that). Only once the version check passes does it walk the ordered `actions` list (contract below): assigns dense `event_number`s, marks events applied/rejected, inserts system/machine event rows, writes one `game_event_state` snapshot per applied action, then updates `game.game` (`status`, `expecting_seats`, `event_count`, `finished_at`, `updated_at`) and, on completion, each seat's `game_player.outcome`. Returns `{ "recorded": true, "appliedEvents": n, "gameStatus": ... }` (or `{ "recorded": false, "noop": true, "reason": "stale_context" }`) |

`record_referee_result` input contract (produced by the referee Code node —
`game-event.workflow.data.md`):

```jsonc
{
  // Ordered list — each action becomes (at most) one event-log write, in sequence.
  // Empty list = noop (rogue/duplicate trigger). Every "applies" action carries its own
  // post-event snapshot (stateAfter/viewsAfter) — the per-event replay record, written ONLY
  // to the deny-all game_event_state table.
  "actions": [
    { "kind": "system",  "eventType": "setup",              // referee-originated event (seat NULL)
      "eventData": { "gameType": "battleship", "boardSize": 10 }, // NON-SECRET marker only —
                                                              //   game_event is tenant-readable once
                                                              //   applied; the generated fleet layout
                                                              //   goes ONLY into stateAfter (deny-all)
      "stateAfter": { ... }, "viewsAfter": { "1": {...}, "2": {...} } },
    { "kind": "apply",   "eventId": "<uuid>",            // a pending player event, validated OK
      "stateAfter": { ... }, "viewsAfter": { ... } },
    { "kind": "reject",  "eventId": "<uuid>",            // a pending event that failed validation
      "rejectionReason": "not_expected" },               //   (no event_number, no snapshot)
    { "kind": "machine", "seat": 2, "eventType": "move", // machine seat's event (inserted + applied)
      "eventData": { "row": 4, "col": 7 },               //   moves are never secret in battleship
      "stateAfter": { ... }, "viewsAfter": { ... } }
  ],
  "expectingSeats": [1],                    // the game's next expectation ([] when terminal)
  "gameStatus": "in_progress" | "complete" | "abandoned",
  "expectedEventCount": 3,                  // ctx.game.eventCount at read time — the referee's
                                             //   optimistic-concurrency stamp (see record_referee_result)
  "abortReason": "illegal_roster",          // only with gameStatus 'abandoned' at setup
  "outcomes": { "1": "won", "2": "lost" }   // per-seat, only with gameStatus 'complete' (draws: 'drew')
}
```

### Internal (called from `game_api` with jwt values as parameters — never `jwt.*` inside)

| Function | Notes |
|---|---|
| `game_fn.create_game(_tenant_id, _creator_resident_urn, _game_type_id, _players jsonb)` | `_players` is the seats **2..N** array `[{ "kind": "human" \| "machine_algorithm" \| "machine_agent", "residentUrn": "..."? }, ...]` — the creator is always seat 1 (human). Validates against the **`game.game_type` registry row**: type exists and `status = 'live'` (raise `30003: GAME TYPE NOT AVAILABLE`), `seat_count` within `min/max_player_seats` (raise `30004: INVALID SEAT COUNT`), every machine kind ∈ `supported_player_kinds` (raise `30005: PLAYER KIND NOT SUPPORTED`); plus structural checks: human entries name distinct residents of the tenant (≠ creator), machine entries have no urn. Inserts `game.game` (status `lobby`, `seat_count = 1 + array_length`, `expecting_seats '{}'`) + the `game.game_player` rows; `res_fn.register_resource`. No snapshot row yet — the setup **event** becomes event 1. (The referee's setup `abort` remains as defense-in-depth for engine-level roster legality) |
| `game_fn.submit_event(_game_id, _resident_urn, _event_data)` | Resolves the caller's seat via `game.game_player` (raise `30000: NOT AUTHORIZED` if not seated); fail-fast pre-checks: status `in_progress` (raise `30002: GAME NOT IN PROGRESS`), caller's seat ∈ `expecting_seats` (raise `30001: EVENT NOT EXPECTED`); inserts the `pending` `move` event row — the one-pending-per-seat partial unique index is the **hard** guard (a violation also surfaces as `30001`). **The referee is authoritative** — pre-checks just fail fast |
| `game_fn.resign_game(_game_id, _resident_urn)` | **Resign is an event, not a direct update** (the log has no holes): seated, unresigned caller (else `30000`) gets any pending event of theirs rejected (`superseded_by_resign`) and a `pending` `resign` event inserted — accepted regardless of `expecting_seats`. The composable then triggers the referee (`op: 'event'`), which applies it generically: `resigned_at`, `expecting_seats` recomputed without the resigned seat, and when one active seat remains → `complete` + per-seat outcomes (in v1's 2-seat games every resign ends the game; machines never resign) |
| `game_fn.player_view(_game_id, _resident_urn, _event_number int DEFAULT NULL) → jsonb` | SECURITY DEFINER read of the caller's seat view **at any point in the event stream**: seat resolved via `game.game_player`, then `player_views_after -> seat::text` from the `game_event_state` row at `_event_number` (NULL → latest). Raise `30000` if not seated; NULL before setup / unknown event number. This one function powers live play **and** the replay scrubber (forward = increment, backward = decrement) |

## `game_api` — PostGraphile surface (SECURITY INVOKER)

All gate `jwt.enforce_any_permission('{p:app-user,p:app-admin}'::citext[])` first, then
delegate, passing `jwt.tenant_id()` and the caller's resident urn
(`res_fn.build_urn(jwt.tenant_id(), 'app', 'resident', jwt.resident_id())` — the
`app.resident.urn` generated-column formula).

| Function | Maps to | GraphQL (verify generated names in GraphiQL before writing documents) |
|---|---|---|
| `game_api.create_game(_game_type_id citext, _players jsonb) → game.game` | `game_fn.create_game` (`_players` = seats 2..N, shape above; caller becomes seat 1) | `createGame` mutation |
| `game_api.submit_event(_game_id uuid, _event_data jsonb) → game.game_event` | `game_fn.submit_event` | `submitEvent` mutation |
| `game_api.resign_game(_game_id uuid) → game.game_event` | `game_fn.resign_game` (returns the pending resign event) | `resignGame` mutation |
| `game_api.my_games(_game_type_id citext DEFAULT NULL) → SETOF game.game` | direct select: games where the caller's urn holds a seat (`EXISTS` against `game.game_player`; RLS also applies), `ORDER BY created_at DESC` | `myGamesList` query |
| `game_api.game_view(_game_id uuid, _event_number int DEFAULT NULL) → jsonb` | `game_fn.player_view` | `gameView` query — the caller's redacted view blob at `_event_number` (NULL = live); the replay scrubber calls it per step |

## RLS (R9)

```sql
ALTER TABLE game.game_type ENABLE ROW LEVEL SECURITY;
CREATE POLICY view_all ON game.game_type FOR SELECT USING (true);
-- reference data: no write policies (seed/deploy-only)

ALTER TABLE game.game ENABLE ROW LEVEL SECURITY;
CREATE POLICY view_all_for_tenant ON game.game FOR SELECT
  USING (jwt.has_permission('p:app-user', tenant_id)
      OR jwt.has_permission('p:app-admin', tenant_id));
-- No INSERT/UPDATE policies — writes only via SECURITY DEFINER game_fn.*

ALTER TABLE game.game_player ENABLE ROW LEVEL SECURITY;
CREATE POLICY view_all_for_tenant ON game.game_player FOR SELECT
  USING (jwt.has_permission('p:app-user', tenant_id)
      OR jwt.has_permission('p:app-admin', tenant_id));

ALTER TABLE game.game_event ENABLE ROW LEVEL SECURITY;
-- Applied/rejected events are tenant-readable; a PENDING event is visible ONLY to its
-- submitting seat (simultaneous-submission games must not leak held bets/answers).
CREATE POLICY view_for_tenant ON game.game_event FOR SELECT
  USING ((jwt.has_permission('p:app-user', tenant_id)
       OR jwt.has_permission('p:app-admin', tenant_id))
     AND (status <> 'pending'
       OR EXISTS (select 1 from game.game_player gp
                   where gp.game_id = game_event.game_id
                     and gp.seat = game_event.seat
                     and gp.resident_urn = res_fn.build_urn(jwt.tenant_id(), 'app', 'resident', jwt.resident_id()))));

-- game.game_event_state: RLS enabled, ZERO policies + explicit revoke (deny-all, above)
```

Tenant-scoped SELECT matches msg (summaries are not secret; the secret state is in the
deny-all table). Schema-level broad grants + policy restriction per house pattern
(`fnb-msg` policies precedent).

## `n8n_worker` grants (in `fnb-game`'s policies change — owning-package pattern)

| Grant | Purpose |
|---|---|
| `USAGE` on schemas `game`, `game_fn` | referee reads/writes |
| `EXECUTE` on `game_fn.engine_context(uuid)`, `game_fn.record_referee_result(uuid, jsonb)` | the entire n8n surface — nothing else |

## PostGraphile exposure

- `pgServices.schemas` += `game, game_api` (`apps/graphql-api-app/server/graphile.config.ts`).
- Smart tags (`postgraphile.tags.json5`):
  - `'game.game_event_state': { tags: { behavior: '-*' } }` — never in the graph.
  - `'game.game': { tags: { behavior: '-query:resource:list -query:resource:connection' } }` —
    list reads go through `game_api.my_games`; single-row lookup stays for the detail page.
  - `'game.game_event'`: root list/connection drop, but the **`Game.gameEvents` relation
    stays** — the replay scrubber and any history panel read the applied-event sequence
    through it (RLS hides other seats' pending payloads); single lookup kept for the
    submit-event return.
  - `'game.game_player'`: same root list/connection drop — the roster is read through the
    `Game.gamePlayers` relation (FK-derived nested list) on the list/detail documents.
  - `'game.game_type'`: **keep** the root list (`gameTypeList` — the registry powers the New
    Game modal and any future Games hub); reference data, read-only surface.
- No type renames needed (no `Game*` collisions in the current schema), but **verify generated
  names in GraphiQL before writing `.graphql` documents** (house convention; `game.game` →
  type `Game`, `game.game_type` → type `GameType` is the expectation — note `GameType` is now
  an **object type**, not an enum; the `game_type_id` argument/field is citext → `String`).

---

## State-shape contracts (jsonb — engine-owned, DB-agnostic)

### `game_state_after` (authoritative snapshot per event; battleship)

```jsonc
{
  "gameType": "battleship",
  "boardSize": 10,
  "seats": {
    "1": { /* engine GameState — seat 1's OWN fleet board (battleship.ts), hits as string[] */ },
    "2": { /* engine GameState — seat 2's fleet board */ }
  }
}
```

The `seats` map is keyed by seat number as a string — the generic contract holds any number of
seats; **battleship requires exactly 2** (enforced at create against the registry's seat
bounds; the referee's setup `abort` is defense-in-depth). `boardSize` comes from the
registry's `default_config`. One
user-supplied engine `GameState` per seat (the seat's own hidden fleet). A shot by seat 1
is `applyMove` on `seats["2"]`. A seat whose board reaches `status: 'won'` has **lost** (all
their ships sunk) — outcomes: that seat `lost`, the other `won`. `PlacedShip.hits` dehydrates
`Set<string>` → `string[]` (README locked decision). Expectation/outcome/status live on
`game.game`/`game_player` columns, not in the blob — the referee returns them separately in
`record_referee_result` (`expectingSeats`, `outcomes`). Battleship's expectation is always
**one seat, round-robin ascending** (skipping resigned seats — for 2 seats, strict
alternation); simultaneous-phase games return several seats in `expectingSeats` and the
engine decides when the phase resolves.

### `player_views_after` (redacted snapshot per event; what each seat may see)

```jsonc
{
  "1": {
    "seat": 1,
    "boardSize": 10,
    "you": {
      "board": [ ["empty"|"ship"|"hit"|"miss"|"sunk", ...] ],   // own fleet overlaid with incoming shots
      "fleet": [ { "name": "Carrier", "size": 5, "hitCount": 2, "sunk": false }, ... ]
    },
    "opponent": {
      "board": [ ["unknown"|"hit"|"miss"|"sunk", ...] ],        // ONLY your shot results — no ships
      "sunkShips": [ { "name": "Destroyer", "size": 2 } ]
    }
  },
  "2": { /* mirror image */ }
}
```

One entry per seat (machine seats included — keyed by seat number as a string). Computed by
the engine wrapper (`packages/game-engines`) on every referee write. A machine seat selects
moves from **its own seat's view** — identical information to a human player. fnb-types
mirrors these shapes (below).

---

## `triggerWorkflow` registry entry (R22)

`apps/graphql-api-app/server/graphile/trigger-workflow.plugin.ts`:

```ts
// Any-of gate (array form) — mirrors the game module's DB/RLS/nav gate
// `jwt.enforce_any_permission('{p:app-user,p:app-admin}')`. An admin without p:app-user can
// create and play a game, so must also be able to trigger the referee. A single-string
// `permission` would lock those admins out of the referee after they'd already moved.
'game-event': { engine: 'n8n', permission: ['p:app-user', 'p:app-admin'] }
```

Input from composables: `{ op: 'setup' | 'event', gameId }` (plugin injects
`tenantId`/`profileId` as always). Called after `createGame` (op `setup`) and after
`submitEvent`/`resignGame` (op `event`). A trigger with no pending events / no lobby to set
up is a referee no-op, and `record_referee_result`'s advisory-lock + still-pending re-check
makes concurrent duplicates harmless (safe against rogue/duplicate calls; also the recovery
path — re-trigger to process stranded pending events).

---

## Client layer (R1/R3/R4)

### fnb-types (`packages/fnb-types/src/game.ts` + `src/games/battleship-view.ts`, + barrel)

```ts
// game.ts — enums mirror GraphQL verbatim (UPPERCASE). game_type is NOT an enum — ids are
// lowercase citext registry keys that pass through as strings.
export type GameTypeId = 'battleship' | 'tic_tac_toe' | 'checkers'  // known ids; the registry can grow
export type GameTypeStatus = 'LIVE' | 'COMING_SOON' | 'RETIRED'
export type GameStatus = 'LOBBY' | 'IN_PROGRESS' | 'COMPLETE' | 'ABANDONED'
export type PlayerKind = 'HUMAN' | 'MACHINE_ALGORITHM' | 'MACHINE_AGENT'
export type GameEventType = 'SETUP' | 'MOVE' | 'RESIGN'
export type GameEventStatus = 'PENDING' | 'APPLIED' | 'REJECTED'
export type SeatOutcome = 'WON' | 'LOST' | 'DREW'

export interface GameTypeInfo {
  id: GameTypeId
  name: string
  description: string | null
  icon: string | null
  ordinal: number
  status: GameTypeStatus
  minPlayerSeats: number
  maxPlayerSeats: number
  supportedPlayerKinds: PlayerKind[]
  defaultConfig: unknown
}

export interface GamePlayer {
  seat: number
  playerKind: PlayerKind
  residentUrn: string | null   // null ⟺ machine seat
  outcome: SeatOutcome | null  // null until the game completes
  resignedAt: Date | null
}

// createGame input vocabulary — seats 2..N (caller becomes seat 1)
export interface NewGamePlayer {
  kind: PlayerKind
  residentUrn?: string   // required for HUMAN, absent for machine kinds
}

export interface GameSummary {
  id: string
  tenantId: string
  gameTypeId: GameTypeId
  status: GameStatus
  seatCount: number
  players: GamePlayer[]        // from the Game.gamePlayers relation, ordered by seat
  expectingSeats: number[]     // seats the game awaits events from ([] in lobby/terminal)
  eventCount: number           // applied events = max event number (the scrubber's upper bound)
  createdAt: Date
  finishedAt: Date | null
}

export interface GameEvent {
  id: string
  gameId: string
  eventType: GameEventType
  seat: number | null          // null for system events (setup)
  eventNumber: number | null   // dense 1..N once applied
  eventData: unknown
  status: GameEventStatus
  rejectionReason: string | null
  createdAt: Date
}

// games/battleship-view.ts — mirrors the player_views seat shape
export type BattleshipOwnCell = 'empty' | 'ship' | 'hit' | 'miss' | 'sunk'
export type BattleshipTargetCell = 'unknown' | 'hit' | 'miss' | 'sunk'
export interface BattleshipFleetEntry { name: string; size: number; hitCount: number; sunk: boolean }
export interface BattleshipPlayerView {
  seat: number
  boardSize: number
  you: { board: BattleshipOwnCell[][]; fleet: BattleshipFleetEntry[] }
  opponent: { board: BattleshipTargetCell[][]; sunkShips: Array<{ name: string; size: number }> }
}
```

(View-shape types are shared vocabulary across the engine package, the workflow contract, and
the UI — they are plain type declarations, so fnb-types remains type-only.)

### graphql-client-api

- Documents `src/graphql/game/`: `query/myGames.graphql`, `query/gameById.graphql` (single
  lookup + `gameView(gameId, eventNumber)` jsonb + the `gameEvents` relation in one document),
  `query/gameViewAt.graphql` (just `gameView` at an event number — the scrubber's step query),
  `query/gameTypes.graphql` (the registry list, ordered by `ordinal`),
  `mutation/createGame.graphql`, `mutation/submitEvent.graphql`,
  `mutation/resignGame.graphql`. The existing `triggerWorkflow` document is reused. Both game
  queries select the nested `gamePlayers` relation (seat roster) alongside the `Game` summary
  fields.
- Mappers: `src/mappers/game.ts` (`toGameSummary` — includes mapping the nested roster to
  `GamePlayer[]` ordered by seat, `toGameEvent`, `toGameTypeInfo`) — un-Maybe, `Date`
  coercion, enum pass-through (R3).
- Composables (+ **barrel lines in `src/index.ts`**): `src/composables/useGames.ts` (list +
  create+setup-trigger), `src/composables/useGame.ts` (hybrid: query + WS + submit/resign +
  **replay scrubber state** — per-page `.data.md` files), `src/composables/useGameTypes.ts`
  (registry list → `GameTypeInfo[]`; powers the New Game modal's machine-kind gating).
  Opponent display names resolve via the shared residents list (`ActiveTenantResidents` — msg
  precedent).
- Tenant-app re-exports: `apps/tenant-app/app/composables/useGames.ts`, `useGame.ts`,
  `useGameTypes.ts`.

---

## WebSocket layer (sockets-pattern; details in `infrastructure.md`)

- Handler: `packages/game-layer/server/routes/_ws/games/[id].ts` — `upgrade` validates the
  session cookie/claims (msg-layer `getWsUpgradeClaims` pattern), `open` LISTENs
  `game:{id}:state` via the layer's pg-notify bridge, `close` unlistens.
- Client URL: `${protocol}//${location.host}/game/_ws/games/${id}` (nginx `/game` → game-app;
  cross-app exactly like tenant-app msg → `/msg/_ws/...`).
- On notify the composable re-executes the GraphQL detail query with
  `requestPolicy: 'network-only'` — **no REST carve-out** (README locked decision).
- Reconnect on abnormal close after 2 s; close `1000` in `onUnmounted`.

---

## Navigation (R14)

New module appended to the application seed in `db/fnb-app/deploy/00000000010240_app_fn.sql`
(edit-in-place; dev rebuilds from scratch), after the existing modules:

```sql
row('games'::citext, 'Games'::citext, '{"p:app-user","p:app-admin"}'::citext[],
    'i-lucide-gamepad-2'::citext, <next ordinal>,
  array[
    row('games-battleship'::citext,'Battleship'::citext,'{"p:app-user","p:app-admin"}'::citext[],'i-lucide-ship'::citext,'/tenant/games/battleship',0)::app_fn.tool_info
   ,row('games-tic-tac-toe'::citext,'Tic-Tac-Toe'::citext,'{"p:app-user","p:app-admin"}'::citext[],'i-lucide-hash'::citext,'/tenant/games/tic-tac-toe',1)::app_fn.tool_info
   ,row('games-checkers'::citext,'Checkers'::citext,'{"p:app-user","p:app-admin"}'::citext[],'i-lucide-circle-dot'::citext,'/tenant/games/checkers',2)::app_fn.tool_info
  ]::app_fn.tool_info[]
)::app_fn.module_info
```

(Match the exact `module_info` field order in the file — the snippet shows intent. All four
icons verified in lucide: `gamepad-2`, `ship`, `hash`, `circle-dot`.)

---

## Security model

| Property | Enforcement |
|---|---|
| Players cannot see hidden fleets — live **or in replay** | Every `game_state_after`/`player_views_after` snapshot lives in deny-all `game.game_event_state` (RLS, zero policies, revoked, `-*` behavior); reads only via `game_fn.player_view(game, resident, event_number)`, which returns **only the caller's seat view** at any event |
| Pending submissions don't leak | RLS on `game.game_event` hides `pending` rows from everyone but the submitting seat — simultaneous-phase submissions (bets, answers) stay secret until the referee applies the phase |
| Client cannot forge state | All writes are SECURITY DEFINER `game_fn.*`; no INSERT/UPDATE policies on any game table; the engine runs only in the referee (n8n), never in the browser |
| Event authority | `submit_event` records intent (hard-guarded to one pending per seat); the referee validates (seat expected, legality) against `engine_context` and rejects with a reason — client pre-checks are fail-fast UX only (R13 analog) |
| No double-apply | `record_referee_result` serializes per game (`pg_advisory_xact_lock`) and re-checks events are still `pending` — concurrent duplicate executions become recorded noops |
| Machine fairness | Each machine seat (algorithm or agent) selects from **its own seat's** redacted view; the agent prompt never contains `game_state` |
| n8n blast radius | `n8n_worker` gains exactly two `game_fn` EXECUTEs; no table SELECTs, no other schemas (mirrors the dataset-sync grant discipline) |
| Rogue triggers | `game-event` registry entry gated `p:app-user`; a trigger without a lobby/pending events no-ops in the referee |
| Tenant isolation | RLS tenant-scoped SELECTs; `_fn` functions validate resident urns belong to `_tenant_id`; `tenant_id` recorded on every row and on `n8n.workflow_run` via the trigger payload |
| WS surface | Session-validated upgrade; socket carries only `{ event, id }` pings — data flows through GraphQL/RLS on refetch |
