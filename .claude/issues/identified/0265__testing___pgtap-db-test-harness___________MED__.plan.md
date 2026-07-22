# Plan: pgTAP DB test harness + `fnb-todo` pilot (RLS / api-permission / _fn behaviour)

> **Execution Directive:** Implement via the `fnb-stack-implementor` skill.
> Invoke: `/fnb-stack-implementor <this-file>`.
> Spec source of truth: `.claude/specs/db-testing/` (README + `_shared.md`, `harness.md`,
> `rls-tests.md`, `api-permission-tests.md`, `fn-behaviour-tests.md`). For pgTAP assertion
> choice/semantics → skill `pgtap-expert`; for the real `app.tenant`/`app.resident`/`res.resource`
> shapes the seed helpers need → skill `fnb-db-designer`.
> Gate: **`pnpm db-test fnb-todo` all-green** (this plan adds that script). `pnpm build` must stay
> green (the new `scripts/db-test.ts` is tsx, not a package). Never run `git`. **Never rebuild/
> restart the env yourself** — the pgTAP-image step is a hand-off to the user; then verify read-only.

**Severity: MED** (test foundation) · Workstream: WS5 / testing · Concretely realizes the "RLS smoke
suite" item of `0260__testing___test-foundation` and answers the harness question that plan left open.

## Details

Zero DB tests exist. This plan stands up a per-package **pgTAP** suite (Style A — script `.sql` +
rolled-back txn per file; pgTAP never shipped into the deployed schema) and proves it end-to-end on
the simplest package, `db/fnb-todo`, across all three categories the spec defines:
RLS-direct-on-tables, `_api` permission gates + grant shape, and `_fn` behaviour.

Locked decisions (full table + the "why" in `.claude/specs/db-testing/README.md`): Style A;
tests in `db/<pkg>/test/` (not sqitch changes, never in `sqitch.plan`); pgTAP in a `tap` schema;
runner = new `scripts/db-test.ts` against the running dev DB; separate `pnpm db-test` gate (not
folded into turbo `test`); grant-shape tests **pin current reality** and document divergences as GAPs.

### Reality the pilot documents (do NOT "fix" here — see spec README)
`db/fnb-todo` diverges from the idealized pgtap-expert examples; tests assert actual behaviour:
- RLS `manage_all_for_tenant` is **tenant-only** (no permission predicate, no super-admin bypass).
- Only `todo_api.create_todo` gates on `jwt.has_permission('p:todo')`; the rest are ungated.
- `todo_fn` is broadly granted + `SECURITY INVOKER` — the `_fn`/`_api` split is organizational,
  not a privilege boundary. `is_definer`-style assertions from the skill do NOT apply.

## [FILL IN] gate — resolve before writing the pilot test files
- **Seed-helper shapes** (`_shared.md` Open Question): hand-write `test._seed_tenant` /
  `test._seed_resident` against the real `app.tenant` / `app.resident` columns (confirm with skill
  `fnb-db-designer`, anchors below), OR reuse `db/seed.sql`. The pilot's correctness depends on these.
  → decide at the top of Phase 1, before task 5.

## Code anchors (verified)
- pg image lacks pgTAP: `docker-compose.yml:25` (`image: postgis/postgis`).
- Extension bootstrap slot: `infra/docker/pg-bootstrap.sh:62` (`CREATE EXTENSION IF NOT EXISTS postgis`).
- Runner pattern to mirror: `scripts/db-exec.ts` (`docker run --rm -i --network fnb-network …
  postgres:18 psql ${PG_URL} …`) + `scripts/_env.ts` (`PG_URL`/`DB_URL` from `.env`).
- Root scripts block to extend: `package.json` (`db-exec`, `db-psql`, `db-deploy`, …).
- Pilot package: `db/fnb-todo/deploy/00000000010450_todo.sql` (`todo.todo` table + FKs),
  `…010470_todo_fn.sql` (`todo_api`/`todo_fn` fns), `…010480_todo_policies.sql` (grants + the
  `manage_all_for_tenant` RLS policy).
- Seed-helper targets (confirm columns): `db/fnb-app/deploy/00000000010220_app.sql`
  (`app.tenant`, `app.resident`); `db/fnb-res/` (`res.resource`, `res_fn.register_resource`).

## Implementation status (2026-07-21) — Phase 1 COMPLETE + VERIFIED

`pnpm db-test fnb-todo` → **all 3 files green** after the user's image rebuild. Verification caught +
fixed two seed/test bugs (now documented in `_shared.md` for the Phase 2 rollout): the immediate
`todo.resident_urn → res.resource(urn)` FK (so `test._seed_resident` must `register_resource` the
resident), and Postgres's "no data-modifying CTE inside a subquery/assertion" rule (assert
cross-tenant no-op writes as a plain statement + owner read-back). Phase 1 (harness + pilot) is done;
Phase 2 (rollout) remains open and is explicitly **not required to close this plan**. Design refined during build: pgTAP provisioning is
**dev-only** — OS package baked into `docker/db.Dockerfile` (dev `db` service now `build`s it), and
the **extension is created on demand** by the runner (`db/_test/setup.sql`), so `pg-bootstrap.sh`
stays untouched and **prod never gets pgTAP** (managed PG never builds this image). Files added:
`docker/db.Dockerfile`, `scripts/db-test.ts`, `db/_test/{setup,teardown}.sql`,
`db/fnb-todo/test/{010-rls,020-api-permissions,030-fn-behaviour}.sql`; edits to `docker-compose.yml`
(db build) + root `package.json` (`db-test` script). Runner wiring validated read-only (discovery +
`_env` load); a green pgTAP run is blocked on the rebuild. Spec updated to match (README D6, `harness.md`
§1, `_shared.md` seed helpers; seed-shape + grant-shape Open Questions resolved).

## Task list — Phase 1 (harness + `fnb-todo` pilot) = this plan's executable unit

1. **[DONE, rebuild = user] pgTAP provisioning (dev-only).** `docker/db.Dockerfile`
   (`FROM postgis/postgis` + `postgresql-${PG_MAJOR}-pgtap`); `docker-compose.yml` `db` service
   `build`s it (`image: fnb-db-pgtap:local`). Extension created on demand by `db/_test/setup.sql`
   (`CREATE EXTENSION IF NOT EXISTS pgtap SCHEMA tap` + `grant usage on schema tap to public`).
   `pg-bootstrap.sh` deliberately untouched. **User runs `docker compose build db && docker compose
   up -d db`**, then the runner works.
2. **`scripts/db-test.ts`** mirroring `db-exec.ts`/`_env.ts`: resolve `db/<pkg>/test/*.sql`
   (all packages, or an arg-named one, or an arg prefix); `\i` a preamble that creates the `test`
   helper schema (`_login`/`_logout`/`_seed_*` from `_shared.md`) **outside** the per-file txns,
   then drop `test` at the end; fail fast with a pointer to harness.md §1 if the `tap` extension is
   absent; **psql-only fallback path first** (`docker run … postgres:18 psql … -v ON_ERROR_STOP=1
   -f <file>`, each file ends `SELECT * FROM finish(true);`, `search_path` includes `tap`);
   aggregate exit codes; per-file pass/fail summary; non-zero on any failure. (pg_prove path = later enhancement.)
3. Add `"db-test": "tsx scripts/db-test.ts"` to root `package.json` (next to `db-exec`). Do **not**
   add it to turbo `test` (that pipeline is per-package vitest, no Docker/Postgres).
4. **Resolve the seed-helper [FILL IN]** (see gate above) with skill `fnb-db-designer`.
5. `db/fnb-todo/test/010-rls.sql` — tenant isolation on `todo.todo` per `rls-tests.md`
   (tenant-A-only `set_eq`; other tenants `is_empty`; cross-tenant INSERT `throws_ok('42501')`;
   cross-tenant UPDATE/DELETE = row-count no-op; `p:app-admin-super` still tenant-scoped; anon empty).
6. `db/fnb-todo/test/020-api-permissions.sql` — `create_todo` gate positive/negative (`P0001`);
   grant-shape pins via `function_privs_are` + `isnt_definer`; GAP notes for the ungated api fns and
   the broad `todo_fn` grant, per `api-permission-tests.md`.
7. `db/fnb-todo/test/030-fn-behaviour.sql` — `create_todo` side effects (ordinal 0, `root_todo_id=id`,
   generated `urn`, `res.resource` row); name guard `30028`; status cascade (last child complete →
   parent complete); template guard `30029`; delete cascade + `archive_resource`; `deep_copy_todo`
   `30030` + subtree copy — per `fn-behaviour-tests.md`. Build ≥2-level fixtures so recursion runs.
8. **Verification (user-run, then read-only confirm):** user runs `pnpm db-test fnb-todo` → all
   files green. `pnpm build` still green. Confirm no test artifacts landed in `db/fnb-todo/deploy/`
   or `sqitch.plan`, and the `test` helper schema is dropped after the run (not persisted in the DB).

## Task list — Phase 2+ (follow-on; not required for this plan to close)
Roll the same `010`/`020`/`030` pattern out one package per pass, security-critical first
(`fnb-auth`, `fnb-app`, `fnb-res`, `fnb-game`, `fnb-storage`), then `fnb-msg`/`fnb-loc`/`fnb-n8n`
(cover the `n8n.workflow_run` null-tenant policy branch), then the thin data packages. Add a
disposable-DB CI job once the dev flow is proven (`harness.md` §4). If the harness becomes a
documented convention, update `global-rules.md` + both skills (R21). Track these as their own
`identified/` items or check them off the spec README — out of scope for closing this plan.

## Verification (summary)
- `pnpm db-test fnb-todo` all-green (user-run); the suite **fails** if RLS is disabled on `todo.todo`
  or the `create_todo` gate is removed (prove it detects regressions).
- `pnpm build` green. No pgTAP functions in the deployed schema; `test` schema dropped post-run.
- Tests live only under `db/fnb-todo/test/`; nothing added to `deploy/` or `sqitch.plan`.
