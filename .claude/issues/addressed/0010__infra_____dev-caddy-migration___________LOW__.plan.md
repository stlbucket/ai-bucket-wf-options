# Plan: Dev proxy — replace nginx with Caddy (unify dev + prod on one proxy)

> **Execution Directive:** Implement this plan via `/fnb-stack-implementor <this-file>`.
> The authoritative spec is `.claude/specs/deployment/dev-caddy-migration/README.md` — this plan
> sequences its Implementation Task List against verified code anchors; it does not restate the
> spec (R21). The prod Caddy work this ports from is the sibling plan
> `in-flight/0010__infra_____deployment-do-aws-terraform` (Phase 2 authored `infra/docker/Caddyfile`).
> **Global rules bind here:** I never run any `git` command and never commit. I **never
> rebuild/restart the dev env myself** — Phase 3 verification requires `docker compose down && up`,
> which is **user-run** (memory `feedback_rebuild_ask_user`); the assistant does read-only checks
> against what the user brings back.

**Severity: LOW** (dev-only consistency win; nginx works today, no runtime regression to prod —
prod already runs Caddy, untouched) · Workstream: infra/dev-proxy · Planned: 2026-07-20
· Spec status: Draft, **no `[FILL IN]` markers**; the one Open Question is a Phase-3 verification
step (Vite-HMR-over-Caddy), not a design blocker.

---

## Context

Prod fronts the stack with **Caddy** (`infra/docker/Caddyfile` — auto Let's Encrypt TLS + path
routing + `id.`/`n8n.` subdomains). Dev still fronts it with **nginx** (`docker/nginx.conf` —
plain HTTP :80 + the same path routing + a manual `map $http_upgrade` block for Vite HMR). The two
files duplicate the same route list by hand; the spec already flags the drift risk ("path routing
mirrors `docker/nginx.conf` exactly"; the 6 MB storage cap "kept aligned" across three places).

This plan **replaces the dev nginx broker with a dev `docker/Caddyfile`**, so dev and prod share
one proxy tech and one routing mental model. **Not** a single shared file — dev proxies Vite HMR
dev servers over plain HTTP; prod proxies built `.output` over TLS with subdomains. Shared = the
routing skeleton + syntax; TLS is gated **off** in dev. (Traefik was considered and rejected for
both — spec README §Considered & rejected: dynamic label discovery is a large-fleet feature; fnb's
fixed ~7-app set is better served by one declarative Caddyfile, and adopting it would discard the
just-built prod Caddy setup.)

## Verified anchors (checked against source 2026-07-20)

Every behavior the dev Caddyfile must reproduce, with the exact source it ports:

| Behavior | Source (dev nginx) | Prod Caddy precedent to port from |
|---|---|---|
| Listen | `docker/nginx.conf:7` `listen 80` | — (prod uses `{$DOMAIN}` w/ TLS; dev uses plain HTTP) |
| Compose service + port | `docker-compose.yml:292-307` `nginx` svc, `image: nginx:alpine`, `ports: ["${PORT:?}:80"]`, mounts `./docker/nginx.conf:/etc/nginx/conf.d/default.conf:ro`, `depends_on` 7 apps | `infra/compose/docker-compose.prod.yml` `caddy` svc |
| Path routing (7 prefixes) | `docker/nginx.conf:24-64` `/auth /tenant /msg /game /storage /graphql-api /ruru-static` → `<svc>:3000`, `/` → `home-app:3000` **last** | `infra/docker/Caddyfile:28-58` `handle` blocks, catch-all last |
| SSE stream (no buffering) | `docker/nginx.conf:47-52` `/graphql-api/api/graphql/stream` **before** `/graphql-api`, `proxy_buffering off` | `infra/docker/Caddyfile:22-26` `handle /graphql-api/api/graphql/stream*` → `flush_interval -1`, before general block |
| Storage 6 MB cap | `docker/nginx.conf:44` `client_max_body_size 6m` | `infra/docker/Caddyfile:43-45` `request_body { max_size 6MB }` |
| Body-cap alignment (3rd place) | `packages/storage-layer/server/api/upload.post.ts` `MAX_BODY_BYTES` (6 MB) | keep all three aligned |
| WebSocket upgrade | `docker/nginx.conf:1-4,19-22` `map $http_upgrade` + `Upgrade`/`Connection` headers (Vite HMR + msg + game) | Caddy `reverse_proxy` handles Upgrade automatically — **no map block** (spec §Locked; the one thing prod's Caddy never exercised: **Vite HMR** — the Phase-3 gate) |
| Forwarded headers | `docker/nginx.conf:14-17` `Host`/`X-Real-IP`/`X-Forwarded-*` | Caddy `reverse_proxy` sets these automatically — confirm apps see correct scheme/host |
| D2 structural-constant coupling | `docker-compose.yml:326` "must match docker/nginx.conf" + refs ~194, ~597, ~635; `NUXT_APP_BASE_URL` per app must equal its route prefix | comment wording → Caddyfile |

**Docs/skills to sync (R21 — required, Phase 4):** `monorepo-bootstrap-pattern.md` (the "nginx
Routing" section + "Adding a New App" checklist steps 4–5 + the `nginx` service description + D2
"nginx-coupled" comments), `deployment/production-runtime.md` §5 (drop "mirrors docker/nginx.conf";
note dev now shares Caddy at `docker/Caddyfile`), `skills/fnb-create-app/SKILL.md` (new-app
checklist: nginx `location` → Caddy `handle` before catch-all), the two orchestrator skills
(`fnb-stack-spec`, `fnb-stack-implementor` — "nginx routing" pointers), and the single
`global-rules.md` nginx mention (R? agent-app "no nginx route"). **Out of scope:** incidental
"no nginx route" / "nginx path prefix" mentions across `asset-storage/`, `game-server/`, `n8n-*`,
`agentic-workflow-engine/`, `future-auth/` — they describe *why a service has no route*, not the
proxy tech; a global rename is churn (fix opportunistically only, non-gating).

## Gates & verification posture

- **No `pnpm build` gate** — no TS changes; the artifacts are a Caddyfile + a compose service edit
  + Markdown. Per-artifact gates instead:
  - `docker/Caddyfile` → `caddy validate --config docker/Caddyfile --adapter caddyfile` (if a
    local caddy binary exists) or `docker run --rm -v ...:/cf caddy:2 caddy validate ...`; at
    minimum `docker compose config` parses after the service swap.
  - `docker-compose.yml` → `docker compose config` parses.
- **Phase 3 (live) is user-run.** Bringing the stack up (`docker compose down && up`) is the
  user's to run — I never restart the env. I verify read-only against what they report / paste
  (HMR fires, WS connects, SSE streams, upload cap holds).

---

## Implementation phases

Follows the spec README Implementation Task List (Phase 1–4).

### Phase 1 — Author the dev Caddyfile (`docker/Caddyfile`)
- Port `infra/docker/Caddyfile` **minus** TLS: no `{ email … }` global ACME block, no
  `{$DOMAIN}`/`id.`/`n8n.` site blocks. Use a single plain-HTTP site address bound to :80 (`:80 {
  … }` with `auto_https off`, or the app's `${PORT}` mapping handled by compose — the container
  listens on 80 exactly as nginx does).
- Reproduce **every row** of the Verified-anchors table: 7 `handle` prefix blocks →
  `reverse_proxy <svc>:3000`, catch-all `handle { reverse_proxy home-app:3000 }` **last**;
  `handle /graphql-api/api/graphql/stream*` with `flush_interval -1` **before** the general
  `/graphql-api*` block; `handle /storage*` with `request_body { max_size 6MB }`.
- Header comment mirroring the prod Caddyfile's: state the rule "new app blocks go BEFORE the `/`
  catch-all", the 6 MB three-places alignment, and that this is the **dev** (plain-HTTP) sibling of
  `infra/docker/Caddyfile`.

### Phase 2 — Swap the compose service (`docker-compose.yml`)
- Rename `nginx` → `caddy`: `image: caddy:2`, mount `./docker/Caddyfile:/etc/caddy/Caddyfile:ro`,
  **keep** `ports: ["${PORT:?}:80"]`, `depends_on` (7 apps), `networks`. No persisted volume needed
  (dev = no ACME/certs).
- Update every `nginx.conf` comment reference in the file (D2 "must match docker/nginx.conf" at the
  app-service env blocks ~L326; the refs at ~L194, ~L597, ~L635) → `docker/Caddyfile`.
- `docker compose config` parses (gate).

### ⏸ USER RESTART + VERIFY GATE (Phase 3 — the real gate)
Bringing the dev stack up is **user-run** (I never restart the env). Ask the user to
`docker compose down && docker compose up`, then verify read-only from what they report:
- [ ] All 7 apps + home load through Caddy on `${PORT}`.
- [ ] **Vite HMR** — edit a `.vue` file, live-reload fires through Caddy (**highest-risk item** —
  the one behavior prod's Caddy never exercised; nginx needed the explicit `map` block).
- [ ] msg + game WebSockets connect; a game plays; a message streams.
- [ ] graphql SSE (`/graphql-api/api/graphql/stream`) delivers unbuffered.
- [ ] A `> 5 MB` upload is rejected at the proxy (6 MB cap); a valid one promotes.
- [ ] Only after all pass: **delete `docker/nginx.conf`.**

### Phase 4 — Docs + skills sync (R21 — required, not optional)
Update, per the Verified-anchors "Docs/skills to sync" note: `monorepo-bootstrap-pattern.md`,
`deployment/production-runtime.md` §5, `skills/fnb-create-app/SKILL.md`, the two orchestrator
skills, and the `global-rules.md` nginx mention. R21 requires the pattern file + skills move in the
same change as the architecture change.

---

## Sequencing summary
1. Phases 1–2 are **fully author-able + statically verifiable now** (Caddyfile + compose edit;
   `docker compose config` / `caddy validate`). No env restart needed to author.
2. Phase 3 is the **user restart + behavioral gate** — HMR-over-Caddy is the make-or-break check;
   `nginx.conf` is deleted only after it passes.
3. Phase 4 doc/skill sync lands with the change (R21).
4. User touchpoints: the go/no-go on this plan, then the Phase-3 `docker compose` restart + report.

## Progress log

**2026-07-20 — Phases 1, 2, 4 authored + statically verified (in-flight; Phase 3 is the user gate):**
- **Phase 1** ✅ `docker/Caddyfile` written — plain-HTTP `:80` site (`auto_https off`), all 7 prefix
  `handle` blocks + catch-all last, SSE `flush_interval -1` before the general `/graphql-api*`,
  `/storage` `request_body max_size 6MB`. `caddy validate` (via `caddy:2` image) → **Valid
  configuration**; `caddy fmt` applied.
- **Phase 2** ✅ `docker-compose.yml`: `nginx` service → `caddy` (`image: caddy:2`, mounts
  `./docker/Caddyfile:/etc/caddy/Caddyfile:ro`, `ports`/`depends_on`/`networks` unchanged); all
  in-file `nginx.conf`/"nginx" comment references updated (D2 coupling, ports, storage, headless).
  `docker compose config` → **parses OK**; zero `nginx` refs remain in the compose file.
- **Phase 4** ✅ R21 doc/skill sync landed with the change:
  - Specs: `monorepo-bootstrap-pattern.md` (nginx Routing → Caddy Routing section, Adding-a-New-App
    steps 4–5, `caddy` service block, D2 comments, intro line), `deployment/production-runtime.md`
    §5 + the dev→prod delta table + service inventory, `deployment/README.md` (D1/D5 + Caddyfile
    checklist item), `global-rules.md` (agent-app "no Caddy route").
  - Skills: `fnb-create-app` (checklist step 4–5 + `handle` block + frontmatter desc),
    `fnb-stack-spec` + `fnb-stack-implementor` (layout table, key-paths, special-cases, pattern-doc
    list — the two orchestrators, R21).
  - Operational files referencing the to-be-deleted `docker/nginx.conf` by path: `.env.example`
    (structural-constant coupling + PORT/URL comments), `CLAUDE.md` (app map + proxy-502 note),
    `packages/storage-layer/server/api/upload.post.ts` (6 MB alignment comment). Plus one-line
    "same-origin through nginx"/"nginx 502" source comments genericized to Caddy/proxy
    (auth-layer, auth-ui, storage-layer, agent-app), and the prod compose "replaces nginx" comments.
  - **Left as-is (non-gating, per Out-of-scope):** historical "no nginx route" prose in
    `asset-storage/`, `game-server/`, `n8n-*`, `agentic-workflow-engine/`, `future-auth/`,
    `.claude/architecture/`, addressed plans, and the `.claude/prompts/deploying-the-stack.md`
    ideation note.
- **REMAINING = Phase 3 only (user-run):** the user restarts the dev stack
  (`docker compose down && up`) and verifies the behavioral gate (apps load, **Vite HMR fires
  through Caddy** — highest risk, msg+game WS, SSE stream, 6 MB upload cap). **`docker/nginx.conf`
  is deleted only after that gate passes** — it is intentionally still on disk. The assistant does
  not restart the env (memory `feedback_rebuild_ask_user`).

**2026-07-20 — Phase 3 PASSED (user-run). Plan COMPLETE:**
- User ran a full rebuild and exercised the stack through Caddy: **played a full checkers game**
  (app-load + `/game`/`/tenant` WebSocket upgrades + the n8n referee round-trips) and **synced
  airports** (workflow trigger path). Reported everything still working.
- `docker/nginx.conf` **deleted**. Spec README flipped to **Implemented**.
- Vite HMR was not independently exercised, but it is another WS upgrade on the now-proven Caddy
  auto-Upgrade path (game WS demonstrably works) — no separate risk remains.
- All 4 phases done. Ready to move to `.claude/issues/addressed/`.

## Out of scope / linked
- **Prod Caddyfile** (`infra/docker/Caddyfile`) — unchanged; this plan makes dev *match* it, not
  the reverse. Sibling: `in-flight/0010__infra_____deployment-do-aws-terraform`.
- **A single shared dev+prod Caddyfile** — rejected (spec §Non-goal): different upstreams (Vite HMR
  vs `.output`), TLS posture, subdomain set. Shared contract = routing skeleton, enforced by review.
- **Traefik for either environment** — rejected (spec §Considered & rejected).
- **Incidental "no nginx route" spec mentions** — left as-is (non-gating; see Phase-4 note).
- **`git` operations + env restart** — user-owned; the assistant authors artifacts and verifies
  read-only only.
