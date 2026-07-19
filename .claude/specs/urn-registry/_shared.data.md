# URN Registry — Shared Data Contract

## Status
Implemented — 2026-07-10; verified against the rebuilt stack (RLS, deferred-FK enforcement,
`_fn` write paths, hub relations).

Companion analysis: `.claude/analysis/bloated-unicorn.analysis.md` §4 (origin of the design;
this spec supersedes it where they differ — notably **no triggers**).

---

## 1. Purpose

Give every business object on the platform a universal address (a URN), recorded in a central
registry (`res.resource`) that is a real FK target — so capability modules can stack data onto
any object (`subject_urn`) without cross-module schema coupling, and PostGraphile grows a
"resource hub" (`thing → resource → everything attached to it`) automatically.

**Non-goal (v1):** subject-based visibility dispatch, audit logging, UI pages, `res.link`
edge tables.

---

## 2. URN grammar

```
urn:fnb:{tenant_id}:{module}:{type}:{id}
urn:fnb:6f1e…-uuid:todo:todo:0197f9e0…-uuid
```

- Tenant-first: per-tenant prefix matching (`urn LIKE 'urn:fnb:'||tenant_id||':%'`) is cheap
  in RLS and ops tooling.
- `module` = the module slug — **the same word as the schema and (where one exists) the
  permission suffix**. One name, three uses; enforce in review.
- `type` = table-level type within the module (`todo`, `topic`, `location`, `asset`, `wf`,
  `support_ticket`, `tenant`, `resident`).
- `id` = the row's PK, verbatim.
- **URN inputs are immutable.** `id` and `tenant_id` never change on registered tables (de
  facto true today; now an explicit invariant). The grammar itself is frozen — URNs are
  forever.

**What gets a URN:** business objects **plus the identity objects** `app.tenant`
(`app`/`tenant` — its own id is the `tenant_id` segment) and `app.resident`
(`app`/`resident` — the per-tenant projection of a user). Sub-objects (`msg.message`,
`app.support_ticket_comment`, `wf.uow`) and dataset *detail* tables (`airports.airport`,
`location_datasets.*`) do **not** register. `app.profile` does **not** register — it is
tenant-less and the grammar requires a `tenant_id`; the resident is the registrable "user".
`loc.location` rows created by dataset syncs **do** register (they are the public,
addressable location objects — attaching media to an airport location is the feature working
as intended).

**The registry is also the reference plane** (decision 2026-07-10): module tables reference
residents by **URN** (`*_resident_urn text REFERENCES res.resource(urn)`), not by uuid FK —
see §6. The per-module `<module>_tenant` / `<module>_resident` mirror tables are **removed**.
`tenant_id` columns stay plain `uuid NOT NULL REFERENCES app.tenant(id)` — they are RLS/
sharding keys and inputs to `build_urn`, not business references.

---

## 3. Decision record — how the URN is set (the no-trigger case)

User directive 2026-07-10: strongly prefer a non-trigger approach; central `build_urn`
function; make the case between "required field" and "generated field".

| Approach | Verdict |
|---|---|
| **AFTER INSERT/DELETE triggers** (Reign's design) | **Rejected** (user directive). Invisible write amplification, ordering hazards, harder to reason about in `_fn` bodies. |
| **Plain `urn text NOT NULL` set by every `_fn` insert site**, integrity via `CHECK (urn = build_urn(…))` | **Rejected.** A column DEFAULT cannot reference other columns of its row, so every insert site (and every seed/backfill/COPY) must supply the value by hand. The CHECK gives the same integrity as the generated column, so the ceremony buys nothing — the only extra "feature" is a new runtime failure mode (forgetting). |
| **`GENERATED ALWAYS AS (res_fn.build_urn(…)) STORED`** | **Chosen.** Same central grammar authority — the function is invoked by the column definition instead of by hand. Impossible to forget, impossible to diverge, covers every write path (functions, seeds, COPY, worker SQL). Read-only in GraphQL. Constraint: `build_urn` must be `IMMUTABLE` (it is — pure text concatenation) and the grammar is frozen (required anyway). |

**Registration** (the registry row) cannot be generated — it is a cross-table write. The
non-trigger answer is an **explicit `res_fn.register_resource(...)` call in each module's
`_fn` create function**, made safe by two facts:

1. `disableDefaultMutations: true` (`apps/graphql-api-app/server/graphile.config.ts`) — there
   are **no** table-level CRUD mutations; the `_api` → `_fn` layer is the only authenticated
   write path (R8).
2. A **`DEFERRABLE INITIALLY DEFERRED` FK** on every registered table
   (`FOREIGN KEY (id) REFERENCES res.resource(id)`) makes forgetting impossible: an
   unregistered insert fails **at commit**, loudly. Deferred (not immediate) so existing
   `_fn` functions keep their `insert … returning id into _id` shape and simply append the
   register call after — the retrofit diff is one `perform` per create site.

Deletes: hard `DELETE` of a business row leaves its registry row in place — that **is** the
tombstone (URNs are never reused). `_fn` delete/archive sites additionally call
`res_fn.archive_resource(_id)` to stamp `archived_at`.

---

## 4. New sqitch package: `fnb-res`

Scaffold via skill `new-db-package`; plan mechanics via `sqitch-expert`. Deployed **after
`fnb-app`** (needs `app.tenant`), **before every module that registers** — insert into
`DEPLOY_PACKAGES` (`.env` line 17):

```
DEPLOY_PACKAGES=fnb-auth fnb-app fnb-res fnb-msg fnb-todo fnb-loc fnb-wf fnb-storage fnb-location-datasets fnb-airports
```

**Retrofit strategy (user directive 2026-07-10): edit existing SQL deploy files in-place —
no new sqitch changes, no reworks, no backfills.** The DB reaches this state only via a full
rebuild (memory `rebuild-wipes-db`); `sqitch deploy` against an existing DB will never pick
these edits up — that is accepted and matches how the env is operated. Verify/revert files of
edited changes are trued up in the same pass (skill `true-up-sqitch-package`). The only new
files are the `fnb-res` package's own.

**Deploy-order wrinkle:** module tables (fnb-msg…fnb-airports) deploy *after* fnb-res, so
their `CREATE TABLE` statements may reference `res_fn.build_urn` directly. `app.tenant` /
`app.resident` deploy *before* fnb-res, so their `urn` columns + deferred FKs live in an
**app-retrofit deploy file inside fnb-res** (§4.6). `app_fn` function bodies may call
`res_fn.register_resource` even though they are created before fnb-res deploys — plpgsql
bodies resolve references at execution (seed time), not definition time.

`fnb-res` deploy files (as built — 110xx is the next free hundreds-range per the
`new-db-package` numbering scheme; deploy *order* comes from `DEPLOY_PACKAGES`, not numbers):

| File | Contents |
|---|---|
| `00000000011000_res.sql` | schemas `res`, `res_fn`, `res_api`; **`res_fn.build_urn`** (must precede the table — `res.resource.urn` is generated from it); `res.resource`; `res.module_permission` + seeds |
| `00000000011010_res_fn.sql` | `res_fn.uuid_generate_v7`, `res_fn.register_resource`, `res_fn.archive_resource` |
| `00000000011020_res_app_retrofit.sql` | `urn` columns + deferred FKs on `app.tenant` / `app.resident` / `app.support_ticket` (§4.6) |
| `00000000011030_res_api.sql` | `res_api.resolve_urn` + hub computed fields `res.resource_resident` / `res.resource_tenant` (§4.7) |
| `00000000011040_res_policies.sql` | grants + RLS |

### 4.1 `res.resource` — the registry

```sql
CREATE TABLE res.resource (
  id            uuid PRIMARY KEY,                 -- same value as the owning row's PK; no default
  tenant_id     uuid NOT NULL REFERENCES app.tenant(id),
  module        citext NOT NULL,
  resource_type citext NOT NULL,
  urn           text NOT NULL
                  GENERATED ALWAYS AS
                  (res_fn.build_urn(tenant_id, module, resource_type, id)) STORED,
  created_at    timestamptz NOT NULL DEFAULT current_timestamp,
  created_by_resident_id uuid NULL REFERENCES app.resident(id),
  archived_at   timestamptz NULL                  -- tombstone; URNs are never reused
);
ALTER TABLE res.resource ADD CONSTRAINT uq_resource_urn UNIQUE (urn);
CREATE INDEX idx_resource_tenant_module_type ON res.resource (tenant_id, module, resource_type);
```

`urn` is a stored generated column with a UNIQUE **constraint** (not just an index — FK
`REFERENCES res.resource(urn)` requires a unique constraint, and PostGraphile relation
detection is constraint-driven) so it can serve as the FK *target* for stacking **and
reference** columns (§6). (Being generated is irrelevant on the referenced side — it only
restricts *referencing* columns.)

### 4.2 `res.module_permission` — registry visibility map

Registry rows leak existence + type only, never payload. Visibility semantics differ per
module, so the SELECT policy reads a seeded map. `permission_key IS NULL` = plain tenant
membership (`jwt.tenant_id() = tenant_id`) — used where the module's own RLS is
membership-based rather than permission-based.

```sql
CREATE TABLE res.module_permission (
  module         citext PRIMARY KEY,
  permission_key citext NULL          -- NULL ⇒ tenant-membership check
);
INSERT INTO res.module_permission (module, permission_key) VALUES
  ('app',     'p:app-user'),      -- support tickets + tenant + resident registry rows
  ('msg',     'p:discussions'),
  ('todo',    'p:todo'),
  ('loc',     NULL),              -- loc.location policy is jwt.tenant_id() = tenant_id
  ('wf',      NULL),              -- wf policies are membership-shaped (currently commented out)
  ('storage', 'p:app-user');
```

`app.tenant` / `app.resident` registry rows ride the `'app'` row: visible to any
`p:app-user` of that tenant — the same population that can already SELECT the underlying
`app.resident` rows (`view_all_for_tenant`).

### 4.3 `res_fn` functions

```sql
-- THE grammar authority. IMMUTABLE is load-bearing (generated columns require it).
CREATE FUNCTION res_fn.build_urn(_tenant_id uuid, _module citext, _resource_type citext, _id uuid)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT 'urn:fnb:' || _tenant_id::text || ':' || _module::text || ':'
         || _resource_type::text || ':' || _id::text;
$$;

-- UUIDv7 (pure plpgsql — no extension on the postgis image). Default for NEW tables.
CREATE FUNCTION res_fn.uuid_generate_v7() RETURNS uuid LANGUAGE plpgsql VOLATILE AS $$ …
  -- millisecond-timestamp-prefixed per RFC 9562; swap to native uuidv7() at PG18
$$;

-- Idempotent (ON CONFLICT DO NOTHING) so upsert-shaped flows (dataset syncs) are safe.
-- SECURITY DEFINER: res.resource is deny-all for direct DML; only these functions write it.
-- Receives explicit args — never calls jwt.* (house rule: that is the _api layer's job).
CREATE FUNCTION res_fn.register_resource(
  _id uuid, _tenant_id uuid, _module citext, _resource_type citext,
  _resident_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO res.resource (id, tenant_id, module, resource_type, created_by_resident_id)
  VALUES (_id, _tenant_id, _module, _resource_type, _resident_id)
  ON CONFLICT (id) DO NOTHING
  RETURNING id;
$$;

CREATE FUNCTION res_fn.archive_resource(_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE res.resource SET archived_at = current_timestamp
  WHERE id = _id AND archived_at IS NULL;
$$;
```

`SECURITY DEFINER` functions pin `search_path` to `pg_catalog, public` per house convention.
`res_fn` is **not** exposed to PostGraphile, so none of these become GraphQL fields.

### 4.4 `res_api.resolve_urn`

```sql
-- SECURITY INVOKER + STABLE ⇒ RLS applies; PostGraphile exposes it as a query field.
CREATE FUNCTION res_api.resolve_urn(_urn text) RETURNS res.resource
LANGUAGE sql STABLE AS $$
  SELECT r.* FROM res.resource r WHERE r.urn = _urn;
$$;
```

### 4.5 Grants + RLS

```sql
grant usage on schema res, res_fn, res_api to anon, authenticated, service_role;
grant all on all routines in schema res_fn, res_api to authenticated, service_role;
grant select on res.resource, res.module_permission to authenticated, service_role;
-- NO insert/update/delete grants on res.resource to any request role:
-- only the SECURITY DEFINER res_fn functions write it.

alter table res.resource enable row level security;
alter table res.module_permission enable row level security;

CREATE POLICY view_module_permission ON res.module_permission FOR SELECT USING (true);

CREATE POLICY resource_select ON res.resource FOR SELECT USING (
  jwt.has_permission('p:app-admin-super')
  OR EXISTS (
    SELECT 1 FROM res.module_permission mp
    WHERE mp.module = resource.module
      AND (
        (mp.permission_key IS NOT NULL
          AND jwt.has_permission(mp.permission_key, resource.tenant_id))
        OR (mp.permission_key IS NULL AND jwt.tenant_id() = resource.tenant_id)
      )
  )
);
```

Deliberate v1 simplification: registry rows for **public** `loc.location` rows are visible
only to their owning tenant (+ super), even though the location rows themselves are
anon-readable via `view_public`. Revisit only if an anon-facing stacking feature appears.

### 4.6 `res` app-retrofit — `urn` on `app.tenant` / `app.resident` / `app.support_ticket`

Lives in fnb-res (not fnb-app) because `build_urn` must exist before the generated columns
(§4 deploy-order wrinkle). **All three fnb-app tables** get their urn DDL here —
`app.support_ticket` follows the standard §5 recipe, just in this file instead of its own
`CREATE TABLE`:

```sql
ALTER TABLE app.tenant
  ADD COLUMN urn text NOT NULL
    GENERATED ALWAYS AS (res_fn.build_urn(id, 'app', 'tenant', id)) STORED;  -- own id IS the tenant segment
ALTER TABLE app.tenant ADD CONSTRAINT uq_tenant_urn UNIQUE (urn);
ALTER TABLE app.tenant
  ADD CONSTRAINT fk_tenant_resource FOREIGN KEY (id) REFERENCES res.resource(id)
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE app.resident
  ADD COLUMN urn text NOT NULL
    GENERATED ALWAYS AS (res_fn.build_urn(tenant_id, 'app', 'resident', id)) STORED;
ALTER TABLE app.resident ADD CONSTRAINT uq_resident_urn UNIQUE (urn);
ALTER TABLE app.resident
  ADD CONSTRAINT fk_resident_resource FOREIGN KEY (id) REFERENCES res.resource(id)
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE app.support_ticket
  ADD COLUMN urn text NOT NULL
    GENERATED ALWAYS AS (res_fn.build_urn(tenant_id, 'app', 'support_ticket', id)) STORED;
ALTER TABLE app.support_ticket ADD CONSTRAINT uq_support_ticket_urn UNIQUE (urn);
ALTER TABLE app.support_ticket
  ADD CONSTRAINT fk_support_ticket_resource FOREIGN KEY (id) REFERENCES res.resource(id)
  DEFERRABLE INITIALLY DEFERRED;
```

Register calls are edited into the existing `app_fn` bodies (§5 table). Registration of a
tenant passes `_resident_id => null` (the creating resident may not exist yet at
create-tenant time).

### 4.7 Hub computed fields — `Resource.resident` / `Resource.tenant`

`res.resource.id` is polymorphic, so PostGraphile cannot auto-generate a relation from a
resource row to its underlying entity. For the two identity types the UI constantly needs
(display names), expose PostGraphile **computed columns** (function in the table's schema,
named `<table>_<field>`, SECURITY INVOKER ⇒ RLS on the target applies):

```sql
-- Resource.resident — non-null only when the resource IS a resident
CREATE FUNCTION res.resource_resident(r res.resource) RETURNS app.resident
LANGUAGE sql STABLE AS $$
  SELECT a.* FROM app.resident a WHERE a.id = r.id AND r.module = 'app' AND r.resource_type = 'resident';
$$;

-- Resource.tenant — resolves for EVERY resource (its owning tenant)
CREATE FUNCTION res.resource_tenant(r res.resource) RETURNS app.tenant
LANGUAGE sql STABLE AS $$
  SELECT t.* FROM app.tenant t WHERE t.id = r.tenant_id;
$$;
```

This is the read path for URN reference columns (§6):
`message → postedByResource → resident → displayName`. Other entity types stay polymorphic —
resolve via `parseUrn` client-side + the module's own query.

---

## 5. Retrofit contract — per registered table

All retrofit content is **edited in-place into the existing deploy files** (§4 strategy —
no new changes, no backfills; fresh rebuild is the only deploy path). Per table:

1. **URN column + unique constraint + enforcement FK** — edited directly into the existing
   `CREATE TABLE` statement (module packages deploy after fnb-res, so `res_fn.build_urn` is
   resolvable in DDL; `app.tenant`/`app.resident` are the exception — §4.6):
   ```sql
   ,urn text NOT NULL
     GENERATED ALWAYS AS (res_fn.build_urn(tenant_id, '<module>', '<type>', id)) STORED
   ,CONSTRAINT uq_<table>_urn UNIQUE (urn)
   ,CONSTRAINT fk_<table>_resource FOREIGN KEY (id) REFERENCES res.resource(id)
     DEFERRABLE INITIALLY DEFERRED
   ```
   (The unique constraint doubles as the index PostGraphile v5 needs for condition/orderBy
   fields.)
2. **`_fn` create sites** — append after each insert (edited into the existing `_fn` file):
   `perform res_fn.register_resource(_id, _tenant_id, '<module>', '<type>' [, _resident_id]);`
3. **`_fn` delete sites** — append after each delete:
   `perform res_fn.archive_resource(_id);`
4. **True up** the edited change's verify (and, where meaningful, revert) files.

### The eight v1 tables and their touch points (verified 2026-07-10)

| Table | module/type | Insert sites (`_fn`) | Delete sites |
|---|---|---|---|
| `app.tenant` | `app`/`tenant` | `db/fnb-app/deploy/00000000010240_app_fn.sql:396` (anchor), `:663` (create_tenant) | — |
| `app.resident` | `app`/`resident` | `db/fnb-app/deploy/00000000010242_app_fn_definers.sql:298`; `…10243_app_fn_support.sql:46` (support resident) | — |
| `app.support_ticket` | `app`/`support_ticket` | `db/fnb-app/deploy/00000000010241_app_fn_support_ticket.sql:38` | — |
| `msg.topic` | `msg`/`topic` | `db/fnb-msg/deploy/00000000010410_msg_fn.sql:110` | `…10410_msg_fn.sql:368` |
| `todo.todo` | `todo`/`todo` | `db/fnb-todo/deploy/00000000010470_todo_fn.sql:161` | `…10470_todo_fn.sql:348` |
| `loc.location` | `loc`/`location` | `db/fnb-loc/deploy/00000000010310_loc_fn.sql:94`; `db/fnb-location-datasets/deploy/00000000010710_location_datasets_fn.sql:116`; `db/fnb-airports/deploy/00000000010810_airports_fn.sql:248` | `…10310_loc_fn.sql:150` |
| `storage.asset` | `storage`/`asset` | `db/fnb-storage/deploy/00000000010610_storage_fn.sql:52`; `…10625_storage_resolve_asset_scan.sql:81` | — |
| `wf.wf` | `wf`/`wf` | `db/fnb-wf/deploy/00000000010520_wf_fn.sql:800`, `:966` | — |

Notes:
- Line numbers are pre-edit anchors; the shadow-removal edits (§6) shift them — re-locate by
  the surrounding `insert into` statement, not the number.
- The three **fnb-app** tables' urn DDL lives in fnb-res (§4.6 — fnb-app deploys before
  `build_urn` exists); their register calls are in-place edits to the `app_fn` bodies above
  (bodies resolve `res_fn` at runtime). Module tables (fnb-msg onward) put the DDL directly
  in their `CREATE TABLE`.
- `loc.location` dataset-sync sites run in bulk (~85k rows for airports): registration is a
  second insert per row inside the same transaction — acceptable (Reign §10.8 reasoning);
  the sync's upsert shape is why `register_resource` is idempotent.
- `wf.wf` template rows (`is_template = true`) register like any other row — they are
  addressable business objects. `wf.wf.tenant_id` also gains the previously-missing
  `REFERENCES app.tenant(id)` FK in the same edit.
- The modules with no delete sites archive via status columns already; their registry
  rows never tombstone in v1.

### Excluded from v1 (explicitly)

`msg.message`, `msg.subscriber`, `app.support_ticket_comment`, `wf.uow`
(`todo` child rows are **included** — every `todo.todo` row registers; the table is one type),
all `airports.*` / `location_datasets.*` detail tables, `app.profile` (tenant-less — the
resident is the registrable user object), license machinery (platform plumbing, not
stackable business objects — revisit on demand). The `<module>_tenant`/`<module>_resident`
mirror tables are not excluded — they are **removed** (§6).

---

## 6. Shadow mirror removal — the URN reference plane

Decision 2026-07-10: the per-module `<module>.<module>_tenant` / `<module>.<module>_resident`
mirror tables (msg, todo, loc, storage) are **removed**, and module references to residents
are repointed at the registry as URN columns. Rationale: `app.resident` already carries the
denormalized `display_name`/`tenant_name` the mirrors existed for, with tenant-wide SELECT
RLS (`view_all_for_tenant`) and propagation via `app_fn.update_profile`; the mirrors'
propagation was incomplete (storage never had a `handle_update_profile` trigger — stale-name
bug); `wf` never adopted the pattern; and this registry already FKs `app.*` directly, ending
the schema-decoupling rationale.

### 6.1 What is deleted (in-place, per module)

| Module | DDL (tables + FKs + indexes) | `ensure_*` fn | `handle_update_profile` trigger + fn | Policies/grants |
|---|---|---|---|---|
| msg | `db/fnb-msg/deploy/00000000010400_msg.sql:21-31` | `…10410_msg_fn.sql:24-60` (+ all `ensure_msg_resident` call sites) | `…10410_msg_fn.sql:~5-21` | `…10420_msg_policies.sql:31-47` |
| todo | `db/fnb-todo/deploy/00000000010450_todo.sql:27-37` | `…10470_todo_fn.sql:32-64` | `…10470_todo_fn.sql:~12-29` | `…10480_todo_policies.sql:31-48` |
| loc | `db/fnb-loc/deploy/00000000010300_loc.sql:23-31` | `…10310_loc_fn.sql:24-56` | `…10310_loc_fn.sql:~5-21` | `…10330_loc_policies.sql` (mirror sections) |
| storage | `db/fnb-storage/deploy/00000000010600_storage.sql:8-15` | `…10610_storage_fn.sql:2-34` | — (never existed) | `…10620_storage_policies.sql:21-22,34-48` |

Also deleted: the direct `loc.loc_tenant` lazy-init inserts in the dataset syncs
(`db/fnb-location-datasets/deploy/00000000010710_location_datasets_fn.sql:63`,
`db/fnb-airports/deploy/00000000010810_airports_fn.sql:192`).

### 6.2 Column conversions (rename + retype; old FK → URN ref)

| Table.column (old) | New column | Notes |
|---|---|---|
| `msg.topic.tenant_id → msg.msg_tenant` | `tenant_id uuid NOT NULL REFERENCES app.tenant(id)` | tenant keys stay uuid (§2) — same for every table below |
| `msg.message.posted_by_msg_resident_id` | `posted_by_resident_urn text NOT NULL REFERENCES res.resource(urn)` | |
| `msg.subscriber.msg_resident_id` | `resident_urn text NOT NULL REFERENCES res.resource(urn)` | unique `(topic_id, resident_urn)` |
| `msg_fn.subscriber_info.msg_resident_id` (composite) | `resident_urn text` | `db/fnb-msg/deploy/00000000010408_msg_fn_types.sql:6`; UI passes URNs end-to-end |
| `todo.todo.resident_id` | `resident_urn text NULL REFERENCES res.resource(urn)` | keeps old nullability (assignee) |
| `loc.location.resident_id` | `resident_urn text NOT NULL REFERENCES res.resource(urn)` | creator |
| `storage.asset.resident_id` | `resident_urn text NOT NULL REFERENCES res.resource(urn)` | uploader; `asset_info` composite is unaffected (no resident field) |

Plain FKs (not deferred): the resident's registry row is created when the resident is
(§5 table), always before anything references it. Inside `_fn` bodies the old
`ensure_<module>_resident(_resident_id)` call is replaced by one lookup:
`select urn into _resident_urn from res.resource where id = _resident_id;`
(`_fn` is SECURITY DEFINER — no RLS surprise; a miss means an unregistered resident, which
is a hard error worth raising).

### 6.3 Consumers that change with the columns

- **WS carve-out query** `packages/db-access/src/queries/msg.ts:15` — sender join becomes
  `left join res.resource rr on rr.urn = m.posted_by_resident_urn
   left join app.resident r on r.id = rr.id`.
- **GraphQL documents** (`packages/graphql-client-api/src/graphql/…`): `Message.graphql`
  (`postedBy` → resource hop → `resident { displayName }` per §4.7), `Subscriber.graphql`,
  `mySubscribedTopics.graphql`, `storage/query/assetDetail.graphql` + `allAssets.graphql`
  (uploader/tenant relations repoint), and the picker queries `msgResidentsList` /
  `todoResidentsList` are **replaced by one `residentsList`** query on `app.resident`
  (already exposed; RLS `view_all_for_tenant`), selecting `urn` for use as the reference
  value. Exact inflected relation names recorded in `client.data.md` after codegen.
- **Composables/mappers/types**: `useMsgTopics` / `useMsgTopic` / `useTodoMsg` /
  `useMsgResidents` (`graphql-client-api`), `fnb-types/src/message-with-sender.ts`, and the
  msg-app/tenant-app consumers (`Msg.vue`, `useTopicMessages`) follow the new shapes —
  participant/assignee references are `Urn`s.
- **seed.sql** — unaffected (writes only through `_fn` creators).

---

## 7. UUIDv7 convention (bundled)

`res_fn.uuid_generate_v7()` ships in fnb-res. **Convention change (forward-only): new
business tables default their PK to `res_fn.uuid_generate_v7()`** instead of
`gen_random_uuid()`. Existing tables keep their v4 ids (column type is `uuid` either way;
URNs don't care). Swap the body to native `uuidv7()` when the postgres image reaches PG18.
Update `fnb-db-designer` SKILL.md's Table Design Conventions when this ships (R21).

---

## 8. Docs & skills to update when this ships (R21)

- `CLAUDE.md` — DB package list/count + deploy order line; drop the "parallel shadow tables"
  paragraph from the schema-pattern description.
- `.claude/skills/fnb-db-designer/SKILL.md` — package list, UUIDv7 default, "registered
  business tables" convention (urn column + FK + register call); **remove** the shadow-table
  / `ensure_<module>_resident` / `handle_update_profile` pattern sections.
- `.claude/skills/fnb-stack-implementor/SKILL.md` + `.claude/specs/graphql-api-pattern.md` —
  `res`/`res_api` in the exposed-schemas list; remove shadow-table checklist items (DB-layer
  step 2/3 mention parallel tenant/resident tables + the propagation trigger).
- `.claude/specs/package-layers-pattern.md` — `fnb-types` wording ("type-only, zero runtime
  values" → allows the pure `parseUrn`/`formatUrn`/`isUrn` helpers).
- `.claude/skills/skill-map.md` — no new skill; fnb-res is owned by `fnb-db-designer`.
- Module specs that document the mirrors (`.claude/specs/**` msg/todo/loc/asset-storage
  `_shared.data.md` files) — Mode 3 sync pass after implementation.

---

## 9. Verification notes (implementation-time, not open questions)

- **FK target on a generated column**: `subject_urn REFERENCES res.resource(urn)` targets a
  stored generated column — allowed (the generated-column FK restriction applies to
  *referencing* columns with cascading write actions). Verify on the deployed PG version at
  implementation; fallback: stacking + reference columns switch to
  `*_id uuid REFERENCES res.resource(id)` and resolve the urn via the join — contract
  otherwise unchanged.
- The airports sync registration (~85k registry inserts inside the sync transaction) is the
  largest single step.
- After rebuild: `pnpm graphql-api-generate` then confirm the field names PostGraphile
  produces (simplify-inflection: `resourceById` → `resource`?, the reverse relation for
  `subject_urn`, the forward relations for `posted_by_resident_urn` / `resident_urn`, and
  the §4.7 computed fields) — record actuals in `client.data.md` when known.
