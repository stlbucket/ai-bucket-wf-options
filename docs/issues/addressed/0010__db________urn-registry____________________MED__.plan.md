# Plan: URN Registry — `fnb-res` package, eight-table retrofit, shadow-mirror removal, storage stacking, GraphQL hub

> **Execution Directive:** Implement this plan via `/fnb-stack-implementor <this-file>`.
> The authoritative spec is `.claude/specs/urn-registry/` (README + `_shared.data.md` +
> `stacking.data.md` + `client.data.md`) — this plan sequences it with verified anchors; it does
> not restate the spec's SQL/contracts (R21). Specialist skills: `new-db-package` (Phase 1),
> `true-up-sqitch-package` (verify/revert sync after in-place edits), `fnb-db-designer`
> (RLS/grants), `postgraphile-5-expert` (Phase 5 + smart tags). Never run `git` in a sqitch
> session; never rebuild/restart the env yourself — ask the user (memory `rebuild-ask-user`),
> then verify read-only.

**Severity: MED** (feature work — platform capability) · Workstream: db/platform ·
Planned: 2026-07-10 (revised same day: identity registration + shadow-mirror removal + URN
reference plane + in-place-edit strategy folded in) · Spec status: Draft, all decisions locked
2026-07-10, no `[FILL IN]`s, no blocking Open Questions.

## Context

Every business object **and the two identity objects** (`app.tenant`, `app.resident`) gets a
URN (`urn:fnb:{tenant_id}:{module}:{type}:{id}`) as a **generated column** computed by one
central `IMMUTABLE` `res_fn.build_urn()`, recorded in a central registry `res.resource` (new
sqitch package `fnb-res`) via explicit `res_fn.register_resource()` calls in each `_fn` create
path, enforced by a `DEFERRABLE INITIALLY DEFERRED` FK — **no triggers anywhere**. The registry
is also the **reference plane**: module resident references become
`*_resident_urn text REFERENCES res.resource(urn)`, and the legacy
`<module>_tenant`/`<module>_resident` mirror tables (msg, todo, loc, storage) are **removed**
(`_shared.data.md` §6). First stacking consumer: `storage.asset.subject_urn`. GraphQL grows the
resource hub (`thing → resource → attached assets`) plus computed `Resource.resident`/
`Resource.tenant` fields. No UI in v1 (the msg/todo/storage fragment rework is data-layer only).

**Retrofit mechanics (user directive 2026-07-10): edit existing SQL deploy files in-place — no
new sqitch changes, no reworks, no backfills.** Only `fnb-res` ships new files. Consequence: an
already-deployed DB can never pick these up via `sqitch deploy`; the full rebuild is the only
path (matches env practice — memory `rebuild-wipes-db`).

## Planning verification notes (all re-verified 2026-07-10)

1. **All insert/delete anchors in `_shared.data.md` §5 confirmed** at the stated file:line,
   including the new identity sites: `app.tenant` inserts at
   `db/fnb-app/deploy/00000000010240_app_fn.sql:396` (anchor) and `:663` (create_tenant);
   `app.resident` inserts at `…10242_app_fn_definers.sql:298` and `…10243_app_fn_support.sql:46`
   (support resident). `db/seed.sql` writes only through `_fn` creators → seeds register
   automatically; same for `…10630_storage_ensure_asset_scan_wf` (via `wf_fn.upsert_wf`).
   **Line numbers shift as Phase 3 deletes code — re-locate by the `insert into` statement.**
2. **Deploy-order wrinkle handled in the spec** (§4/§4.6): `app.tenant`/`app.resident` urn DDL
   lives in fnb-res (`build_urn` doesn't exist at fnb-app deploy time); `app_fn` bodies may call
   `res_fn.register_resource` before fnb-res deploys because plpgsql resolves at execution
   (seed time), not creation.
3. **`DEPLOY_PACKAGES` lives in BOTH `.env:17` and `.env.example:42`** — update both (insert
   `fnb-res` between `fnb-app` and `fnb-msg`). Confirm `/new-db-package` edits both and handles
   mid-list insertion (breweries precedent appended at the end).
4. **Shadow-mirror inventory verified** (spec §6.1–6.3): DDL at `…10400_msg.sql:21-31`,
   `…10450_todo.sql:27-37`, `…10300_loc.sql:23-31`, `…10600_storage.sql:8-15`; `ensure_*` fns +
   `handle_update_profile` triggers in each `_fn` file (storage never had the trigger — the
   stale-name bug this removal deletes); mirror RLS/grants in each `_policies` file; dataset-sync
   `loc.loc_tenant` inserts at `…10710_location_datasets_fn.sql:63` and `…10810_airports_fn.sql:192`;
   client consumers: `packages/db-access/src/queries/msg.ts:15` (WS sender join),
   `discussions/fragment/{Message,Subscriber}.graphql`, `msg/query/mySubscribedTopics.graphql`,
   `todo/query/todoResidentsList.graphql`, `storage/query/{assetDetail,allAssets}.graphql`,
   composables `useMsgTopics`/`useMsgTopic`/`useTodoMsg` (+`useMsgResidents`),
   `fnb-types/src/message-with-sender.ts`, `apps/tenant-app/app/components/Msg.vue`,
   `apps/msg-app/app/composables/useTopicMessages.ts`.
5. **`msg_fn.subscriber_info.msg_resident_id`** composite field
   (`db/fnb-msg/deploy/00000000010408_msg_fn_types.sql:6`) → `resident_urn text` (§6.2); the
   storage `asset_info` composite has **no resident field** — unaffected by §6 renames.
6. **`storage_fn.asset_info` is positional-cast** from the upload endpoint
   (`packages/storage-layer/server/api/upload.post.ts` ~line 145:
   `row($1…$14)::storage_fn.asset_info`) and documents a **TRAILING-position convention**
   (`…10608_storage_fn_types.sql:4`). Phase 4's `subject_urn` field appends trailing → the
   endpoint adds one `$15::text` param.
7. **`citext` already installed** (`db/fnb-auth/deploy/00000000010100_extensions.sql:1`).
8. **Postgres image is unpinned `postgis/postgis`** (`docker-compose.yml:25`) — verify FK-to-a-
   generated-column on the deployed PG version before relying on `REFERENCES res.resource(urn)`
   (spec §9); documented fallback: `*_id uuid REFERENCES res.resource(id)` for stacking **and**
   reference columns.
9. **`wf.wf.tenant_id` has no FK today** (`…10500_wf.sql:45`) — Phase 2 adds
   `REFERENCES app.tenant(id)` in the same edit.
10. **Doc-list gaps (fold into Phase 6):** `package-layers-pattern.md` "type-only, zero runtime
    values" wording vs. the spec's pure `parseUrn`/`formatUrn`/`isUrn` helpers; CLAUDE.md's
    "nine sqitch packages" → ten **and** its "parallel shadow tables" paragraph must go; both
    orchestrator skills + `fnb-db-designer` describe the shadow/`ensure_*`/trigger pattern —
    remove per spec §8.

## Implementation phases

Follows the spec README task list. **`pnpm build` is the gate** (repo lint is broken). No new
npm dependencies (R24/catalog untouched). SQL is verbatim in `_shared.data.md` §4/§6 — do not
re-derive it. All DB edits are **in-place**; after editing any change's deploy file, true up its
verify (and meaningful revert) files — skill `true-up-sqitch-package`.

### Phase 1 — new package `db/fnb-res`

- Scaffold via `/new-db-package`; register in `DEPLOY_PACKAGES` **between `fnb-app` and
  `fnb-msg`** in `.env:17` **and** `.env.example:42` (note 3).
- Five changes per `_shared.data.md` §4 (package-local 10360–10375 slot):
  `00000000010360_res` (schemas + `res.resource` with `uq_resource_urn` UNIQUE **constraint** +
  `res.module_permission` + seeds §4.1–4.2),
  `00000000010365_res_fn` (`build_urn` IMMUTABLE PARALLEL SAFE, `uuid_generate_v7`,
  `register_resource` idempotent SECURITY DEFINER, `archive_resource` §4.3),
  `00000000010368_res_app_retrofit` (urn + unique + deferred FK on `app.tenant`/`app.resident`
  §4.6),
  `00000000010370_res_api` (`resolve_urn` §4.4 + computed hub fields `res.resource_resident`/
  `res.resource_tenant` §4.7 — note the computed fields live in schema `res`, not `res_api`),
  `00000000010375_res_policies` (grants + RLS §4.5 — **no** DML grants on `res.resource`).
- Cross-project dep: `[fnb-app:00000000010220_app]` (needs `app.tenant`, `app.resident`).
- SECURITY DEFINER functions pin `search_path` to `pg_catalog, public` (house rule; issue 0050
  territory — don't regress it in a new package).

### Phase 2 — retrofit the eight tables (in-place edits)

Per-table recipe `_shared.data.md` §5: urn column + UNIQUE constraint + deferred FK **inside
the existing `CREATE TABLE`** (module packages deploy after fnb-res); register/archive
`perform`s appended in the existing `_fn` bodies. Verify each site's actual local variable
names in the fn body.

| Package / edited files | Table | `_fn` sites (pre-edit anchors) |
|---|---|---|
| `fnb-app` (`…10240_app_fn.sql`) | `app.tenant` (`app`/`tenant`; DDL done in Phase 1) | inserts `:396`, `:663` — register with `_resident_id => null` |
| `fnb-app` (`…10242_app_fn_definers.sql`, `…10243_app_fn_support.sql`) | `app.resident` (`app`/`resident`; DDL in Phase 1) | inserts `…10242:298`, `…10243:46` |
| `fnb-app` (`…10220_app.sql` + `…10241_app_fn_support_ticket.sql`) | `app.support_ticket` — **DDL also in-place in fnb-app, but `build_urn` doesn't exist yet at fnb-app deploy: put the support_ticket urn/FK DDL in `…10368_res_app_retrofit` too** | insert `…10241:38` |
| `fnb-msg` (`…10400_msg.sql`, `…10410_msg_fn.sql`) | `msg.topic` (`msg`/`topic`) | insert `:110`; delete `:368` |
| `fnb-todo` (`…10450_todo.sql`, `…10470_todo_fn.sql`) | `todo.todo` (`todo`/`todo`) | insert `:161`; delete `:348` |
| `fnb-loc` (`…10300_loc.sql`, `…10310_loc_fn.sql`) | `loc.location` (`loc`/`location`) | insert `:94`; delete `:150` |
| `fnb-location-datasets` (`…10710` fn edit only) | — | insert `:116` (bulk sync — idempotent register rides the sync txn) |
| `fnb-airports` (`…10810` fn edit only) | — | insert `:248` (~85k registrations is the largest single step) |
| `fnb-storage` (`…10600_storage.sql`, `…10610_storage_fn.sql`, `…10625_storage_resolve_asset_scan.sql`) | `storage.asset` (`storage`/`asset`) | inserts `…10610:52`, `…10625:81` |
| `fnb-wf` (`…10500_wf.sql`, `…10520_wf_fn.sql`) | `wf.wf` (`wf`/`wf`) — templates register too; **add missing `tenant_id` FK → `app.tenant(id)`** (note 9) | inserts `:800`, `:966` |

- Register call shape: `perform res_fn.register_resource(_id, _tenant_id, '<module>',
  '<type>'[, _resident_id]);` — archive at the delete sites:
  `perform res_fn.archive_resource(<id var>);`

### Phase 3 — shadow-mirror removal + URN reference plane (`_shared.data.md` §6)

Same files as Phase 2 — do the two phases as one editing pass per package to avoid re-locating
anchors twice:

- **Delete** (§6.1): mirror DDL + FKs + indexes; `ensure_<module>_resident` fns and every call
  site; `handle_update_profile` trigger fns + triggers (msg/todo/loc); mirror policies/grants in
  each `_policies` file; the `loc.loc_tenant` lazy-init inserts in the two dataset syncs.
- **Convert columns** (§6.2): `msg.message.posted_by_msg_resident_id` → `posted_by_resident_urn`,
  `msg.subscriber.msg_resident_id` → `resident_urn` (+ unique `(topic_id, resident_urn)`),
  `todo.todo.resident_id` → `resident_urn` (nullable), `loc.location.resident_id` →
  `resident_urn`, `storage.asset.resident_id` → `resident_urn`; all
  `text REFERENCES res.resource(urn)` (plain FK, not deferred); every mirror-target `tenant_id`
  FK repoints to `app.tenant(id)`; `msg_fn.subscriber_info.msg_resident_id` → `resident_urn text`
  (`…10408_msg_fn_types.sql:6`).
- **`_fn` bodies**: replace `ensure_*` calls with
  `select urn into _resident_urn from res.resource where id = _resident_id;` (raise on miss);
  thread `_resident_urn` into the inserts; update indexes named after old columns.
- **WS carve-out** (`packages/db-access/src/queries/msg.ts:15`): sender join becomes
  `left join res.resource rr on rr.urn = m.posted_by_resident_urn left join app.resident r on
  r.id = rr.id` (§6.3).
- True up verify/revert files for **every** edited change (Phases 2+3 together).

### Phase 4 — storage stacking consumer (`stacking.data.md`)

- **First**: verify FK→generated-column on the deployed PG version (note 8); on failure use the
  documented `*_id uuid` fallback and record it in the spec.
- In-place in `…10600_storage.sql`: nullable `subject_urn` FK to `res.resource(urn)` + partial
  index (§2). `context`/`owning_entity_id` coexist — untouched.
- `asset_info` composite (`…10608_storage_fn_types.sql`): append **trailing** `subject_urn text`
  (note 6); `storage_fn.insert_asset` threads it with the RLS-visibility guard
  (`perform 1 from res.resource where urn = _subject_urn` → raise `30000: NOT AUTHORIZED` when
  invisible — runs as invoker); the scan-derivative insert (`…10625:81`) inherits the parent's
  `subject_urn`.
- `packages/storage-layer/server/api/upload.post.ts`: optional `subjectUrn` form field →
  `$15::text` in the positional `row(...)` cast. No re-parenting API (out of scope v1).

### Phase 5 — PostGraphile exposure (TS edits; land before the rebuild)

- Add `'res'`, `'res_api'` to `schemas` in
  `apps/graphql-api-app/server/graphile.config.ts:29` (**never** `res_fn`).
- `apps/graphql-api-app/postgraphile.tags.json5`: `res.module_permission` → `@behavior -*`;
  hub-relation renames (e.g. `assetsBySubjectUrn` → `assets` on `Resource`, the
  `posted_by_resident_urn` forward relation) wait for actual names after first codegen.

### ⏸ USER REBUILD GATE

Everything above lands only on rebuild (in-place edits are invisible to `sqitch deploy` on an
existing DB; memory `rebuild-wipes-db`). **Ask the user to run it.** Then verify read-only in
GraphiQL/psql: `resolveUrn`, RLS-filtered `resource(s)` selects, non-null `urn` on the eight
types, **no** resource insert/update/delete mutations, `res.resource` row counts ≈ seeded
objects (incl. tenants + residents), no `*_tenant`/`*_resident` tables in `\dt msg|todo|loc|
storage`, sender display names resolve via `resource → resident`, and record the exact
inflected hub/reference/computed field names (simplify-inflection) for the `.graphql`
documents + `client.data.md`.

### Phase 6 — fnb-types + graphql-client-api (`client.data.md`)

- `packages/fnb-types/src/urn.ts`: `Urn` brand, `ParsedUrn`, `Resource`, pure helpers
  `parseUrn`/`formatUrn`/`isUrn` (zero deps — spec-authorized runtime exception, note 10);
  add `urn: Urn` to the eight entity types (`SupportTicket`, `Topic`, `Todo`, `Location`,
  `Asset`, `Wf`, `Tenant`, `Resident`); reference fields (`message-with-sender.ts` postedBy,
  subscriber/assignee/uploader refs) become `Urn`-typed; barrel `src/index.ts`.
- `graphql-client-api`: `src/graphql/res/fragment/resourceFields.graphql` (every field) +
  `query/resolveUrn.graphql`; expand entity fragments to select `urn` (memory
  `fragments-all-fields`); **rework the §6.3 documents** — `Message`/`Subscriber` fragments
  (sender via `postedByResource { resident { displayName } }` or the recorded inflected names),
  `mySubscribedTopics`, `assetDetail`/`allAssets`; replace `msgResidentsList`/`todoResidentsList`
  with one `app/query/residentsList.graphql` (selects `urn`). Codegen
  (`pnpm -F @function-bucket/fnb-graphql-client-api generate`); mapper `src/mappers/resource.ts`
  (`toResource` — un-Maybe, `Date` coercion, brand the urn); thread `urn` + URN refs through the
  existing mappers; rework composables `useMsgTopics`/`useMsgTopic`/`useTodoMsg`/
  `useMsgResidents` (+ downstream `Msg.vue`, `useTopicMessages` — shape changes only, no new
  UI); new composable `src/composables/useResource.ts` (`computed` resource, `fetching`,
  `error`, no `refresh`); **barrel** `src/index.ts` (the #1 miss). Record actual generated
  field names in `client.data.md`.
- No new app re-exports (no v1 UI consumes `useResource`). `pnpm build` green across the
  workspace.

### Phase 7 — docs (R21) + verification + hand-off

- Docs per `_shared.data.md` §8 **plus note 10**: `CLAUDE.md` (ten packages, deploy order with
  `fnb-res` after `fnb-app`, drop the shadow-tables paragraph), `fnb-db-designer` SKILL.md
  (package list, UUIDv7 default, registered-business-table convention, **remove the shadow/
  ensure/trigger pattern**), `fnb-stack-implementor` SKILL.md + `graphql-api-pattern.md`
  (exposed-schemas lists, remove shadow checklist items), `package-layers-pattern.md`
  (fnb-types runtime-helpers wording), affected module specs (msg/todo/loc/asset-storage —
  Mode 3 sync), `skill-map.md` unchanged (fnb-res owned by `fnb-db-designer`).
- Verification per `client.data.md` §5 (read-only; ask the user for any rebuild/restart):
  sqitch status clean; `resolveUrn` cross-tenant returns null; hub round-trip (asset uploaded
  with `subjectUrn` appears under `todo { resource { assets } }`; no-storage-permission user
  gets `assets: []`); shadow-removal + identity-registration checks (§5.5–5.6); **adversarial
  deferred-FK test** — psql insert into a registered table without registering must fail at
  commit (write attempt by design; nothing persists — flag to the user before running);
  `pnpm build` green.
- Fold any in-flight corrections back into the spec files; flip spec Status lines.
- **Ask the user** before moving this plan to `addressed/` (memory
  `ask-before-moving-addressed`).

## Sequencing summary

1. Phases 1–4 (sqitch sessions — no `git`; Phases 2+3 as one editing pass per package) +
   Phase 5 TS edits → **user rebuild** → GraphiQL verify + record inflected names (codegen
   needs the live schema) → Phase 6 → Phase 7.
2. Two user touchpoints: the rebuild, and sign-off at Phase 7 (plus the flagged adversarial
   FK test).

## Out of scope / linked

- Attachment-panel UI, `msg.topic.subject_urn` / `wf.wf.subject_urn`, `owning_entity_id`
  migration, re-parenting API, `res.link` edge table — all explicitly future
  (`stacking.data.md` §5). Tenant-logo / user-avatar stacking is unlocked by the identity
  registration but ships with a future spec.
- Registry rows for public locations visible to owning tenant + super only — deliberate v1
  simplification (spec §4.5 note); revisit only for an anon-facing stacking feature.
- `app.profile` stays unregistered (tenant-less; the resident is the user object).
- `res_fn` grants breadth intersects issue `0020__security__fn-schema-grant-bypass` — follow
  that plan's outcome; don't widen anything here.
