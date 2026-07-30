# URN Registry (`fnb-res`) — Spec Index

> **Execution Directive:** plan + build this spec via `/fnb-stack-implementor
> docs/specs/urn-registry/README.md` — the implementor derives the `docs/issues/` plan
> file (R23) from the task list below, then executes it.

## Status
Implemented — 2026-07-10 (same-day revision folded in identity registration, shadow-mirror
removal, the URN reference plane, and the in-place-edit retrofit; verified against the
rebuilt stack). **Stacking v2 implemented + verified 2026-07-10** — the post-v1 audit's three
conversions (`stacking-v2.data.md`): storage `context`/`owning_entity_id` retired for
`subject_urn`, `msg.topic.subject_urn` replaces the todo id-sharing hack, dead
`support_ticket.topic_id` dropped.

## Purpose

Every business object gets a universal address — `urn:fnb:{tenant_id}:{module}:{type}:{id}` —
stored as a **generated column** on its own table and recorded in a central registry
(`res.resource`) that is a real FK target. Capability modules stack onto any object via
`subject_urn` (storage assets first), and PostGraphile grows a "resource hub"
(`thing → resource → everything attached`) with zero coupling between module schemas.
**No triggers anywhere** — the URN is computed by one central `IMMUTABLE`
`res_fn.build_urn()` invoked from column definitions; registration is an explicit call in
the `_fn` write path, enforced by a deferred FK.

The registry is also the **reference plane**: tenants and residents register too, module
tables reference residents by URN (`posted_by_resident_urn` etc.), and the legacy
`<module>_tenant`/`<module>_resident` mirror tables are removed (`_shared.data.md` §6).

Origin: `.claude/analysis/bloated-unicorn.analysis.md` §4 (Reign platform-plan §2 adapted to
fnb). This spec supersedes the analysis where they differ.

## Locked decisions

| Decision | Choice | Why |
|---|---|---|
| URN column mechanism | `GENERATED ALWAYS AS (res_fn.build_urn(tenant_id,'<module>','<type>',id)) STORED` | User-directed non-trigger requirement; central grammar function; impossible to forget or diverge; covers all write paths. Full case: `_shared.data.md` §3. |
| Alternative considered per user ask | Plain `urn text NOT NULL` + `CHECK(urn = build_urn(…))`, set at every `_fn` insert site | Rejected — a DEFAULT can't see the row's other columns, so it's per-site ceremony for identical integrity; only adds a runtime forget-failure mode. |
| Registry population | Explicit `res_fn.register_resource()` in each `_fn` create function | Non-trigger; safe because `disableDefaultMutations: true` makes `_api`→`_fn` the only write path (R8). |
| Enforcement | `FOREIGN KEY (id) REFERENCES res.resource(id) DEFERRABLE INITIALLY DEFERRED` on every registered table | Forgetting to register fails at commit, loudly. Deferred so existing `insert … returning id` shapes keep working — retrofit is one appended `perform` per site. |
| Delete semantics | Hard delete leaves the registry row (= tombstone); `_fn` delete sites call `res_fn.archive_resource()` | URNs are never reused; no trigger needed. |
| Registry visibility | SELECT-only RLS via seeded `res.module_permission` map (permission key, or NULL ⇒ tenant membership) + super catch-all | Module RLS semantics differ (`loc`/`wf` are membership-based); existence/type leak only, never payload. |
| v1 registered tables | **Eight**: `app.tenant`, `app.resident`, `app.support_ticket`, `msg.topic`, `todo.todo`, `loc.location`, `storage.asset`, `wf.wf` | Business objects + the two identity objects (2026-07-10: tenants/users join the registry to support future stacking — logos, avatars, discussions-about-a-user). Sub-objects, dataset detail tables, `app.profile` (tenant-less), platform plumbing excluded. Dataset-synced `loc.location` rows **do** register. |
| Shadow mirrors removed | `<module>_tenant`/`<module>_resident` (msg, todo, loc, storage) deleted, with their `ensure_*` fns + `handle_update_profile` triggers | 2026-07-10: redundant with `app.resident` (denormalized `display_name`, tenant-wide RLS, `update_profile` sync); storage's mirror had no trigger (stale-name bug); `wf` never adopted it; registry FKs `app.*` anyway. `_shared.data.md` §6. |
| Reference plane | Module resident references become `*_resident_urn text REFERENCES res.resource(urn)` (e.g. `posted_by_resident_urn`); `tenant_id` stays `uuid` FK → `app.tenant(id)` | 2026-07-10 user choice: the registry is the universal reference plane, same mechanism as stacking. Tenant keys stay uuid — they feed `build_urn` and `jwt.*` RLS helpers. |
| Retrofit mechanics | **In-place edits to existing deploy files** — no new sqitch changes, no reworks, no backfills (except the new `fnb-res` package itself) | 2026-07-10 user directive. DB state is only ever reached by full rebuild (env practice); `sqitch deploy` against an existing DB will not pick the edits up — accepted. |
| First stacking consumer | `storage.asset.subject_urn` (nullable, FK to `res.resource(urn)`, attach at upload) | Proves the pattern end-to-end; `owning_entity_id` coexists, migration out of scope. |
| UUIDv7 | Bundled: `res_fn.uuid_generate_v7()`, default for **new** tables only | Time-ordered ids; existing tables keep v4; native `uuidv7()` at PG18. |
| Packaging | New sqitch package `fnb-res` (schemas `res`/`res_fn`/`res_api`), deployed between `fnb-app` and `fnb-msg` | Needs `app.tenant`; must precede every registering module. `app.tenant`/`app.resident` urn DDL lives **in fnb-res** (`build_urn` doesn't exist at fnb-app deploy time). |
| UI | None in v1 | Hub queries + composable contract only; attachment-panel UI is a future spec. (The msg/todo/storage fragment + picker rework forced by §6 is data-layer, not UI — `*.ui.md` files untouched.) |

## Files in this spec

| File | Contents |
|---|---|
| `README.md` | This index. |
| `_shared.data.md` | Grammar, decision record (the no-trigger case), `fnb-res` package DDL/functions/RLS, per-module retrofit contract with verified file:line touch points, shadow-mirror removal (§6), UUIDv7, docs-to-update (R21). |
| `stacking.data.md` | `storage.asset.subject_urn` consumer: DDL, write path (upload endpoint + scan derivative), hub query shape, out-of-scope notes. |
| `client.data.md` | PostGraphile exposure + recorded generated names, `fnb-types` `Urn`/`Resource` + parse helpers, fragments/mappers/`useResource`, verification steps. |
| `stacking-v2.data.md` | Audit-driven v2 (2026-07-10): drop `storage.asset.context`/`owning_entity_id` (subject_urn is the only attach mechanism), `msg.topic.subject_urn` + retire `topic.context` + end todo id-sharing, drop `app.support_ticket.topic_id`. Locked decisions table inside. |

## Implementation Task List

All DB work is **in-place edits to existing deploy files** (no new changes/backfills;
`fnb-res` is the only new package) — `_shared.data.md` §4 strategy.

**Phase 1 — the `fnb-res` package** ✅ 2026-07-10
- [x] Scaffold `db/fnb-res` (skill `new-db-package`); insert into `DEPLOY_PACKAGES` (`.env` **and** `.env.example`) between `fnb-app` and `fnb-msg`
- [x] `res.resource` + `res.module_permission` (+ seeds) — `_shared.data.md` §4.1–4.2 (build_urn moved into `…11000_res` — the table's generated column needs it)
- [x] `res_fn.uuid_generate_v7`, `res_fn.register_resource` (idempotent, SECURITY DEFINER), `res_fn.archive_resource` — §4.3
- [x] App retrofit: `urn` + unique + deferred FK on `app.tenant` / `app.resident` / `app.support_ticket` — §4.6
- [x] `res_api.resolve_urn` + computed hub fields `res.resource_resident` / `res.resource_tenant` — §4.4, §4.7
- [x] Grants + RLS policies — §4.5

**Phase 2 — retrofit the eight tables in-place** (per-table recipe `_shared.data.md` §5) ✅ 2026-07-10
- [x] `app.tenant` + `app.resident` — register calls in `app_fn` create sites (DDL in Phase 1)
- [x] `app.support_ticket` (fnb-app) — register at the submit site (DDL in Phase 1)
- [x] `msg.topic` (fnb-msg) — + archive at delete site (also fixed pre-existing `delete_topic` tautology bug: `where _topic_id = _topic_id` deleted ALL messages)
- [x] `todo.todo` (fnb-todo) — + archive at delete site
- [x] `loc.location` (fnb-loc + fnb-location-datasets + fnb-airports) — three insert sites, one delete site
- [x] `storage.asset` (fnb-storage) — two insert sites (upload + scan derivative)
- [x] `wf.wf` (fnb-wf) — two insert sites; added missing `tenant_id` FK → `app.tenant(id)`
- [x] True up verify/revert files of every edited change

**Phase 3 — shadow mirror removal + URN reference plane** (`_shared.data.md` §6) ✅ 2026-07-10
- [x] Deleted `<module>_tenant`/`<module>_resident` DDL + `ensure_*` fns + `handle_update_profile` triggers + mirror policies (msg, todo, loc, storage) — §6.1
- [x] Column conversions: `posted_by_resident_urn`, `resident_urn` (msg/todo/loc/storage), `subscriber_info` composite, `tenant_id` FKs → `app.tenant(id)` — §6.2 (`todo_api.assign_todo` now takes `_resident_urn text`)
- [x] Deleted `loc.loc_tenant` lazy-init inserts in the two dataset syncs
- [x] Rewrote WS carve-out sender join (`db-access/src/queries/msg.ts`) — §6.3

**Phase 4 — storage stacking consumer** (`stacking.data.md`) ✅ 2026-07-10
- [x] `subject_urn` column + partial index + FK on `storage.asset` (in-place in `…10600_storage.sql`)
- [x] Threaded optional `subjectUrn` through upload endpoint (`$15::text`) → `_fn` create; guard mirrors the registry policy via `jwt.*` (insert_asset is SECURITY DEFINER — see stacking §3 correction); derivative inherits parent's subject

**Phase 5 — GraphQL + client** (`client.data.md`) ✅ 2026-07-10
- [x] Exposed `res`, `res_api` in `graphile.config.ts`; smart tag `res.module_permission` `-*` (hub relation renames deferred — generated names recorded in `client.data.md` §1)
- [x] `fnb-types`: `urn.ts` (brand + parse/format helpers), `urn` on the eight entity types, `MessageWithSender.postedByResidentUrn`; barrels
- [x] `graphql-client-api`: resource fragment + `resolveUrn` op; msg/todo/storage documents reworked; one `residentsList` picker (`ActiveTenantResidents`) replaces `msgResidentsList`/`todoResidentsList`; mappers thread `urn`; `useResource`; barrel; codegen green
- [x] App/layer consumers: pickers pass URNs; `Msg.vue` resolves "You" via `parseUrn`; `TodoMsg` self-participant via `formatUrn`
- [x] `pnpm build` green (12/12, post-rebuild)

**Phase 6 — docs (R21) + verification** ✅ 2026-07-10
- [x] Updated `CLAUDE.md`, `fnb-db-designer`, `fnb-stack-implementor`, `graphql-api-pattern.md`, `package-layers-pattern.md`; migration notes on affected module specs per `_shared.data.md` §8
- [x] Verification against the rebuilt stack: registry seeded (tenants/residents/locations/wfs registered with correct URNs), mirrors gone, RLS (tenant user vs super, cross-tenant `resolveUrn` → null), computed `Resource.resident`, adversarial deferred-FK commit failure, full `_fn` write-path e2e (create/assign todo by URN, topic + subscriber + message sender resolution) in a rolled-back transaction

**Phase v2 — retire the pre-registry reference mechanisms** (`stacking-v2.data.md`; plan `0490__db________urn-stacking-v2`) ✅ 2026-07-10
- [x] Storage: drop `context`/`owning_entity_id`/enum; `public_assets_for_subject(_subject_urn)`; upload endpoint rework (13-param cast, subject-based key)
- [x] Msg: `topic.subject_urn` (+ partial unique) replaces id-sharing; retire `topic.context`; `upsert_topic` subject matching + RLS guard (+ fixed the update-branch `_topic_id` mismatch)
- [x] App: drop dead `support_ticket.topic_id` (+ `SupportTicket` fragment/type/mapper)
- [x] True up verify/revert for every edited change
- [x] USER REBUILD → codegen → client rework (`useSubjectAssets`, `useTodoMsg` by subject, fragments/types, Subject badge UI) → `pnpm build` green (12/12)
- [x] R21 doc sync (asset-storage + msg/todo specs) + verification (`stacking-v2.data.md` §5 + rolled-back write-path e2e)

## Remaining Open Questions

None blocking. Implementation-time verification items (not decisions) are listed in
`_shared.data.md` §9 — notably confirming FK-to-generated-column on the deployed PG version
(fallback documented: `*_id uuid` refs instead of `*_urn`). **Resolved at implementation:**
the deployed PG accepts FKs to the generated `urn` column (all reference/stacking columns
shipped as `*_urn`).

## Considered & rejected

| Alternative | Why rejected |
|---|---|
| AFTER INSERT/DELETE registration triggers (Reign's design) | User directive 2026-07-10: non-trigger strongly preferred; explicit `_fn` calls + deferred FK give equal enforcement with a visible write path. |
| Plain required `urn` column set at insert sites (+ CHECK) | DEFAULT can't reference row columns ⇒ per-site ceremony everywhere for integrity the generated column gives for free. |
| Registry-less (urn columns only, no `res.resource`) | Loses hard referential integrity for stacking and the auto-accumulating GraphQL hub — the two payoffs the feature exists for. |
| Postgres table inheritance | No cross-hierarchy FK enforcement, per-child RLS/indexes, no PostGraphile story. |
| Registering dataset detail tables (`airports.airport` …) | Reference data; the public `loc.location` row is the addressable object. |
| `res.link` generic edge table in v1 | Explicit stacking columns beat a generic edge table until a real many-to-many case appears. |
| Trigger-maintained `updated_at`-style URN recompute on tenant change | URN inputs (`id`, `tenant_id`) are declared immutable instead. |
| Keeping the `<module>_tenant`/`<module>_resident` mirrors | Redundant with `app.resident` (denormalized names + tenant-wide RLS + `update_profile` sync); incomplete propagation (storage stale-name bug); `wf` already skipped it; registry FKs `app.*` directly anyway. |
| `uuid` FKs to `app.resident` instead of URN refs | User choice 2026-07-10: the registry is the universal reference plane — one mechanism for references and stacking; display names resolve via the `Resource.resident` computed field. |
| Registering `app.profile` | Tenant-less — the URN grammar requires a `tenant_id`; the resident is the per-tenant user object and covers the stacking use cases. |
| New sqitch changes/reworks for the retrofit | User directive 2026-07-10: edit deploy files in-place; the env only ever reaches this state via full rebuild, so migration-path machinery buys nothing. |
