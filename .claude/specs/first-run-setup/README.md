# first-run-setup

> **Execution Directive:** plan + build this spec via `/fnb-stack-implementor .claude/specs/first-run-setup/README.md` —
> the implementor derives the `.claude/issues/` plan file (R23) from the task list below, then
> executes it.

## Status
**Draft** — fill in all `[FILL IN]` sections before implementing.

## Purpose

Give the app a **first-run initialization flow** so an empty environment can be bootstrapped by a
human instead of the fat dev seed:

1. Build the environment with **no seed data other than the app installation path** (schema
   deployed; no anchor tenant, no profiles, no ZITADEL user roster) — via a new
   `pnpm env-build-empty` (the existing `env-build` is untouched).
2. On first open, the site routes the visitor to **`/auth/setup`**, where they name the first
   tenant and the first user.
3. That tenant becomes the **anchor** tenant, subscribed to the `anchor` + `base` (auto-subscribe)
   packs; that user gets the **site-admin** (`app-admin-super`) license — exactly what
   `app_fn.create_anchor_tenant` already does.
4. Setup **seeds the matching ZITADEL human user** (runtime management API, seeder PAT) and
   redirects to the ZITADEL login.

It reuses the existing anchor bootstrap wholesale and adds a thin, gated, pre-claims carve-out
around it — the same posture as the OIDC login trio.

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| App install timing | Inside the setup flow (`create_anchor_tenant` installs the base app idempotently) | One code path; nothing runs until the human submits |
| Host app | `auth-app` → `/auth/setup` | Already the pre-claims carve-out; owns ZITADEL transport + mounts the seeder PAT volume |
| ZITADEL seeding | Runtime `POST /v2/users/human` with the seeder PAT; form collects a password | Self-contained "seed zitadel and redirect to login" |
| Scope | Alternate path, gated on **no anchor tenant** | Dev keeps the fat `seed.sql` / `zitadel-seed` roster; setup fires only on a virgin env |
| Empty-env control | Single `SEED_DATA=empty` flag threaded to `db-migrate` + `zitadel-seed`; new `env-build-empty` script | Keeps `env-build` byte-for-byte intact |
| Data transport | `db-access` raw pg + Nitro routes (no PostGraphile, no GraphQL) | No claims exist yet — documented R1/R5 exception, like `server/api/auth/oidc/*` |
| DB entry point | New `app_fn.initialize_anchor` (SECURITY DEFINER, gated, granted to `authenticator`, no `app_api`) modeled on `provision_idp_user` | Same pre-claims root-of-trust pattern already in the tree |

## Files in this spec

| File | Contents |
|---|---|
| `_shared.data.md` | The gate (`anchor_exists`), the initializer (`initialize_anchor`), db-access surface, the ZITADEL admin client, permissions |
| `setup.ui.md` | The `/auth/setup` page — layout, form fields, gating/redirects, interactions |
| `setup.data.md` | The two Nitro endpoints (`status`, `initialize`), db-access usage, error surfaces |
| `infrastructure.md` | `SEED_DATA` flag, `env-build-empty` script, migrate + zitadel-seed conditionals, auth-app env additions, verification |

## Reused existing building blocks (no changes needed)

- `app_fn.create_anchor_tenant` / `install_anchor_application` / `invite_user` / `assume_residency`
  (`db/fnb-app`) — installs base app, creates anchor tenant, subscribes `anchor`+`base`, grants
  `app-admin-super`, activates residency.
- `app_fn.provision_idp_user` — first ZITADEL login links the profile by verified email.
- `db-access` raw-pg root-of-trust pattern (`provision-idp-user.ts`).
- ZITADEL transport (`docker/zitadel/seed.mjs`, `server/utils/oidc.ts`) — node:http + Host spoof + PAT.
- `ZITADEL_SEED_MODE=prod`'s "seed no users" branch (folded into the `empty` case).

## Implementation Task List

### Phase 1 — DB (fnb-app, new sqitch change after `00000000010290_session.sql`)
- [ ] `app_fn.anchor_exists()` (SECURITY DEFINER, granted to `authenticator`)
- [ ] `app_fn.initialize_anchor(...)` (SECURITY DEFINER, `search_path=pg_catalog,public`, hard
      `SETUP_ALREADY_COMPLETE` gate, granted to `authenticator`, no `app_api`)
- [ ] deploy/revert/verify via sqitch-expert; deploy on the empty env and confirm the gate

### Phase 2 — db-access
- [ ] `queries/anchor-exists.ts` → `anchorExists()`
- [ ] `mutations/initialize-anchor.ts` → `initializeAnchor(input)` (+ `InitializeAnchorInput`)
- [ ] barrel exports; `pnpm build` the package

### Phase 3 — auth-app server
- [ ] `server/utils/zitadel-admin.ts` — PAT-based management client (`createHumanUser`, `orgs/me`)
- [ ] `server/api/setup/status.get.ts` → `{ needsSetup }`
- [ ] `server/api/setup/initialize.post.ts` — ZITADEL-first, then `initialize_anchor`, gated
- [ ] auth-app compose env: `ZITADEL_INTERNAL_URL`, `ZITADEL_EXTERNAL_HOST`, `ZITADEL_PAT_FILE`

### Phase 4 — auth-app UI
- [ ] `app/pages/setup.vue` — the form + mount gate
- [ ] login-page gate: redirect `/auth/login → /auth/setup` when `needsSetup`
- [ ] success → redirect to the ZITADEL login

### Phase 5 — empty-env infrastructure
- [ ] `SEED_DATA` in `docker-compose.yml` (`db-migrate`, `zitadel-seed`)
- [ ] `docker/migrate-entrypoint.sh` conditional seed
- [ ] `docker/zitadel/seed.mjs` conditional user roster
- [ ] `scripts/env-build-empty.ts` (mirror `env-build.ts`, `SEED_DATA=empty`)
- [ ] `package.json`: `env-build-empty` (+ optional `env-rebuild-empty`)
- [ ] empty-env smoke test (infrastructure.md §Verification)

### Phase 6 — spec/doc sync (R21)
- [ ] Note the pre-claims carve-out addition where the OIDC trio is documented
      (`graphql-api-pattern.md` security section / `future-auth/zitadel-login-pattern.md`)
- [ ] `monorepo-bootstrap-pattern.md`: document `SEED_DATA` + `env-build-empty`
- [ ] CLAUDE.md Root Scripts: add `env-build-empty`

## Remaining Open Questions

- [ ] Password complexity handling at setup (enforce/display vs. surface ZITADEL's error). See
      `_shared.data.md`.
- [ ] `changeRequired` posture for the seeded ZITADEL user (currently `false`).
- [ ] Abuse gate on the unauthenticated endpoint — optional one-time `SETUP_TOKEN` for
      internet-exposed empty deploys. See `setup.data.md`.
- [ ] Post-success destination: auto-redirect into OIDC vs. land on `/auth/login?setup=success`.
      See `setup.ui.md`.
- [ ] Include `env-rebuild-empty` companion script? (Recommended yes.) See `infrastructure.md`.

## Considered & rejected

- **Install the base app at db-migrate time (a `seed-init.sql`).** Rejected: `create_anchor_tenant`
  already installs it idempotently, so a separate install step is redundant and would put app rows
  in the DB before any tenant exists. (Q&A: "inside the setup flow".)
- **Host the flow in home-app.** Rejected: home-app has no ZITADEL server utils or PAT volume;
  auth-app already does. (Q&A: "auth-app".)
- **DB-records-only, seed ZITADEL separately.** Rejected: the ask is explicitly "seed zitadel and
  redirect to that login". (Q&A: "runtime management API + password".)
- **Replace the dev seed entirely.** Rejected: too large a blast radius on the dev workflow; the
  empty path is an alternate gated on no-anchor. (Q&A: "alternate".)
- **Expose `initialize_anchor` via `app_api` / GraphQL.** Rejected: no claims exist at setup time;
  raw-pg + Nitro is the established pre-claims carve-out.
