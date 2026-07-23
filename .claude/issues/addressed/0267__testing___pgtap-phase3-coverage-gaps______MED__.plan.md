# 0267 — db-testing Phase 3: close the pgTAP coverage gaps + CI gate

> **Execution Directive:** execute this plan via `/fnb-stack-implementor .claude/issues/identified/0267__testing___pgtap-phase3-coverage-gaps______MED__.plan.md`.
> Derived from `.claude/specs/db-testing/README.md` Phase 3 (2026-07-23). Never run `git`; never
> rebuild/restart the env yourself — author the `db/<pkg>/test/*.sql` files, hand the `pnpm db-test`
> run to the user, then verify read-only. Tests pin **actual behaviour** (D8) — flag divergences as
> GAP assertions, do not harden here.

## Status
**Executed (2026-07-23)** — Tasks 1–7 landed + verified green (`pnpm db-test` = **36 files / 225
assertions**, up from 27/159); Task 8 (CI workflow) authored, pending owner CI-enable. SEV: MED.
Two GAPs surfaced for a future hardening spec: `loc_api` is fully ungated (RLS-only isolation), and
`loc_fn.delete_location` calls `res_fn.archive_resource` unconditionally (cross-tenant archive).

## Context
`db-testing` Phases 1–2 shipped a working pgTAP harness (27 files / 159 assertions, `pnpm db-test`).
Coverage is skewed to RLS (`010`): api-permission (`020`) is on only 5/12 packages and **absent on
`fnb-app`**; fn-behaviour (`030`) is missing on 4 packages; and the suite is a dev-only gate, not
enforced in CI. This plan closes those gaps, ordered by security payoff.

Harness contract (do not relitigate): Style-A `.sql`, one rolled-back txn per file,
`begin; set search_path to tap, public; select plan(N); … select * from finish(); rollback;`.
Seed helpers `test._login/_logout/_seed_tenant/_seed_resident` from `db/_test/setup.sql`
(specs `_shared.md`). Assertion patterns: `throws_ok(sql,'P0001',NULL,label)` for the stack's
`raise exception '3xxxx: …'`; `function_privs_are` / `isnt_definer` for grant shape.

## Reality corrections to the README's Phase 3 bullets (found during planning, 2026-07-23)
Verified against the deploy SQL — the plan supersedes the README where they differ; fold back on completion:
1. **`storage_api` does not exist.** Storage's write path is the upload endpoint carve-out (H3) +
   an `n8n_worker`-only `storage_fn` surface (`asset_for_scan`, `stuck_pending_assets`,
   `resolve_asset_scan`, `insert_derived_asset`, `add_asset_tags`) explicitly revoked from
   `authenticated`/`anon` (`db/fnb-storage/deploy/00000000010640_storage_n8n_worker.sql`,
   `…010630_storage_resolve_scan.sql`). → 3a-storage is **not** an api-permission test; it becomes a
   **grant-shape lockout** (`020`) + a `storage_fn` behaviour test run as `service_role`/`n8n_worker` (3b).
2. **`res_api` has only `resolve_urn`** (a lookup, `db/fnb-res/deploy/00000000011030_res_api.sql`) —
   no gated mutation. `res_fn` behaviour (`build_urn`/`register`/`archive`) is already covered by the
   Phase-2 `db/fnb-res/test/030-fn-behaviour.sql`. → 3a-res collapses to a thin grant-shape check; **low
   value, deprioritized** (Phase 3e-optional).
3. **`fnb-app` permission gates live in `app_fn`, not `app_api`.** The `_api` layer delegates straight
   through; enforcement is in `00000000010242_app_fn_definers.sql`, `…010240_app_fn.sql`, and
   `…010243_app_fn_support.sql`. → Test the observable gate **at the `app_api` boundary** (what
   PostGraphile exposes), regardless of which layer raises.

---

## Phase 3a — api-permission (`020`) gaps

### Task 1 — `db/fnb-app/test/020-api-permissions.sql` (HIGHEST PRIORITY) — ✅ DONE (2026-07-23)
Landed 6/6 green (become_support super-OR-support negative; update_tenant_status super negative +
positive; set_nested_tenant_type admin negative; 2 grant-shape pins). Full suite 28 files / 165
assertions. Gotcha recorded: psql does not interpolate `:'var'` inside `$$…$$` — hardcode uuid
literals inside dollar-quoted payloads.

The 16-table security core has zero api-permission coverage. Test the real gates at the `app_api`
boundary, positive + negative, plus grant-shape pins. Verified gate anchors:
- `become_support(_tenant_id uuid)` — requires `p:app-admin-super` **OR** `p:app-admin-support`
  (`010243_app_fn_support.sql:12-14`). Negative: caller with only `p:app-user` → `throws_ok P0001`.
- `p:app-admin`-gated: `app_fn` `enforce_permission('p:app-admin')` at `010240_app_fn.sql:731,806,1555`
  and `010243_app_fn_support.sql:248,288` (e.g. `submit_support_ticket_comment`, tenant/user admin ops).
- `p:app-admin-super`-gated: `enforce_permission('p:app-admin-super')` at `010240_app_fn.sql:1511,
  1585,1604,1634,1664,1699` (tenant-type / cross-tenant admin ops).
- **GAP candidates** (soft/no gate): `invite_user` uses `has_permission('p:app-admin')` as a *branch*,
  not a hard gate (`010240_app_fn.sql:1368`) — pin current behaviour with a GAP note.
- Grant shape: `function_privs_are('app_api', <fn>, <exact arg types>, 'authenticated', ARRAY['EXECUTE'])`;
  copy arg types verbatim from `pg_get_function_identity_arguments(...regprocedure)`.
- Pick ~3 gated fns (one each: super, admin, super-OR-support) × (positive+negative) + 2–3 grant pins.
  Seed the tenant/resident + (for positive paths) any subscription/license chain the fn touches — reuse
  the self-seeding pattern from `db/fnb-app/test/012-rls-license-support.sql`.

### Task 2 — `db/fnb-loc/test/020-api-permissions.sql` — ✅ DONE (2026-07-23)
Landed 6/6 green. **Finding:** `loc_api` create/update/delete are entirely **ungated** — isolation is
RLS tenant-match only (`manage_all_for_tenant`, no `p:loc` predicate). File documents this as GAPs
(create succeeds with empty perms; delete returns true for another tenant's location but RLS makes it
a no-op). **Deeper GAP noted (not asserted):** `loc_fn.delete_location` calls `res_fn.archive_resource`
unconditionally, so a cross-tenant delete can archive the registry row while the location survives —
candidate for a future hardening spec.

`loc_api` real surface: `create_location`, `update_location(...)`, `delete_location(_location_id uuid)`
(`db/fnb-loc/deploy/…loc_api.sql`). Assert the permission gate each enforces (confirm the `p:` key at
the `_api`/`_fn` boundary — `loc` gates on the loc module key), positive + negative, + grant shape.
Reuse the seed pattern from the existing `db/fnb-loc/test/010-rls.sql` / `030-fn-behaviour.sql`.

### Task 3 — `db/fnb-storage/test/020-api-permissions.sql` (reframed per correction #1) — ✅ DONE (2026-07-23)
Landed 6/6 green as a **grant-shape lockout**: `authenticated`/`anon` have zero privileges on the
`storage_fn` scan surface (`resolve_asset_scan`, `asset_for_scan`, `insert_derived_asset`); `n8n_worker`
may EXECUTE. Confirmed the broad `grant execute on all routines` in `…010620_storage_policies.sql:14`
predates the scan functions, so it does not re-open them. File is `…010625` (not `010630`).

There is **no `storage_api`** — assert the **lockout** instead: `authenticated` and `anon` **cannot**
`EXECUTE` the `n8n_worker`-only `storage_fn` surface (`function_privs_are(... 'authenticated', ARRAY[]::text[])`
after the explicit `revoke`), and `n8n_worker` **can**. Anchors: the revoke/grant block in
`00000000010640_storage_n8n_worker.sql:85-94` + `…010630_storage_resolve_scan.sql:38-40`. This pins the
security-relevant fact (worker-only write path) as a regression detector.

---

## Phase 3b — fn-behaviour (`030`) gaps

### Task 4 — `db/fnb-n8n/test/030-fn-behaviour.sql` — ✅ DONE (2026-07-23)
13/13 green: begin_run → running; running_count; complete_run success + finished_at + result_data;
error_run + payload; error_run_by_execution flip + silent no-op; complete_run unknown-id guard.
Unique workflow_key isolates running_count from real rows.

`n8n_fn` run-log lifecycle (`db/fnb-n8n/deploy/…n8n_fn.sql`): `begin_run(...)` inserts a
`n8n.workflow_run` row (status `running`); `complete_run(...)` → terminal `success`;
`error_run(...)` / `error_run_by_execution(...)` → `error` with the message; `running_count(_workflow_key)`
reflects in-flight rows. Run as the owner/`n8n_worker` (these are the worker write surface — no
`jwt.*` gate). Assert: happy-path status transitions, the count fn, and any bad-input raise. One
rolled-back txn; seed no tenant needed if `workflow_run` allows null-tenant engine rows (verify against
`010-rls.sql`'s null-tenant assumption).

### Task 5 — `db/fnb-storage/test/030-fn-behaviour.sql` — ✅ DONE (2026-07-23)
12/12 green: resolve_asset_scan clean-promote + storage_key rewrite, idempotent no-op, infected→
asset_status deleted cascade, unknown-id guard; insert_derived_asset born-clean + parent-link +
tenant inheritance + idempotency; add_asset_tags set-union dedup + guard. Run as owner (definer).

`storage_fn` behaviour run as `service_role`/`n8n_worker`: `resolve_asset_scan(uuid, scan_status,
text, text)` status cascade (pending → clean/infected and side effects), `insert_derived_asset(...)`,
`add_asset_tags(...)`. Anchors: `…010630_storage_resolve_scan.sql:5`, `…010640_storage_n8n_worker.sql:11,33`.
Seed an `storage.asset` row in `pending` first (owner insert, pre-`_login`). Assert the derived status
+ any guard raise.

### Task 6 — `fnb-location-datasets` · `fnb-airports` `030` — ✅ DONE (2026-07-23; NOT N/A)
Both have real `_fn` upsert layers backing the sync workflows → wrote idempotency tests.
`fnb-location-datasets/030` (7/7): `upsert_breweries` insert/update accounting, upstream enum
coercion → 'unknown' + raw-in-notes, idempotency (reads the real anchor tenant, rows roll back).
`fnb-airports/030` (7/7): `upsert_countries` (FK-free root) same shape. Gotchas: `taproom` is now a
valid brewery_type (enum extended) — used a synthetic invalid label; pgTAP `like()` had a
signature-resolution error → used `ok(… like …)`.

These are public catalogs synced by n8n `sync-*` workflows. **Verify** whether either has a `_fn`
layer with in-DB side effects (`grep -rE 'CREATE .*FUNCTION (location_datasets|airports)_fn'`
db/fnb-location-datasets/deploy db/fnb-airports/deploy). If none → **record N/A** in this plan and in
the README (no empty file). If a sync/upsert `_fn` exists → a minimal upsert-idempotency `030`.

---

## Phase 3c — deepen `fnb-app` RLS coverage
### Task 7 — audit the 16 RLS tables vs the three existing files — ✅ DONE (2026-07-23)
Audit result: covered before = profile/resident/tenant/session (010,011), license/support_ticket/
tenant_subscription/application/license_pack/license_type (012), permission (010), deep_link/otp_login
(031 schema shape). **Uncovered = the 5 reference catalogs' join tables + support_ticket_comment.**
Added `013-rls-catalog.sql` (4/4 — application, license_pack, license_pack_license_type, license_type,
license_type_permission: RLS on, SELECT-only, no write policy, USING(1=1) visibility) and
`014-rls-support-comment.sql` (5/5 — support_ticket_comment: own resident / unrelated-denied / tenant
admin / support staff). **All 16 app RLS tables now have coverage.**

Files: `010-rls.sql`, `011-rls-resident-session.sql`, `012-rls-license-support.sql`. The 16 RLS-enabled
tables: `app.application`, `app.license`, `app.license_pack`, `app.license_pack_license_type`,
`app.license_type`, `app.license_type_permission`, `app.permission`, `app.profile`, `app.resident`,
`app.support_ticket`, `app.support_ticket_comment`, `app.tenant`, `app.tenant_subscription`,
`auth.deep_link`, `auth.otp_login`, `auth.session`. Cross-check each against the three files; add
tenant-isolation assertions for any table with **no** coverage (likely candidates: `application`,
`license_pack`, `license_pack_license_type`, `license_type`, `license_type_permission`, `permission`,
`support_ticket_comment`). Extend the existing files or add `013-rls-catalog.sql`; one rolled-back txn
per file. Reference RLS policies: `db/fnb-app/deploy/00000000010250_app_policies.sql`.

---

## Phase 3d — enforce it in CI (promote from dev-only gate)
### Task 8 — CI job: disposable DB → deploy → `db-test` — ✅ AUTHORED (2026-07-23; CI-verify pending owner)
Wrote `.github/workflows/db-test.yml`: on push-to-main / PR touching `db/**` + the db scripts +
`docker/db.Dockerfile` (and `workflow_dispatch`) → build the PostGIS+pgTAP image → run a disposable
`function_bucket` container on a hand-created `fnb-network` (replicates only the `db` compose service,
so no other services' env is needed) → `pnpm db-deploy` (roles + full sqitch order + seed) →
`pnpm db-test` → always tear down. Throwaway credential; no host port. **Cannot be verified from
here** — CI runs on push, and `pnpm db-deploy` must NOT run locally (it would redeploy/reseed the dev
DB via `.env`). YAML + structure checked. Owner enables Actions / commits (house convention).
Follow-up (unchanged): `pg_prove` adoption stays optional (psql-fallback gates fine); the R21
convention-docs tail is now due — see below.

Per `harness.md` §4. CI builds `docker/db.Dockerfile` (pgTAP available there — the managed-PG
allow-list question is moot unless CI ever points at managed PG). Job: spin a disposable Postgres →
`sqitch deploy` full order (`fnb-auth fnb-app fnb-n8n fnb-notify fnb-res fnb-msg fnb-todo fnb-loc
fnb-storage fnb-location-datasets fnb-airports fnb-game`) → `pnpm db-test` → non-zero on any `not ok`
/ plan-mismatch. Unblocks the two long-standing Phase-2 `[ ]` items (CI job + convention docs).
`pg_prove` vs psql-fallback: psql-fallback is sufficient to start (Open Question in README stays open;
adopt pg_prove only if richer CI TAP diagnostics are wanted).

---

## Verification (read-only, after the user's `pnpm db-test` run)
- Each new file: `pnpm db-test <pkg>` → all planned assertions green; `plan(N)` matches emitted count.
- Full-suite regression: `pnpm db-test` → still all green, new file/assertion totals up.
- Update `.claude/specs/db-testing/README.md`: check off the Phase 3 items actually landed, record any
  3f N/A decision (Task 6), bump the totals, and — if the CI gate + convention land — do the R21 tail
  (`global-rules.md` + both skills).

## Sequencing
3a-Task1 (fnb-app 020 — highest payoff) → 3a-Task2/3 → 3b-Task4/5 → 3b-Task6 (verify N/A) →
3c-Task7 → 3d-Task8 (CI). Each task is independently landable + testable; stop after each for the
user's `db-test` run rather than batching (rolled-back txns, but the run needs Docker+PG).

## Considered & rejected
- **Hardening the ungated `app_api`/`todo_api` fns as part of this plan** — out of scope (D8: pin
  reality, flag GAPs). A tightening pass is a separate spec so each flip is a deliberate, test-visible change.
- **Writing empty `030` files for the public-catalog packages** — rejected; record N/A instead (Task 6).
- **Adopting `pg_prove` before CI** — deferred; psql-fallback already parses TAP and gates correctly.
