---
name: game-server-infrastructure
description: Infrastructure for the game server — packages/game-engines (canonical engine + embed script), packages/game-layer (WS route + pg-notify bridge), apps/game-app (compose + nginx /game), the n8n Anthropic credential template, env changes, and the rebuild-gate verification checklist.
---

# Game Server — Infrastructure

## Status
Draft — decisions locked 2026-07-19 (see `README.md`). No `[FILL IN]` markers.

---

## 1. `packages/game-engines` — canonical engine package (new)

Pure TypeScript, **no runtime app consumers** (UI types come from `fnb-types`; the runtime
consumer is the n8n Code node via the embed script). Not added to `packages-watch` (nothing
imports its dist at runtime). R24: declares its own deps (`typescript`, `vitest`,
`@function-bucket/fnb-types` for the view types — all `"catalog:"` where shared).

```
packages/game-engines/
├── package.json                  # scripts: build, test, embed
├── tsconfig.json
├── src/
│   ├── battleship/
│   │   ├── engine.ts             # the user-supplied battleship.ts — VERBATIM (do not edit)
│   │   ├── serialize.ts          # dehydrate/hydrate: PlacedShip.hits Set<string> ⇄ string[]
│   │   ├── views.ts              # per-seat redacted view computation (player_views_after shapes)
│   │   ├── referee.ts            # two-board wrapper: setup / validate+apply / expectation +
│   │   │                         #   outcome logic — emits the ordered actions list w/ snapshots
│   │   └── select-move.ts        # the machine move-selection script (hunt/target — full source
│   │                             #   in game-event.workflow.data.md §Algorithm)
│   ├── referee.ts                # game-type dispatcher: (context, op) → record_referee_result
│   │                             #   payload (game_type_id switch; battleship only for now)
│   └── index.ts
├── scripts/embed.ts              # builds a single-file IIFE-ish bundle of referee + selector and
│                                 #   rewrites the `jsCode` of the named Code nodes in
│                                 #   n8n/workflows/game-event.json (drift-proof sync)
└── test/                         # vitest: engine adapters, referee validation/rejection, turn +
                                  #   win detection, redaction (no ships leak into opponent view),
                                  #   selector legality (never repeats a shot, targets hits)
```

- `engine.ts` is the supplied file byte-for-byte; all adaptation lives around it
  (`serialize.ts`, `views.ts`).
- `scripts/embed.ts` is deliberately dumb: bundle (esbuild via `tsx`/plain `esbuild` —
  implementor's choice, declared per R24), then JSON-parse `game-event.json`, replace the
  `jsCode` string of nodes named `referee` and `parse-agent-move`, write back, fail if a node
  is missing. Run via `pnpm --filter @function-bucket/fnb-game-engines embed`; the task list
  requires re-running it whenever `src/` changes (and CI-less parity is asserted by a vitest
  test that compares the bundle hash to the JSON — cheap drift alarm).
- The Code-node runtime is n8n's sandbox (Node, no `require` of repo code) — the bundle must be
  self-contained, no imports.

## 2. `packages/game-layer` — the WS layer (new; msg-layer mirror)

Nuxt layer, `extends: ['@function-bucket/fnb-tenant-layer']` (layer chain gains
`tenant-layer → game-layer`). R24: own `package.json` deps (incl. explicit `h3` imports in
`server/`), `tsconfig.json`, `nuxt prepare` script.

```
packages/game-layer/
├── package.json / tsconfig.json / nuxt.config.ts
└── server/
    ├── routes/_ws/games/[id].ts      # defineWebSocketHandler — the one WS route
    └── utils/
        ├── getWsUpgradeClaims.ts     # session-cookie → claims (msg-layer pattern)
        └── pg-notify-bridge.ts       # shared pg client, LISTEN/UNLISTEN per channel (msg-layer pattern)
```

Handler contract (sockets-pattern):
- `upgrade`: validate the sealed `session` cookie → claims; `throw createError({ statusCode: 401 })`
  if absent. No per-game seat check (README: socket carries only `{event,id}` pings).
- `open`: LISTEN `game:{id}:state`, forward raw payloads to the peer.
- `close`: UNLISTEN + cleanup.
- Env: `DATABASE_URL` (the bridge's pg connection — same as msg-layer's).

## 3. `apps/game-app` — the routed WS host (new; scaffold via `fnb-create-app`, WS variant)

- `extends: ['@function-bucket/fnb-game-layer']`; `NUXT_APP_BASE_URL=/game`.
- **No user-facing pages** — the UI lives in tenant-app; the app exists to serve
  `/game/_ws/games/[id]` (plus the scaffold's minimal index). msg topology mirror: tenant-app
  pages open sockets cross-app, exactly like `/msg/_ws/...`.
- Infra checklist (monorepo-bootstrap-pattern §Adding a New App — all five steps apply):
  1. `volumes:` += `node_modules_game_app`
  2. `pnpm-install` volumes += the same
  3. app service block from the routed template (structural constants: `NUXT_APP_BASE_URL: "/game"`,
     port 3000; env: the standard routed-app set + `DATABASE_URL` for the bridge)
  4. `nginx` `depends_on` += `game-app`; add to the pinger list alongside the other routed apps
  5. `docker/nginx.conf`: `location /game { proxy_pass http://game-app:3000; }` **before**
     `location /` (WS headers are already global)

## 4. n8n credential — Anthropic API key (new template)

`n8n/credentials/anthropic-api-key.json.tpl` (rendered by the existing
`n8n/scripts/render-credentials.mjs` at import; same mechanism as the two existing templates):

```json
{
  "id": "fnbanthropickey1",
  "name": "anthropic-api-key",
  "type": "httpHeaderAuth",
  "data": {
    "name": "x-api-key",
    "value": "${ANTHROPIC_API_KEY}"
  }
}
```

- Reuses the **existing** `ANTHROPIC_API_KEY` from `.env` (the agentic engine's credential —
  user requirement "credentials as in our agentic workflow"). No new secret.
- Compose change: add `ANTHROPIC_API_KEY: "${ANTHROPIC_API_KEY:?}"` to the **`n8n-import`**
  service environment (the render step reads it). The `n8n` server service does not need it
  (credentials are stored encrypted in `n8n_engine`).
- The `anthropic-version: 2023-06-01` header is set as a plain node header on the HTTP Request
  node (not a secret — `game-event.workflow.data.md`).

## 5. Env / config summary (no new secrets)

| Change | Where |
|---|---|
| `DEPLOY_PACKAGES` += `fnb-game` (end of list) | `.env` + `.env.example` (+ env-build docs) |
| `pgServices.schemas` += `game, game_api` | `apps/graphql-api-app/server/graphile.config.ts` |
| Smart-tag block for `game.*` | `apps/graphql-api-app/postgraphile.tags.json5` (`_shared.data.md`) |
| `ANTHROPIC_API_KEY` into `n8n-import` env | `docker-compose.yml` |
| game-app service + volumes + nginx `/game` + pinger | `docker-compose.yml`, `docker/nginx.conf` |
| Registry entry `game-event` | `apps/graphql-api-app/server/graphile/trigger-workflow.plugin.ts` |
| `routeRules: { '/games/**': { ssr: false } }` | `apps/tenant-app/nuxt.config.ts` — **required**, not optional: tenant-app's urql plugin is client-only (`urql.client.ts`), same as every other data-driven section (`/msg`, `/loc`, `/tools`, `/datasets`, …). Missing this crashes every `/tenant/games/**` page with `500 — No urql Client was provided` on first SSR request (caught live in Phase 5 verification) |

No new host ports; the n8n engine, editor exposure, webhook secret, and `n8n_worker` password
plumbing are all unchanged from `n8n-parallel-engine/infrastructure.md`.

**Dev-server gotcha (observed live, Phase 5):** brand-new page *directories* under `app/pages/`
are not always picked up by the Nuxt dev server's file watcher on Docker Desktop for Mac —
client-side HMR regenerates the route table, but Nitro's server-side page manifest still
404s until the `tenant-app` service is restarted. A `nuxt.config.ts` edit (e.g. the
`routeRules` change above) triggers Nuxt's own internal restart and is not affected. If new
game pages 404 after landing Phase 4, ask the user for one `docker compose restart
tenant-app` before it's treated as a real bug.

---

## Verification (at the USER REBUILD GATE — read-only; never rebuild yourself)

After the user rebuilds with Phases 1–2 landed:

1. **Schema**: `\dn game*` shows the trio; `select * from game.game_type` returns the 3 seed
   rows (battleship `live`, the other two `coming_soon`); `\d game.game` has the generated
   `urn` + `seat_count` + `expecting_seats` + `event_count` + `game_type_id` FK (no per-seat
   columns); `\d game.game_player` shows the roster (seat, `player_kind`, nullable
   `resident_urn`, `outcome`, `resigned_at`); `\d game.game_event` shows the log (dense
   `event_number` unique per game, one-pending-per-seat partial unique index);
   `game.game_event_state` shows RLS enabled with zero policies.
2. **Deny-all negative**: as a simulated authenticated role
   (`set role authenticated; set request.jwt.claims=...`), `SELECT * FROM game.game_event_state`
   → permission denied; `SELECT * FROM game.game` → allowed, no secret columns exist on it;
   another seat's `pending` `game.game_event` row is invisible (pending-visibility policy).
3. **`n8n_worker` grants**: `SET ROLE n8n_worker` can execute `game_fn.engine_context` /
   `game_fn.record_referee_result` (against a seeded game), cannot `SELECT` any `game.*` table.
4. **Nav**: the Games module + three tools appear for a dev user (`p:app-user`); links resolve
   (battleship pages land in Phase 4 — transient dead links acceptable, n8n-spec precedent).
5. **WS**: `curl` upgrade on `/game/_ws/games/<uuid>` without a session cookie → 401; with a
   dev session → 101.
6. **Credential**: n8n editor shows `anthropic-api-key` imported; `n8n-import` one-shot exited 0.
7. **GraphQL**: GraphiQL shows `Game` (with the `gamePlayers` and `gameEvents` relations),
   `GameType` as an **object type** with a root `gameTypeList`, `myGamesList`,
   `gameView(gameId, eventNumber)`, `createGame` (`gameTypeId: String!, players: JSON!`),
   `submitEvent`, `resignGame`; `GameEventState` type absent; `GamePlayer`/`GameEvent` have
   no root-level list/connection.
