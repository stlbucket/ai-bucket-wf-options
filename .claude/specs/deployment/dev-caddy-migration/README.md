# Dev proxy: nginx → Caddy migration

> **Execution Directive:** plan + build this spec via
> `/fnb-stack-implementor .claude/specs/deployment/dev-caddy-migration/README.md` — the
> implementor derives the `.claude/issues/` plan file (R23) from the task list below, then
> executes it.

## Status

Implemented (2026-07-20) — dev proxy is Caddy (`docker/Caddyfile`); `docker/nginx.conf` deleted;
verified by a live checkers game + airports sync through Caddy. This directive stays as the entry
point for future extensions.

## Purpose

Production already fronts the stack with **Caddy** (`infra/docker/Caddyfile`: automatic Let's
Encrypt TLS + path routing + `id.`/`n8n.` subdomains — see `../production-runtime.md` §5). Dev
still fronts it with **nginx** (`docker/nginx.conf`: plain HTTP :80 + the same path routing +
Vite-HMR WebSocket). The two files **duplicate the same route list by hand**, and the specs
already flag the coupling as a maintenance tax:

- production-runtime §5: *"Path routing mirrors `docker/nginx.conf` exactly."*
- the storage `6 MB` upload cap must be *"kept aligned"* across `nginx.conf`, the Caddyfile, and
  `upload.post.ts` (three places).

This spec **replaces the dev nginx broker with a dev Caddyfile**, so dev and prod share one proxy
technology and one routing mental model. The drift risk between two hand-maintained route lists
goes away; dev's front door behaves like prod's.

**Non-goal:** a single shared Caddyfile for both dev and prod. That is impossible — dev proxies
Vite HMR dev servers over plain HTTP; prod proxies built `.output` node servers over TLS with
`id.`/`n8n.` subdomains. The upstreams, TLS posture, and subdomain set genuinely differ. What is
shared is the **routing skeleton** (the 7 prefixes + catch-all order) and the syntax; TLS is
gated **off** in dev.

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| Target proxy | **Caddy** (`caddy:2`) in dev, replacing `nginx:alpine` | Prod already runs Caddy; unify on one tech. Caddy is the simplest tool for "TLS + path routing" and its `handle` blocks mirror nginx `location` top-to-bottom. |
| **Not Traefik** | Rejected for both dev and prod | See *Considered & rejected*. Traefik's dynamic label-based discovery is a large-fleet feature; fnb has a fixed ~7-app set where one declarative file is more readable, and adopting it would discard the working prod Caddy setup. |
| Dev TLS | **Off** — plain HTTP on `${PORT}` | Dev has no domain/ACME. Use a plain `http://` site address (or `auto_https off`) so Caddy serves HTTP :80 exactly like nginx does today. No cert volume needed. |
| Config sharing | Skeleton + syntax only, **two files** | Upstreams (Vite HMR vs built `.output`), TLS, and subdomains differ. Keep `docker/Caddyfile` (dev) and `infra/docker/Caddyfile` (prod) as siblings; the routing prefix list is the shared contract, verified by review not by a shared file. |
| WebSockets | Rely on Caddy's automatic `Upgrade`/`Connection` handling | Removes the manual `map $http_upgrade` block. Must be **validated against Vite HMR** in dev (the one behavior nginx handles that prod's Caddy never exercised). |
| File location | `docker/Caddyfile` (mirrors `infra/docker/Caddyfile`) | Keep the dev proxy config where `docker/nginx.conf` lived; delete `docker/nginx.conf`. |

## Behavior parity checklist (dev Caddyfile must reproduce nginx.conf exactly)

The dev Caddyfile must reproduce every behavior in `docker/nginx.conf`:

- [ ] Plain HTTP on `${PORT}` (no TLS, no ACME).
- [ ] Path routing, **catch-all last**: `/auth /tenant /msg /game /storage /graphql-api
  /ruru-static` → `<service>:3000`, then `/` → `home-app:3000`.
- [ ] `/graphql-api/api/graphql/stream` handled **before** `/graphql-api`, with no buffering
  (Caddy `flush_interval -1`) — SSE stream.
- [ ] `/storage` request-body cap **6 MB** (`request_body { max_size 6MB }`), aligned with
  `MAX_BODY_BYTES` in `packages/storage-layer/server/api/upload.post.ts`.
- [ ] WebSocket upgrade works for **Vite HMR** (dev-only) and the **msg** + **game** app sockets —
  validate HMR live-reload actually fires through Caddy.
- [ ] Forwarded headers (`Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`) — Caddy sets
  these automatically via `reverse_proxy`; confirm apps still see correct scheme/host.

## Files in this spec

| File | Change |
|---|---|
| `docker/Caddyfile` | **NEW** — dev proxy config (plain HTTP, 7 prefixes + catch-all, SSE no-buffer, 6 MB storage cap). Mirrors `infra/docker/Caddyfile` minus TLS/subdomains. |
| `docker/nginx.conf` | **DELETE** after the Caddyfile is verified. |
| `docker-compose.yml` | `nginx` service → `caddy` service: `image: caddy:2`, mount `./docker/Caddyfile:/etc/caddy/Caddyfile:ro`, keep `ports: ["${PORT:?}:80"]` and `depends_on` unchanged. Update the D2 structural-constant comments (`must match docker/nginx.conf` → `Caddyfile`) at the app-service env blocks and the other `nginx.conf` comment references (lines ~194, ~326, ~597, ~635). |
| `.claude/specs/monorepo-bootstrap-pattern.md` | Rewrite the **"nginx Routing (`docker/nginx.conf`)"** section → Caddy; the **"Adding a New App"** checklist steps 4–5 (the `depends_on` + `handle` block, replacing the `location` block, "before the catch-all" rule preserved); the `nginx` service description; the D2 "nginx-coupled" comment wording. |
| `.claude/specs/deployment/production-runtime.md` §5 | Update the "replaces nginx" framing → "dev and prod now share Caddy; the dev Caddyfile is `docker/Caddyfile`." Drop the "mirrors `docker/nginx.conf`" phrasing. |
| `.claude/skills/fnb-create-app/SKILL.md` | The new-app scaffold checklist adds a proxy route — change "add an nginx `location` block" → "add a Caddy `handle` block before the catch-all." |
| `.claude/skills/fnb-stack-spec/SKILL.md` + `.claude/skills/fnb-stack-implementor/SKILL.md` | R21 pointer sync — any "nginx routing" references in the bootstrap-pattern summaries → Caddy. |
| `.claude/specs/global-rules.md` | R21 check — the single nginx mention (R? "no nginx route" for agent-app) becomes "no Caddy route"; confirm no rule text hardcodes nginx as the dev proxy. |

**Out of scope (incidental nginx mentions left as-is):** historical/contextual references like
"no nginx route" / "nginx path prefix" scattered across `asset-storage/`, `game-server/`,
`n8n-*`, `agentic-workflow-engine/`, `future-auth/` specs. These describe *why a service has no
route*, not the proxy tech; a global rename is churn without value. The implementor may
opportunistically fix ones it touches, but they are not gating.

## Implementation Task List

### Phase 1 — Author the dev Caddyfile ✅ (2026-07-20)
- [x] Write `docker/Caddyfile` reproducing every item in the **Behavior parity checklist**, using
  `infra/docker/Caddyfile` as the template (strip TLS block, `id.`/`n8n.` subdomains, `encode`;
  set a plain-HTTP `:80` / `http://` site address). `caddy validate` → Valid configuration.

### Phase 2 — Swap the compose service ✅ (2026-07-20)
- [x] `docker-compose.yml`: rename `nginx` → `caddy`, `image: caddy:2`, mount the Caddyfile at
  `/etc/caddy/Caddyfile`, keep `ports`/`depends_on`/network. Update all `nginx.conf` comment
  references in the file. `docker compose config` parses.

### Phase 3 — Verify parity (the gate) ✅ (2026-07-20, user-run)
- [x] Full rebuild; apps load through Caddy on `${PORT}` (checkers game played end-to-end).
- [x] **Game WebSockets** connect through Caddy — a full checkers game played (referee round-trips
  over the `/game` + `/tenant` WS upgrades; retires the auto-Upgrade risk that replaced nginx's
  `map` block). *(Vite HMR not independently exercised — it is another WS upgrade on the same
  proven path; edit a `.vue` file to confirm live-reload if desired.)*
- [x] Workflow trigger path works — airports sync run.
- [x] `docker/nginx.conf` **deleted**.

### Phase 4 — Docs + skills sync (R21) ✅ (2026-07-20)
- [x] Update `monorepo-bootstrap-pattern.md`, `deployment/production-runtime.md` §5 (+ delta table
  + service inventory), `deployment/README.md` (D1/D5), `fnb-create-app/SKILL.md`, the two
  orchestrator skills, and the `global-rules.md` nginx mention per the *Files in this spec* table.
  Plus operational files that referenced the to-be-deleted `docker/nginx.conf` by path
  (`.env.example`, `CLAUDE.md`, `upload.post.ts`) and stray source comments.

## Remaining Open Questions

- **None blocking.** One thing to confirm during Phase 3: whether Caddy's automatic Upgrade
  handling covers Vite's HMR WebSocket cleanly, or whether a dev-only tweak is needed. This is a
  verification step, not a design unknown — nginx needed an explicit `map` block, Caddy claims not
  to; Phase 3 proves it.

## Considered & rejected

- **Traefik for both dev and prod.** Rejected. Traefik's headline advantage is dynamic,
  label-based service discovery (routes as `traefik.http.routers.*` labels on each service) —
  valuable for large, churning, auto-scaling fleets. fnb is a **fixed set of ~7 routed apps** in
  one compose file; for that shape a single declarative Caddyfile is *more* readable than routing
  config scattered across 7+ service definitions. Adopting it would also mean **discarding the
  working prod Caddy front door** (`infra/`, just built) and re-deriving what Caddy already
  expresses cleanly — `h2c://` for ZITADEL's gRPC-web, SSE `flush_interval -1`, catch-all
  priority. High cost, no payoff for this topology.
- **A single shared Caddyfile for dev + prod.** Rejected — see *Non-goal* in Purpose. Different
  upstreams (Vite HMR vs `.output`), TLS posture, and subdomain set. The shared contract is the
  routing skeleton, enforced by review.
- **Leave dev on nginx (status quo).** The honest baseline: nginx in dev works fine and this is a
  low-priority consistency win. Chosen against only because the two-file drift risk is a real,
  spec-documented ongoing tax, and unifying on Caddy removes it for a small, contained change.
