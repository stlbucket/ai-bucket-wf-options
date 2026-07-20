---
name: game-server-shared
description: Shared data architecture for the game server — the db/fnb-game package (agnostic game record + deny-all engine state + move log), state-shape contracts, pg_notify channels, n8n_worker grants, the game-move registry entry, PostGraphile exposure, fnb-types, composables, and the security model.
---

# Game Server — Shared Data

## Status
Draft — decisions locked 2026-07-19 (see `README.md`). No `[FILL IN]` markers.

Referenced by all `game-server/*.data.md` files. Do not duplicate here.

---

## Architecture at a glance

```
tenant-app page ──composable (R1)──▶ PostGraphile (game_api)          ── create_game / submit_move / resign / my_games / game_view
        │                               │
        │                               └─ triggerWorkflow('game-move', { op, gameId })   (R22 registry, engine: 'n8n')
        │                                        │ POST /webhook/game-move  (X-Fnb-Webhook-Secret)
        │                                        ▼
        │                               n8n `game-move` workflow (the REFEREE)
        │                                 engine_context ── Code node: engine (battleship.ts) ──▶ record_referee_result
        │                                        │ as n8n_worker (SECURITY DEFINER game_fn.*)
        │                                        ▼
        │                               game.game UPDATE ──trigger──▶ pg_notify('game:{id}:state', {event,id})
        │                                                                       │
        └── WS  /game/_ws/games/{id}  (game-layer LISTEN bridge) ◀──────────────┘
            on notify → re-execute the GraphQL detail query (network-only)
```

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
CREATE TYPE game.game_type        AS ENUM ('battleship', 'tic_tac_toe', 'checkers');
CREATE TYPE game.game_status      AS ENUM ('lobby', 'in_progress', 'complete', 'abandoned');
CREATE TYPE game.opponent_kind    AS ENUM ('user', 'machine_algorithm', 'machine_agent');
CREATE TYPE game.game_move_status AS ENUM ('pending', 'applied', 'rejected');
```

### `game.game` — the agnostic game record (registered business table)

```sql
CREATE TABLE game.game (
  id uuid NOT NULL DEFAULT res_fn.uuid_generate_v7() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES app.tenant(id),
  game_type game.game_type NOT NULL,
  opponent_kind game.opponent_kind NOT NULL,
  status game.game_status NOT NULL DEFAULT 'lobby',
  player_one_resident_urn text NOT NULL REFERENCES res.resource(urn),  -- seat 1 (creator)
  player_two_resident_urn text REFERENCES res.resource(urn),           -- seat 2; NULL when vs machine
  current_turn_seat int CHECK (current_turn_seat IN (1, 2)),           -- NULL in lobby/terminal
  winner_seat int CHECK (winner_seat IN (1, 2)),                       -- NULL until complete
  move_count int NOT NULL DEFAULT 0,
  urn text NOT NULL
    GENERATED ALWAYS AS (res_fn.build_urn(tenant_id, 'game', 'game', id)) STORED,
  CONSTRAINT uq_game_urn UNIQUE (urn),
  created_at timestamptz NOT NULL DEFAULT current_timestamp,
  updated_at timestamptz NOT NULL DEFAULT current_timestamp,
  finished_at timestamptz
);
CREATE INDEX idx_game_tenant ON game.game (tenant_id);
CREATE INDEX idx_game_p1 ON game.game (player_one_resident_urn);
CREATE INDEX idx_game_p2 ON game.game (player_two_resident_urn);
```

**No game-type-specific columns.** URN registration per the urn-registry spec: deferred FK
`(id) REFERENCES res.resource(id)`, `res_fn.register_resource(id, tenant_id, 'game', 'game')`
in the `_fn` create path, and a `game` row in `res.module_permission`.

**Machine games**: the machine occupies seat 2; `player_two_resident_urn IS NULL` and
`opponent_kind` distinguishes algorithm vs agent.

### `game.game_engine_state` — deny-all secret state (`auth.session` pattern)

```sql
CREATE TABLE game.game_engine_state (
  game_id uuid NOT NULL PRIMARY KEY REFERENCES game.game(id) ON DELETE CASCADE,
  game_state jsonb NOT NULL DEFAULT '{}'::jsonb,    -- authoritative engine state (ship positions!)
  player_views jsonb NOT NULL DEFAULT '{}'::jsonb,  -- { "1": <view>, "2": <view> } redacted per seat
  updated_at timestamptz NOT NULL DEFAULT current_timestamp
);
ALTER TABLE game.game_engine_state ENABLE ROW LEVEL SECURITY;  -- NO policies
REVOKE ALL ON game.game_engine_state FROM anon, authenticated, service_role;
```

Only SECURITY DEFINER `game_fn.*` functions read/write it. It is **not** added to the
PostGraphile schema surface (it lives in schema `game`, so additionally smart-tag it
`behavior: '-*'` to keep it out of the graph entirely).

### `game.game_move` — the move log

```sql
CREATE TABLE game.game_move (
  id uuid NOT NULL DEFAULT res_fn.uuid_generate_v7() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES app.tenant(id),
  game_id uuid NOT NULL REFERENCES game.game(id) ON DELETE CASCADE,
  seat int NOT NULL CHECK (seat IN (1, 2)),
  move_number int,                                   -- assigned by the referee on apply
  move_data jsonb NOT NULL,                          -- raw move as submitted, e.g. {"row":3,"col":4}
  status game.game_move_status NOT NULL DEFAULT 'pending',
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT current_timestamp,
  applied_at timestamptz
);
CREATE INDEX idx_game_move_game ON game.game_move (game_id, status, created_at);
CREATE INDEX idx_game_move_tenant ON game.game_move (tenant_id);
```

Move rows are not secret (battleship shots surface as hit/miss in the views anyway).
Unregistered child table (msg.message precedent).

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
data. Every referee write updates `game.game` (at minimum `move_count`/`updated_at`), so one
notify fires per applied move (two when a machine reply lands in the same execution — clients
refetch idempotently).

---

## `game_fn` — internal logic

### Granted to `n8n_worker` (SECURITY DEFINER, `search_path` pinned `pg_catalog, public`)

| Function | Signature | Purpose |
|---|---|---|
| `engine_context` | `(_game_id uuid) → jsonb` | Everything the referee needs in one read: the `game.game` row (summary fields), `game_state`, `player_views`, and the **oldest `pending` move** (or null). Shape: `{ "game": {...}, "gameState": {...}, "pendingMove": {...} \| null }` |
| `record_referee_result` | `(_game_id uuid, _result jsonb) → jsonb` | Applies the whole referee output **atomically** (see contract below): updates/creates engine state, marks the pending move applied/rejected (+`move_number`, `applied_at`), inserts+applies the machine reply move if present, updates `game.game` (status, `current_turn_seat`, `winner_seat`, `move_count`, `finished_at`, `updated_at`). Returns `{ "recorded": true, "gameStatus": ... }` |

`record_referee_result` input contract (produced by the referee Code node —
`game-move.workflow.data.md`):

```jsonc
{
  "action": "initialize" | "apply" | "reject" | "noop",
  "moveId": "<uuid>",                  // absent for initialize/noop
  "rejectionReason": "not_your_turn",  // reject only
  "gameState": { ... },                // new authoritative state (initialize/apply)
  "playerViews": { "1": {...}, "2": {...} },
  "currentTurnSeat": 1,
  "gameStatus": "in_progress" | "complete",
  "winnerSeat": null,
  "machineMove": {                     // present when the machine replied in this execution
    "moveData": { "row": 4, "col": 7 },
    "gameState": { ... },              // state AFTER the machine move
    "playerViews": { ... },
    "currentTurnSeat": 1,
    "gameStatus": "in_progress",
    "winnerSeat": null
  }
}
```

### Internal (called from `game_api` with jwt values as parameters — never `jwt.*` inside)

| Function | Notes |
|---|---|
| `game_fn.create_game(_tenant_id, _creator_resident_urn, _game_type, _opponent_kind, _opponent_resident_urn)` | Validates opponent urn is a resident of the tenant when `opponent_kind = 'user'` (must be non-null, ≠ creator) / NULL otherwise; inserts `game.game` (status `lobby`) + empty `game.game_engine_state` row; `res_fn.register_resource` |
| `game_fn.submit_move(_game_id, _resident_urn, _move_data)` | Resolves the caller's seat (raise `30000: NOT AUTHORIZED` if not seated); soft pre-checks (status `in_progress`, caller's turn, no other pending move for the game) — raise `30001: NOT YOUR TURN` / `30002: GAME NOT IN PROGRESS` on failure; inserts the `pending` move row. **The referee is authoritative** — these checks just fail fast |
| `game_fn.resign_game(_game_id, _resident_urn)` | Seated caller resigns: status → `complete`, `winner_seat` → other seat (machine wins a vs-machine resign), `finished_at`; no engine involvement; the update trigger notifies |
| `game_fn.player_view(_game_id, _resident_urn) → jsonb` | SECURITY DEFINER read of the caller's seat view: `player_views -> seat::text` from the deny-all table; raise `30000` if not seated |

## `game_api` — PostGraphile surface (SECURITY INVOKER)

All gate `jwt.enforce_any_permission('{p:app-user,p:app-admin}'::citext[])` first, then
delegate, passing `jwt.tenant_id()` and the caller's resident urn
(`res_fn.build_urn(jwt.tenant_id(), 'app', 'resident', jwt.resident_id())` — the
`app.resident.urn` generated-column formula).

| Function | Maps to | GraphQL (verify generated names in GraphiQL before writing documents) |
|---|---|---|
| `game_api.create_game(_game_type game.game_type, _opponent_kind game.opponent_kind, _opponent_resident_urn text DEFAULT NULL) → game.game` | `game_fn.create_game` | `createGame` mutation |
| `game_api.submit_move(_game_id uuid, _move_data jsonb) → game.game_move` | `game_fn.submit_move` | `submitMove` mutation |
| `game_api.resign_game(_game_id uuid) → game.game` | `game_fn.resign_game` | `resignGame` mutation |
| `game_api.my_games(_game_type game.game_type DEFAULT NULL) → SETOF game.game` | direct select: games where the caller's urn is seat 1 or 2 (RLS also applies), `ORDER BY created_at DESC` | `myGamesList` query |
| `game_api.game_view(_game_id uuid) → jsonb` | `game_fn.player_view` | `gameView` query — the caller's redacted view blob |

## RLS (R9)

```sql
ALTER TABLE game.game ENABLE ROW LEVEL SECURITY;
CREATE POLICY view_all_for_tenant ON game.game FOR SELECT
  USING (jwt.has_permission('p:app-user', tenant_id)
      OR jwt.has_permission('p:app-admin', tenant_id));
-- No INSERT/UPDATE policies — writes only via SECURITY DEFINER game_fn.*

ALTER TABLE game.game_move ENABLE ROW LEVEL SECURITY;
CREATE POLICY view_all_for_tenant ON game.game_move FOR SELECT
  USING (jwt.has_permission('p:app-user', tenant_id)
      OR jwt.has_permission('p:app-admin', tenant_id));

-- game.game_engine_state: RLS enabled, ZERO policies + explicit revoke (deny-all, above)
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
  - `'game.game_engine_state': { tags: { behavior: '-*' } }` — never in the graph.
  - `'game.game': { tags: { behavior: '-query:resource:list -query:resource:connection' } }` —
    list reads go through `game_api.my_games`; single-row lookup stays for the detail page.
  - `'game.game_move'`: same list/connection drop (moves surface through views; keep single
    lookup for the submit-move return).
- No type renames needed (no `Game*` collisions in the current schema), but **verify generated
  names in GraphiQL before writing `.graphql` documents** (house convention; `game.game` →
  type `Game` is the expectation).

---

## State-shape contracts (jsonb — engine-owned, DB-agnostic)

### `game_state` (authoritative; battleship)

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

One user-supplied engine `GameState` per seat (the seat's own hidden fleet). A shot by seat 1
is `applyMove` on `seats["2"]`. A seat whose board reaches `status: 'won'` has **lost** (all
their ships sunk) — `winner_seat` = the other seat. `PlacedShip.hits` dehydrates
`Set<string>` → `string[]` (README locked decision). Turn/winner/status live on `game.game`
columns, not in the blob — the referee returns them separately in `record_referee_result`.

### `player_views` (redacted; what each seat may see)

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

Computed by the engine wrapper (`packages/game-engines`) on every referee write. The machine
selects moves from **its own seat's view** (`player_views["2"]`) — identical information to a
human player. fnb-types mirrors these shapes (below).

---

## `triggerWorkflow` registry entry (R22)

`apps/graphql-api-app/server/graphile/trigger-workflow.plugin.ts`:

```ts
'game-move': { engine: 'n8n', permission: 'p:app-user' }
```

Input from composables: `{ op: 'setup' | 'move', gameId }` (plugin injects
`tenantId`/`profileId` as always). Called after `createGame` (op `setup`) and after
`submitMove` (op `move`). A trigger with no matching lobby/pending-move state is a referee
no-op (safe against rogue/duplicate calls; also the recovery path — re-trigger to process a
stranded pending move).

---

## Client layer (R1/R3/R4)

### fnb-types (`packages/fnb-types/src/game.ts` + `src/games/battleship-view.ts`, + barrel)

```ts
// game.ts — enums mirror GraphQL verbatim (UPPERCASE)
export type GameType = 'BATTLESHIP' | 'TIC_TAC_TOE' | 'CHECKERS'
export type GameStatus = 'LOBBY' | 'IN_PROGRESS' | 'COMPLETE' | 'ABANDONED'
export type OpponentKind = 'USER' | 'MACHINE_ALGORITHM' | 'MACHINE_AGENT'
export type GameMoveStatus = 'PENDING' | 'APPLIED' | 'REJECTED'

export interface GameSummary {
  id: string
  tenantId: string
  gameType: GameType
  opponentKind: OpponentKind
  status: GameStatus
  playerOneResidentUrn: string
  playerTwoResidentUrn: string | null
  currentTurnSeat: number | null
  winnerSeat: number | null
  moveCount: number
  createdAt: Date
  finishedAt: Date | null
}

export interface GameMove {
  id: string
  gameId: string
  seat: number
  moveNumber: number | null
  moveData: unknown
  status: GameMoveStatus
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
  lookup + `gameView` jsonb in one document), `mutation/createGame.graphql`,
  `mutation/submitMove.graphql`, `mutation/resignGame.graphql`. The existing
  `triggerWorkflow` document is reused.
- Mappers: `src/mappers/game.ts` (`toGameSummary`, `toGameMove`) — un-Maybe, `Date` coercion,
  enum pass-through (R3).
- Composables (+ **barrel lines in `src/index.ts`**): `src/composables/useGames.ts` (list +
  create+setup-trigger), `src/composables/useGame.ts` (hybrid: query + WS + submit/resign —
  per-page `.data.md` files). Opponent display names resolve via the shared residents list
  (`ActiveTenantResidents` — msg precedent).
- Tenant-app re-exports: `apps/tenant-app/app/composables/useGames.ts`, `useGame.ts`.

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
| Players cannot see hidden fleets | `game_state`/`player_views` live in deny-all `game.game_engine_state` (RLS, zero policies, revoked, `-*` behavior); reads only via `game_fn.player_view`, which returns **only the caller's seat view** |
| Client cannot forge state | All writes are SECURITY DEFINER `game_fn.*`; no INSERT/UPDATE policies on any game table; the engine runs only in the referee (n8n), never in the browser |
| Move authority | `submit_move` records intent; the referee validates (seat, turn, legality) against `engine_context` and rejects with a reason — client pre-checks are fail-fast UX only (R13 analog) |
| Machine fairness | Algorithm + agent select from the machine seat's redacted view; the agent prompt never contains `game_state` |
| n8n blast radius | `n8n_worker` gains exactly two `game_fn` EXECUTEs; no table SELECTs, no other schemas (mirrors the dataset-sync grant discipline) |
| Rogue triggers | `game-move` registry entry gated `p:app-user`; a trigger without a lobby/pending move no-ops in the referee |
| Tenant isolation | RLS tenant-scoped SELECTs; `_fn` functions validate resident urns belong to `_tenant_id`; `tenant_id` recorded on every row and on `n8n.workflow_run` via the trigger payload |
| WS surface | Session-validated upgrade; socket carries only `{ event, id }` pings — data flows through GraphQL/RLS on refetch |
