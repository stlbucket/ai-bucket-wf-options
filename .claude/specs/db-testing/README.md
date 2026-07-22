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

### Phase 2+ — Roll out (one package per phase, security-critical first)
Deploy-order list, each phase = its own `test/` tree (`010`/`020`/`030` where the package has
tables/api/fn respectively; skip a file the package doesn't warrant):
- [ ] `fnb-auth` · [ ] `fnb-app` · [ ] `fnb-res` · [ ] `fnb-game` · [ ] `fnb-storage`
      (security-critical: RLS + registry + referee)
- [ ] `fnb-msg` · [ ] `fnb-loc` · [ ] `fnb-n8n` (the `n8n_worker` grants + null-tenant policy branch)
- [ ] `fnb-location-datasets` · [ ] `fnb-airports` (thinner data packages — RLS + any `_fn`)
- [ ] Add a CI job (disposable DB → deploy → `db-test`) once the dev flow is proven (`harness.md` §4).
- [ ] If the harness approach becomes a documented convention, update `global-rules.md` + both
      skills (R21) and register nothing new in `skill-map.md` beyond the existing `pgtap-expert`.

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
