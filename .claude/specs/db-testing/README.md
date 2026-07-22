# db-testing — pgTAP unit tests for the `db/` packages

> **Execution Directive:** plan + build this spec via `/fnb-stack-implementor .claude/specs/db-testing/README.md` —
> the implementor derives the `.claude/issues/` plan file (R23) from the task list below, then
> executes it. Never run `git`; never rebuild/restart the env yourself — write the code, hand the
> pg-image rebuild + first run to the user, then verify read-only.

## Status
**Draft** — pilot on `fnb-todo`, then roll out one package per phase. Resolve the `[FILL IN]`s and
Open Questions (seed-helper shapes; grant-shape pin-vs-desired) before the pilot lands.

## Purpose

There are **zero** database tests in the repo (`0260__test-foundation`). This spec adds a
per-package **pgTAP** suite that tests the three things that actually enforce the security and
correctness model — the things `sqitch verify` (deploy-time smoke checks) deliberately does **not**:

1. **RLS, direct on tables** — does each table's policy actually hide other tenants' rows and deny
   cross-tenant writes? (`rls-tests.md`)
2. **Permission gates on `<module>_api`** — does the api layer raise for a caller lacking the
   required `p:` key, and what's the grant shape? (`api-permission-tests.md`)
3. **`<module>_fn` behaviour** — do the privileged internals produce the right side effects,
   cascades, and exceptions? (`fn-behaviour-tests.md`)

pgTAP is the layer **above** `verify/*.sql`: `verify` answers "did this change land"; pgTAP answers
"does it behave". Keep them separate — do not convert working `verify` scripts to pgTAP.

Tests are Style-A `.sql` scripts in **`db/<pkg>/test/`**, one rolled-back transaction per file, run
by a new `pnpm db-test`. pgTAP is never shipped into the deployed schema.

## Locked decisions

| # | Decision | Why |
|---|---|---|
| D1 | **Style A** — script `.sql` + `pg_prove` (psql-`finish(true)` fallback), `BEGIN…plan()…finish()…ROLLBACK` per file | pgTAP stays out of the deployed schema; leaves no functions in the DB; matches `pgtap-expert/fnb-patterns.md` |
| D2 | Tests live in **`db/<pkg>/test/`**, siblings of `deploy/`; **not** sqitch changes, never in `sqitch.plan` | tests are behavioural, not migrations; keep them out of the deploy graph |
| D3 | pgTAP installed once into a **`tap`** schema (`CREATE EXTENSION pgtap SCHEMA tap`) | ~1000 functions don't pollute `public`; runner puts `tap` on `search_path` |
| D4 | Runner = new **`scripts/db-test.ts`** against the **running dev DB**, mirroring `db-exec.ts`/`_env.ts` | reuses existing tooling; rolled-back txns leave no trace on the dev DB |
| D5 | **Separate gate** — `pnpm db-test`, **not** folded into `pnpm test`/turbo | turbo `test` is per-package vitest and must run without Docker/Postgres; DB tests need both |
| D6 | pgTAP provisioning is **dev-only, two-halves**: OS package baked into a dev `docker/db.Dockerfile`; the **extension created on demand** by the runner (`db/_test/setup.sql`). `pg-bootstrap.sh` untouched | the `postgis/postgis` image lacks pgTAP; on-demand create keeps its ~1000 fns out of the DB until tests run, and keeps pgTAP **out of prod** (managed PG never builds this image). Evolved from "add to pg-bootstrap.sh", which would have leaked pgTAP into prod |
| D7 | **Pilot `fnb-todo` first**, then one package per later phase | simplest package (one table, clear `_fn`/`_api` split) proves the harness + all three categories end-to-end before scale-out |
| D8 | Grant-shape tests **pin current reality** and document divergences as GAPs | the actual `fnb-todo` grants/security differ from the idealized model (see below); a hardening pass is a separate spec |

### Reality the pilot exposes (do not "fix" in this spec — document it)

Reading `db/fnb-todo` showed the real code diverges from the idealized examples in the pgtap-expert
skill. The tests are written against **actual behaviour** and flag the gaps:

- **RLS policy `manage_all_for_tenant` is tenant-only** — no permission predicate, **no super-admin
  bypass**. `p:app-admin-super` does not widen visibility.
- **Permission gating is inconsistent** — only `todo_api.create_todo` checks `jwt.has_permission('p:todo')`;
  `update/delete/pin/assign/…` have no gate.
- **`todo_fn` is broadly granted + `SECURITY INVOKER`** — the policies file grants `all on all
  routines` in all three schemas to `anon, authenticated, service_role`. The `_fn`/`_api` split is
  **organizational, not a privilege boundary**; isolation is RLS + api-layer permission checks.

Surfacing exactly these gaps is the point (`0260`). Tightening them is out of scope here.

## Files in this spec

| File | Contents |
|---|---|
| `README.md` | this index |
| `_shared.md` | roles + claims mechanism; `test._login/_logout/_seed_*` helpers; FK/seed rules; file layout + naming; assertion cheat-sheet |
| `harness.md` | pgTAP provisioning (image + bootstrap); `scripts/db-test.ts` design; pg_prove vs psql-fallback; `package.json`/CI wiring |
| `rls-tests.md` | `010-rls.sql` — tenant-isolation assertions direct on tables |
| `api-permission-tests.md` | `020-api-permissions.sql` — permission-gate + grant-shape assertions on `<module>_api` |
| `fn-behaviour-tests.md` | `030-fn-behaviour.sql` — side effects / cascades / exceptions on `<module>_fn` |

## Implementation Task List

### Phase 1 — Harness + `fnb-todo` pilot (proves the whole pattern) — IMPLEMENTED, pending user rebuild+run
- [x] **pgTAP provisioning** (D3/D6): `docker/db.Dockerfile` (`FROM postgis/postgis` + `postgresql-${PG_MAJOR}-pgtap`);
      `docker-compose.yml` `db` service now `build`s it. Extension created on demand by the runner
      (`db/_test/setup.sql`), **not** in `pg-bootstrap.sh`. **Rebuild is the user's hand-off.**
- [x] **`scripts/db-test.ts`** (D4): resolves `db/<pkg>/test/*.sql` (all / one pkg / prefix); runs
      `db/_test/setup.sql` (pgTAP + `test` helper schema `_login/_logout/_seed_*`) then
      `db/_test/teardown.sql`; psql runner parsing TAP for `not ok`/plan-mismatch; per-file
      pass/fail summary; non-zero exit + pgtap-missing hand-off message. (pg_prove path deferred.)
- [x] Added `"db-test": "tsx scripts/db-test.ts"` to root `package.json` (D5).
- [x] Seed-helper shapes resolved against real `app.tenant`/`app.resident` (verified columns; the
      `res.resource` deferred FK means no registry row needed under ROLLBACK) — in `db/_test/setup.sql`.
- [x] `db/fnb-todo/test/010-rls.sql` — tenant isolation on `todo.todo` (`rls-tests.md`).
- [x] `db/fnb-todo/test/020-api-permissions.sql` — `create_todo` gate + grant-shape pins + GAP notes.
- [x] `db/fnb-todo/test/030-fn-behaviour.sql` — create side effects / name guard / status cascade / template guard.
- [x] **`pnpm db-test fnb-todo` → all 3 files green** (2026-07-21, after the user's image rebuild).
      Verification surfaced + fixed two seed/test bugs: the immediate `resident_urn` FK (seed must
      register the resident) and the data-modifying-CTE restriction (both now in `_shared.md`).

### Phase 2 — Roll out across all packages — DONE (2026-07-21): `pnpm db-test` = 23 files / 135 assertions green
Every db package now has a `test/` tree (`010`/`020`/`030` where warranted):
- [x] `fnb-auth` — `030-jwt-helpers.sql` (auth.user is dropped → the value is the `jwt.*` helpers:
      identity accessors, `has_permission`, `enforce_permission`, empty-claims). **Found a live bug** —
      see below.
- [x] `fnb-app` — `010-rls.sql` (profile self / super-admin / reference-catalog / own-tenant). Subset;
      fuller coverage (resident multi-policy, licenses, support tickets, `auth.session` deny-all) is future work.
- [x] `fnb-res` — `010-rls.sql` (`resource_select`: module-permission-gated + null-key tenant membership + super).
- [x] `fnb-game` — `010-rls.sql` (public game_type, tenant games, **per-seat pending-event redaction**,
      deny-all `game_event_state`) + `020-grant-shape.sql` (the **closed `game_fn` surface** — anti-0020).
- [x] `fnb-storage` — `010-rls.sql` (tenant p:app-user/admin, super-admin, **anon grant-level lockout**).
- [x] `fnb-msg` — `010-rls.sql` (`p:discussions` select/insert, no-update-policy) + `020` (upsert_topic gate + GAP).
- [x] `fnb-loc` — `010-rls.sql` (tenant manage + public overlay).
- [x] `fnb-n8n` — `010-rls.sql` (**null-tenant super-admin branch**) + `020` (workflow_runs gate).
- [x] `fnb-location-datasets` · `fnb-airports` — `010-rls.sql` structural public-catalog smoke (RLS on,
      SELECT-only, no write policy, anon reads).
- [ ] Add a CI job (disposable DB → deploy → `db-test`) once the dev flow is proven (`harness.md` §4).
- [ ] If the harness approach becomes a documented convention, update `global-rules.md` + both
      skills (R21) and register nothing new in `skill-map.md` beyond the existing `pgtap-expert`.

**Finding (2026-07-21) — FIXED: `jwt.has_all_permissions` was broken.** The test caught it live: body
referenced `_permission_key` (param is `_permission_keys`) → `undefined_column`, and the rename alone
still failed (`LIKE <array>`). Fixed to exact array containment (`_permission_keys <@
jwt.user_permissions()`, mirroring `has_permission`'s exact match) and verified green. This closed the
already-identified **`0150__auth__jwt-has-all-permissions-bug`**. `db/fnb-auth/test/030-jwt-helpers.sql`
now asserts the correct true/all-held + false/one-missing behaviour.

### Phase 2 follow-ups — DONE (2026-07-21)
- [x] Fuller `fnb-app` RLS: `011-rls-resident-session.sql` (resident view_all_for_tenant, own vs
      tenant-admin update, `auth.session` deny-all) + `012-rls-license-support.sql` (license
      own-profile/tenant-admin/cross-tenant + support_ticket own-resident/tenant-admin/support-staff,
      self-seeding the `tenant_subscription`→`license_pack`/`license_type`/`application` chain). **All
      14 app RLS tables now covered.**
- [x] `_fn` behaviour across the stack: `res` (build_urn/register/idempotent/archive/uuid_v7),
      `msg` (upsert_topic: create + register + initial message + identifier-idempotent + bad-resident),
      `loc` (create_location: tenant/resident_urn/urn/register + bad-resident), `game`
      (create_game: lobby/seats/roster/register + type-availability + seat-bounds guards), `app`
      (session lifecycle: create/revoke/revoke_my_sessions/claims fail-closed).

## Remaining Open Questions
- [x] **Seed helpers** — RESOLVED: hand-written against the real `app.tenant`/`app.resident` columns
      in `db/_test/setup.sql` (explicit-id helpers; no `res.resource` seeding needed under ROLLBACK).
- [x] **Grant-shape tests** — RESOLVED: pin reality (D8); divergences recorded as GAP assertions.
- [ ] **pg_prove availability** — dedicated image, host binary, or psql-only forever? (Currently
      psql + TAP-parsing in `db-test.ts`; works with the stock `postgres:18` client. `harness.md`.)
- [ ] **`db-rebuild`** — re-create the `tap` extension, or leave it to the on-demand runner path?
      (Runner recreates it idempotently each run, so no action needed unless a faster path is wanted.)
- [ ] **CI DB** — disposable-DB job now, or dev-only until the rollout matures? (managed PG's pgTAP
      allow-list is unknown — out of scope for the pilot.)

## Considered & rejected
- **xUnit `runtests()` + a deployed `test` schema** — redeployable and auto-isolated, but ships test
  functions into the DB; rejected in favour of Style-A scripts that leave no trace (D1).
- **Folding DB tests into `pnpm test`/turbo** — rejected: that pipeline is per-package vitest with no
  Docker/Postgres dependency; a DB integration gate must stay separate (D5).
- **Converting `verify/*.sql` to pgTAP** — rejected: `verify` is a working deploy-time smoke layer
  with different semantics (no RLS context); pgTAP sits above it.
- **Testing against a throwaway DB for the pilot** — deferred to CI (`harness.md` §4); the dev DB +
  rolled-back txns is faster for the local authoring loop and leaves no trace.
