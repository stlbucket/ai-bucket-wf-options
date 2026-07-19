# fnb (function-bucket)

A full-stack Nuxt 4 monorepo: pnpm workspaces + Turborepo, a PostgreSQL/PostGraphile data
stack with RLS-based auth, and a shared layer/package system. This file is a **map** — it points
at the specs under `.claude/specs/`, which are the single source of truth. Do not restate the
stack in full here (global-rules R21).

## Structure

**Apps** (`apps/`) — each routed app extends one Nuxt layer and serves an nginx path prefix:

| App | Path | Extends |
|-----|------|---------|
| `auth-app` | `/auth` | `auth-layer` |
| `home-app` | `/` (catch-all) | `tenant-layer` |
| `tenant-app` | `/tenant` | `tenant-layer` |
| `graphql-api-app` | `/graphql-api` | `tenant-layer` |
| `storage-app` | `/storage` | `storage-layer` |
| `msg-app` | `/msg` | `msg-layer` |
| `agent-app` | — (headless) | none — the agentic workflow engine (Claude Agent SDK harness, R22) |

**Packages** (`packages/`) — nine shared packages (details:
`.claude/specs/package-layers-pattern.md`):

- `fnb-types` — the shared, type-only vocabulary (R3); everything imports entity types from here
- `db-access` — pre-claims **root of trust** (raw `pg`) + `withClaims(claims, fn)` carve-out
- `graphql-client-api` — default data layer: urql hooks (graphql-codegen) + shared composables
- `auth-server` — server-side pg client factory (`useFnbPgClient`)
- `auth-ui` — `useAuth()` composable (claims in localStorage)
- `auth-layer` → `tenant-layer` → { `msg-layer`, `storage-layer` } — the Nuxt layer chain

**DB** (`db/`) — ten sqitch packages (deploy order: `fnb-auth fnb-app fnb-agent fnb-res fnb-msg
fnb-todo fnb-loc fnb-storage fnb-location-datasets fnb-airports`; `fnb-agent` must precede
`fnb-storage`/`fnb-location-datasets`/`fnb-airports` — `agent_worker` grants + `agent_fn` refs).
`fnb-agent` is the agent run log (`agent.workflow_run` + the `agent_worker` service role; spec:
`.claude/specs/agentic-workflow-engine/`). `fnb-res` is the URN registry (`res.resource` — business + identity objects
register via `res_fn.register_resource`, enforced by deferred FKs; module resident references
are `*_resident_urn` FKs into it; spec: `.claude/specs/urn-registry/`). `db/my-app` is cruft,
not deployed.
Full RLS/permission model. Infra + deploy config: `.claude/specs/monorepo-bootstrap-pattern.md`.

## Data stack

DB (RLS, `<module>_fn`/`<module>_api` two-layer PL/pgSQL) → PostGraphile 5 → `graphql-client-api`
(urql + graphql-codegen) → composable re-export → Vue page. All data access goes through
composables; pages never touch the transport. Details: `.claude/specs/graphql-api-pattern.md`.

## Auth model

**ZITADEL owns the login ceremony** (OIDC code+PKCE, own compose service on its own host port —
`.claude/specs/future-auth/zitadel-login-pattern.md`); there is no password path (`auth.user` is
dropped). The auth-app callback maps the verified identity to `app.profile` (`idp_user_id`) and
sets the **sealed** httpOnly `session` cookie, which stays the root of trust → `ProfileClaims` →
`pgSettings` → RLS. Claims are fetched from GraphQL and mirrored to **localStorage** client-side
(the full JSON overflowed `Set-Cookie` → nginx 502). `db-access`'s 2-arg `withClaims(claims, fn)`
is the outside-GraphQL carve-out. Details: security section of `.claude/specs/graphql-api-pattern.md`.

## Tech Stack

Nuxt 4 (Vue 3, SSR) · Nuxt UI 4 + Tailwind 4 (green/slate) · TypeScript 6 (strict) · Vitest ·
ESLint + Prettier (no semis, single quotes, 100-char) · Turborepo · pnpm workspaces · PostgreSQL
(PostGIS) · PostGraphile 5 · urql + graphql-codegen · Claude Agent SDK (agentic workflows).

## Root Scripts

- `pnpm dev` / `pnpm build` / `pnpm test` / `pnpm lint` → `turbo run <task>`
- `pnpm build` is the gate — repo-wide `pnpm lint` is **known-broken** (see `.claude/memory/`)

## Conventions

- **Memory**: `.claude/memory/` in this repo. Always read/write here — never a global/system path.
- **Specs**: `.claude/specs/`. **Issues/plans**: `.claude/issues/`.
- **Skills**: two orchestrators (`fnb-stack-spec`, `fnb-stack-implementor`) route to specialist
  skills via `.claude/skills/skill-map.md` — the single registration point for new skills (R21).
- **Never run `git`** during a `sqitch` session.
- **Never commit** to git (commits are human-only) — do not even offer.
- **Never rebuild/restart the env** yourself — stop and ask the user, then verify read-only.
