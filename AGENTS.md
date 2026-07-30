# fnb (function-bucket)

A full-stack Nuxt 4 monorepo: pnpm workspaces + Turborepo, a PostgreSQL/PostGraphile data
stack with RLS-based auth, and a shared layer/package system. This file is a **map** — it points
at the specs under `docs/specs/`, which are the single source of truth. Do not restate the
stack in full here (global-rules R21).

> **Agent entry point.** This file follows the [agents.md](https://agents.md) convention and is
> the same file as `CLAUDE.md` (a symlink). Knowledge lives in tool-neutral trees: specs and
> architecture in `docs/`, work items in `docs/issues/`, skills in `.agents/skills/`
> (mirrored into `.claude/skills/` as symlinks for Claude Code discovery). `.claude/` holds
> only Claude-specific adapter state (settings, commands, memory).

## Structure

**Apps** (`apps/`) — each routed app extends one Nuxt layer and serves a Caddy path prefix:

| App | Path | Extends |
|-----|------|---------|
| `auth-app` | `/auth` | `auth-layer` |
| `home-app` | `/` (catch-all) | `tenant-layer` |
| `tenant-app` | `/tenant` | `tenant-layer` |
| `graphql-api-app` | `/graphql-api` | `tenant-layer` |
| `storage-app` | `/storage` | `storage-layer` |
| `msg-app` | `/msg` | `msg-layer` |
| `game-app` | `/game` (WS only — no user pages) | `game-layer` |

The workflow engine is **n8n** (R22) — a compose service trio (`n8n-db-init`, `n8n-import`,
`n8n`), not an app. Definitions live in `n8n/workflows/*.json`; specs
`docs/specs/n8n-parallel-engine/` + `docs/specs/agentic-decommission/`.

**Packages** (`packages/`) — ten shared packages (details:
`docs/specs/package-layers-pattern.md`):

- `fnb-types` — the shared, type-only vocabulary (R3); everything imports entity types from here
- `db-access` — pre-claims **root of trust** (raw `pg`) + `withClaims(claims, fn)` carve-out
- `graphql-client-api` — default data layer: urql hooks (graphql-codegen) + shared composables
- `auth-server` — server-side pg client factory (`useFnbPgClient`)
- `auth-ui` — `useAuth()` composable (claims in localStorage)
- `auth-layer` → `tenant-layer` → { `msg-layer`, `storage-layer`, `game-layer` } — the Nuxt layer chain

Plus `game-engines` — pure TS, vitest-covered, **no runtime app consumer** (the game-server
spec's referee/engine logic; its build is embedded verbatim into the `game-event` n8n workflow's
Code nodes by an embed script, not imported by any app) — not one of the ten layer/lib
packages above, but part of the game server (spec `docs/specs/game-server/`).

**DB** (`db/`) — thirteen sqitch packages (deploy order: `fnb-auth fnb-app fnb-n8n
fnb-notify fnb-res fnb-msg fnb-todo fnb-poll fnb-loc fnb-storage fnb-location-datasets fnb-airports fnb-game`;
`fnb-n8n` must precede `fnb-notify`/`fnb-storage`/`fnb-location-datasets`/`fnb-airports` — `n8n_worker`
grants for the notify send + asset-scan + sync workflows; `fnb-game` is last — needs `fnb-res`'s registry,
`fnb-app`'s policies, and `fnb-n8n`'s `n8n_worker` role). `fnb-notify` is the notification outbox +
user channel preferences + phone-verification OTP store (`notify.notification` send log gated
`p:app-admin-super`, `notify.channel_preference`, `notify.phone_verification`; writes via `notify_fn`
over `n8n_worker` — the send-notification/webhook/phone-verification n8n workflows; spec:
`docs/specs/notifications/`). `fnb-n8n` is the n8n run log
(`n8n.workflow_run` + the `n8n_worker` service role — the **sole workflow engine**, R22:
trigger routing in the `triggerWorkflow` registry; engine state in the separate
`n8n_engine` DB, definitions in the repo `n8n/` dir; specs: `docs/specs/n8n-parallel-engine/`
+ `docs/specs/agentic-decommission/`). `fnb-res` is the URN registry (`res.resource` — business +
identity objects register via `res_fn.register_resource`, enforced by deferred FKs; module resident
references are `*_resident_urn` FKs into it; spec: `docs/specs/urn-registry/`). `fnb-game` is the
event-sourced game platform (`game.game_type` registry, N-seat `game_player` roster,
replayable `game_event` log + deny-all per-event snapshots; the `game-event` n8n workflow is
the sole referee — see the security note in `docs/specs/game-server/`).
Full RLS/permission model. Infra + deploy config: `docs/specs/monorepo-bootstrap-pattern.md`.

## Data stack

DB (RLS, `<module>_fn`/`<module>_api` two-layer PL/pgSQL) → PostGraphile 5 → `graphql-client-api`
(urql + graphql-codegen) → composable re-export → Vue page. All data access goes through
composables; pages never touch the transport. Details: `docs/specs/graphql-api-pattern.md`.

## Auth model

**ZITADEL owns the login ceremony** (OIDC code+PKCE, own compose service on its own host port —
`docs/specs/future-auth/zitadel-login-pattern.md`); there is no password path (`auth.user` is
dropped). The auth-app callback maps the verified identity to `app.profile` (`idp_user_id`) and
sets the **sealed** httpOnly `session` cookie, which stays the root of trust → `ProfileClaims` →
`pgSettings` → RLS. Claims are fetched from GraphQL and mirrored to **localStorage** client-side
(the full JSON overflowed `Set-Cookie` → proxy 502). `db-access`'s 2-arg `withClaims(claims, fn)`
is the outside-GraphQL carve-out. A second, link-driven way in: **OTP quick-login** deep links
(`/auth/go/<id>`, tenant-scoped, self-identify by contact) mint the same `auth.session` rows with
`auth_method='otp'` (1h idle / 8h cap — spec `docs/specs/otp-login/`). Details: security
section of `docs/specs/graphql-api-pattern.md`.

## Tech Stack

Nuxt 4 (Vue 3, SSR) · Nuxt UI 4 + Tailwind 4 (green/slate) · TypeScript 6 (strict) · Vitest ·
ESLint + Prettier (no semis, single quotes, 100-char) · Turborepo · pnpm workspaces · PostgreSQL
(PostGIS) · PostGraphile 5 · urql + graphql-codegen ·
n8n (sole workflow engine, self-hosted).

## Root Scripts

- `pnpm dev` / `pnpm build` / `pnpm test` / `pnpm lint` → `turbo run <task>`
- `pnpm build` is the gate — repo-wide `pnpm lint` is **known-broken** (see `.claude/memory/`)
- `pnpm env-build` (full dev seed) · `pnpm env-build-empty` (virgin env, no seed — bootstrapped via
  `/auth/setup`, first-run-setup spec); `env-rebuild` / `env-rebuild-empty` destroy-then-build

## Conventions

- **Specs**: `docs/specs/` — the single source of truth for patterns and contracts.
  **Issues/plans**: `docs/issues/` (lifecycle + naming: `docs/issues/README.md`, R23).
  **Architecture narrative** (historical): `docs/architecture/`.
- **Skills**: canonical in `.agents/skills/`; two orchestrators (`fnb-stack-spec`,
  `fnb-stack-implementor`) route to specialist skills via `.agents/skills/skill-map.md` — the
  single registration point for new skills (R21). Claude Code discovers them through the
  `.claude/skills/` symlinks.
- **Required non-repo skills** (bootstrap note): `n8n-cli` (the n8n engine's operator loop —
  R22) and `vue-use-expert` are user/global-level skills, not vendored here. On a checkout
  without them, n8n workflow authoring loses its operator guide — see
  `.agents/skills/skill-map.md` for what each covers.
- **Memory** (Claude Code): `.claude/memory/` in this repo. Always read/write here — never a
  global/system path.
- **Never run `git`** during a `sqitch` session.
- **Never commit** to git (commits are human-only) — do not even offer.
- **Never rebuild/restart the env** yourself — stop and ask the user, then verify read-only.
