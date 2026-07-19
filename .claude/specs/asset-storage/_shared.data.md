# Asset Storage — Shared Data

> **URN-registry migration (2026-07-10):** the `<module>_tenant`/`<module>_resident` mirror
> tables, `ensure_<module>_resident`, and the `handle_update_profile` triggers described below
> are **removed**. Resident references are now URN columns (`posted_by_resident_urn`,
> `resident_urn` — `text REFERENCES res.resource(urn)`); `tenant_id` FKs point at
> `app.tenant(id)`; display names resolve via `resourceBy…Urn { resident { displayName } }`;
> the resident picker is the shared `residentsList` query (`ActiveTenantResidents`). Registered
> tables carry a generated `urn` column. Authoritative contract: `.claude/specs/urn-registry/`
> (`_shared.data.md` §5–§6). Mirror-table details below are historical.

> **URN stacking v2 (2026-07-10):** `storage.asset.context` (+ the `asset_context` enum) and
> `owning_entity_id` are **removed** — `subject_urn` is the only attach mechanism. Upload takes an
> optional `subjectUrn` form field (no `context`/`owningEntityId`); per-subject reads are
> `assetsBySubject` / `publicAssetsForSubjectList(_subjectUrn)` via `useSubjectAssets(subjectUrn)`;
> the quarantine key is `quarantine/{tenantId}/{subjectSeg}/{assetId}.{ext}`. Authoritative
> contract: `.claude/specs/urn-registry/stacking-v2.data.md`. `context`/`owning_entity_id`
> mentions below are historical.


## Status
**Implemented.** DB module: `db/fnb-storage/` deployed 2026-07-03; the quarantine-first additions
(scan resolution `…10625`, template seeding `…10630`, public-fn `clean` filter `…10635`) deployed
2026-07-06. Types layer (`fnb-types/src/asset.ts` + mapper) built 2026-07-06. Correction landed
with Phase 5: the `insert_asset` gate is `jwt.enforce_any_permission(['p:app-admin',
'p:app-user'])` — admin-only profiles (no `p:app-user` license) can also upload.

**v2 (2026-07-06 spec / 2026-07-07 implemented) — image processing:** sections marked **(v2 draft)**
below add `tags` + `parent_asset_id`, the derived-asset (thumbnail) model, user tags at upload, and
the two worker-only tag/derived functions (`insert_derived_asset`, `add_asset_tags`). **Implemented
2026-07-07** — all SQL landed as in-place edits to existing deploy files (no new sqitch changes;
dev rebuild wiped + redeployed, see memory `sqitch-edit-in-place`); `pnpm build` green. Driven by
`.claude/issues/addressed/0350__storage___asset-image-thumbnails__________LOW__.plan.md`.

**detail (2026-07-07 — implemented) — asset detail page:** sections marked **(detail)** below
add the nullable `wf_id` column (asset-scan workflow instance deep-link), `storage_api.delete_asset`
(SECURITY INVOKER soft-delete + child cascade), a `grant update on storage.asset to authenticated,
service_role` (the INVOKER delete runs the `UPDATE` as the caller, so RLS scopes rows — but the
caller needs table-level `UPDATE`, previously only `SELECT` was granted), and `Asset.wfId` in
fnb-types. **Implemented 2026-07-07** — in-place edits to existing deploy files (no new sqitch
changes; dev rebuild redeployed); `pnpm build` green. Driven by
`.claude/issues/in-flight/0010__storage___asset-detail-page…plan.md`.

Shared across the upload endpoint, the `asset-scan` workflow, the GraphQL layer, and the
storage-app UI. Defines the `fnb-storage` DB module, the data model, the permission model, and the
shared types.

---

## DB Module: `fnb-storage` (new sqitch package `db/fnb-storage/`)

Standard three-schema module pattern (`storage` / `storage_fn` / `storage_api`), mirroring `fnb-msg`.
Scaffold with `new-db-package`; author with `sqitch-expert`.

- **NOTE (CLAUDE.md):** during a `sqitch` session, do **not** run any `git` commands.
- Register for deployment: add `fnb-storage` to `DEPLOY_PACKAGES` in `docker-compose.yml`
  (`db-migrate`): `"${DEPLOY_PACKAGES:-fnb-auth fnb-app fnb-storage}"`.
- `sqitch.plan` depends on `fnb-app:00000000010220_app` (for `app.tenant`, `app.resident`, `jwt.*`).

### Deploy files (each with matching `revert/` + `verify/`, in `sqitch.plan`)

#### 1. `<ts>_storage.sql` — schema, enums, tables

```sql
create schema storage;

create type storage.asset_context as enum ('no_context', 'todo', 'support-ticket');
create type storage.scan_status   as enum ('pending', 'clean', 'infected', 'error');
create type storage.asset_status  as enum ('active', 'deleted');

-- shadow tables (module pattern)
create table storage.storage_tenant (
  tenant_id uuid not null references app.tenant(id) primary key
  ,name citext not null
);
create table storage.storage_resident (
  resident_id uuid not null references app.resident(id) primary key
  ,tenant_id uuid not null references storage.storage_tenant(tenant_id)
  ,display_name citext not null
);

create table storage.asset (
  id uuid not null default gen_random_uuid() primary key
  ,tenant_id uuid not null references storage.storage_tenant(tenant_id)
  ,resident_id uuid not null references storage.storage_resident(resident_id)  -- uploader
  ,created_at timestamptz not null default current_timestamp
  ,updated_at timestamptz not null default current_timestamp
  ,context storage.asset_context not null default 'no_context'
  ,owning_entity_id uuid                       -- nullable; NO FK; indexed for per-entity queries
  ,is_public boolean not null default false    -- immutable at upload; drives visibility prefix + anon RLS
  ,original_name text not null
  ,extension text not null
  ,content_type text not null
  ,size_bytes bigint not null
  ,bucket text not null
  ,storage_key text not null                   -- MinIO object key (computed, see below)
  ,checksum_sha256 text not null
  ,scan_status storage.scan_status not null default 'pending'
  ,scan_signature text                         -- ClamAV signature name when infected
  ,asset_status storage.asset_status not null default 'active'
  ,tags citext[] not null default ''::citext[]              -- (v2 draft) user tags + system tags
  ,parent_asset_id uuid null references storage.asset(id)   -- (v2 draft) derived assets (thumbnail → original)
  ,wf_id uuid null                                          -- (detail) asset-scan workflow INSTANCE id; NO FK (wf is a separate module/RLS); deep-links the detail page → /graphql-api/workflow/[wf_id]
);
create unique index uq_asset_storage_key on storage.asset (bucket, storage_key);
create index idx_asset_tenant_id on storage.asset (tenant_id);
create index idx_asset_resident_id on storage.asset (resident_id);
create index idx_asset_owning_entity on storage.asset (context, owning_entity_id);  -- per-entity lookups
create index idx_asset_public on storage.asset (is_public) where is_public;          -- anon public reads
create index idx_asset_parent_asset_id on storage.asset (parent_asset_id)            -- (v2 draft) child lookups
  where parent_asset_id is not null;
```

**(v2 draft) Tags + derived assets.** `tags` holds user-supplied tags (comma-delimited at upload,
normalized by the endpoint) plus system tags. **Reserved tags** — never user-suppliable (endpoint
rejects with 400): `thumbnail` (marks a derived thumbnail child) and `ai-tags-coming-soon` (the
v1 AI-tagging stub marker, appended by the `ai-tag-asset` workflow step on request).
`parent_asset_id` links a derived asset (v1: thumbnails only) to its original. **Derived assets
are born `clean`** — their bytes are generated by trusted worker code from an already-scanned
`clean` object, so they are written straight to the final `public|private` prefix (never
`quarantine/`), inherit the parent's tenant/resident/context/owning_entity/is_public, and skip
scanning entirely.

**(detail) Workflow linkage — `wf_id`.** A nullable `wf_id` records the `asset-scan`
**workflow instance** that processed this asset, so the asset **detail page** can deep-link to its
run (`/graphql-api/workflow/[wf_id]` — `asset-detail.ui.md`). It is **NO FK** (the `wf` module has
its own tenant-scoped tables/RLS — a cross-module FK would couple them; loose reference like
`owning_entity_id`). Set once, in the **upload transaction**: `wf_api.queue_workflow('asset-scan',
…)` returns `to_jsonb(queue_workflow_result)` = `{ wf: { id, … }, uows_to_schedule }`, so the
endpoint reads the instance id at **`result.wf.id`** (node-pg column `queue_workflow`) and runs
`update storage.asset set wf_id = <id>` in the same txn, null-safe (`endpoint.data.md`). Derived
children **inherit the parent's `wf_id`** (they have no run of their own — the thumbnail/tag steps
live inside the parent's workflow). Nullable so pre-existing rows and manual inserts remain valid.

**Storage key formulas** (computed by the endpoint / workflow, stored here) — the leading segment
encodes visibility so the object store can expose public objects anonymously by prefix:

- **Initial (at upload — ALL assets):**
  `quarantine/[tenant_id]/[context]/[owning_entity_id]/[asset_uuid].[extension]`
  The `quarantine/` prefix is **never** anon-readable; the row is inserted with this key and
  `scan_status='pending'`.
- **Final (written by the `asset-scan` workflow on a `clean` verdict):**
  `[public|private]/[tenant_id]/[context]/[owning_entity_id]/[asset_uuid].[extension]`
  The workflow CopyObjects quarantine → final, deletes the quarantine object, and updates
  `storage_key` via `storage_fn.resolve_asset_scan`.

When `context = 'no_context'` and `owning_entity_id is null`, the entity segment falls back to the
asset's own uuid: `.../no_context/[asset_uuid]/[asset_uuid].[extension]`.
`is_public` is **immutable at upload** — toggling would require physically moving the object between
the `public/` and `private/` prefixes, which is out of scope. While `pending`, the object sits under
`quarantine/` regardless of `is_public`.

#### 2. `<ts>_storage_fn_types.sql` — `storage_fn` / `storage_api` schemas + input type

```sql
create schema storage_fn;
create schema storage_api;

create type storage_fn.asset_info as (
  id               uuid    -- app-generated so the storage_key uuid and row id match; nullable → insert_asset falls back to gen_random_uuid()
 ,context          storage.asset_context
 ,owning_entity_id uuid
 ,is_public        boolean
 ,original_name    text
 ,extension        text
 ,content_type     text
 ,size_bytes       bigint
 ,bucket           text
 ,storage_key      text
 ,checksum_sha256  text
 ,scan_status      storage.scan_status
 ,scan_signature   text
 ,tags             citext[]   -- (v2 draft) TRAILING position — keeps the endpoint's positional row(...) cast a one-param addition
);
```

#### 3. `<ts>_storage_fn.sql` — SECURITY DEFINER logic

- `storage_fn.ensure_storage_resident(_resident_id uuid) RETURNS storage.storage_resident` — lazy-init
  shadow `storage_tenant` + `storage_resident` rows (mirror `msg_fn.ensure_msg_resident`).
- `storage_fn.insert_asset(_info storage_fn.asset_info, _resident_id uuid) RETURNS storage.asset` —
  calls `ensure_storage_resident`, resolves `tenant_id` from the resident, **inserts** the row
  (insert-only, using `coalesce(_info.id, gen_random_uuid())` so the endpoint-supplied id matches the
  `storage_key` uuid), returns it. Does **not** validate the owning entity exists (no FK; loose association).
  **(v2 draft)** also inserts `tags = coalesce(_info.tags, ''::citext[])`; never sets
  `parent_asset_id` (endpoint-path assets are always originals).

#### 4. `<ts>_storage_api.sql` (SECURITY INVOKER gate) + `<ts>_storage_policies.sql` (grants + RLS)

```sql
create or replace function storage_api.insert_asset(_info storage_fn.asset_info)
  returns storage.asset language plpgsql volatile security invoker as $$
begin
  perform jwt.enforce_any_permission(array['p:app-admin','p:app-user']::citext[]);
  return storage_fn.insert_asset(_info, jwt.resident_id());
end; $$;
```

RLS — **two policies per table**: tenant users manage their tenant's rows; super-admins see all
(cross-tenant), mirroring `app.*`'s `manage_all_super_admin` pattern
(`db/fnb-app/deploy/00000000010250_app_policies.sql:38-40`):

```sql
alter table storage.asset            enable row level security;
alter table storage.storage_tenant   enable row level security;
alter table storage.storage_resident enable row level security;

create policy manage_all_for_tenant on storage.asset            -- own-tenant users (read+write)
  for all using (jwt.has_permission('p:app-user', tenant_id));
create policy manage_all_super_admin on storage.asset           -- site-admin cross-tenant view
  for all using (jwt.has_permission('p:app-admin-super'));
-- same manage pair on storage_tenant / storage_resident. NO public/anon policy on the table.
```

- **Grant `select` on `storage.asset` to `authenticated` only** (not `anon`). So the table query
  fields (`assets` / `assetsList`) serve logged-in users (own tenant via RLS; super-admin
  cross-tenant). `anon` has **no** table access — it cannot enumerate.
- Writes stay gated by `storage_api.insert_asset` (`p:app-user`).

### Public reads — fetch-by-reference (P4 resolved)

`anon` (and cross-tenant authed users) read public assets **only via reference**, never by listing.
RLS can't force "must filter by id", so public reads go through **SECURITY DEFINER functions in the
exposed `storage` schema** that require a reference and filter `is_public`. They live in `storage`
(not `storage_api`) so PostGraphile publishes them as query fields, while `insert_asset` stays hidden
in `storage_api`.

> **Rework landed (quarantine-first):** `…10635_storage_public_reads_clean.sql` added
> `and a.scan_status = 'clean'` to both functions, so a pending/infected public asset is never
> returned to `anon`. Shown below in the deployed form.

```sql
-- returns 0/1 row for a known asset id, only if public + active + CLEAN
create function storage.public_asset(_id uuid)
  returns setof storage.asset
  language sql stable security definer set search_path = '' as $$
    select a.* from storage.asset a
    where a.id = _id and a.is_public and a.asset_status = 'active'
      and a.scan_status = 'clean';
  $$;

-- public assets attached to a specific entity (the "query related files" access, public variant)
-- (v2 draft) adds `and a.parent_asset_id is null` — derived children (thumbnails) are excluded
-- from ALL listings; a thumbnail stays reachable by reference via public_asset(_id).
create function storage.public_assets_for_entity(_context storage.asset_context, _owning_entity_id uuid)
  returns setof storage.asset
  language sql stable security definer set search_path = '' as $$
    select a.* from storage.asset a
    where a.context = _context and a.owning_entity_id = _owning_entity_id
      and a.is_public and a.asset_status = 'active'
      and a.scan_status = 'clean'
      and a.parent_asset_id is null          -- (v2 draft) originals only
    order by a.created_at desc;
  $$;

grant execute on function storage.public_asset(uuid) to anon, authenticated;
grant execute on function storage.public_assets_for_entity(storage.asset_context, uuid) to anon, authenticated;
```

- Both are read-only and hard-filter `is_public` — safe to expose to `anon` (unlike `insert_asset`).
- `security definer set search_path = ''` + fully-qualified names is deliberate (prevents search-path
  hijacking of a definer function).
- Do **not** grant `anon` select on `storage_tenant` / `storage_resident` — the public functions
  return only `storage.asset` rows, so anon can't traverse tenant/uploader relations.
- The table query fields (`assets` / `assetsList`) still exist in the schema (for authed users);
  `anon` calling them hits a table-permission error — public pages must use `publicAsset` /
  `publicAssetsForEntity` instead.

`jwt.*` helper impls: `.claude/specs/architecture-considerations/read-these/a2-auth-sql-helpers.md`.

---

## DB additions for the quarantine-first workflow (Deployed 2026-07-06 — `…10625`/`…10630`/`…10635`)

Three changes (each with `revert/` + `verify/`; **no `git` during sqitch sessions**). The
package gains a cross-package dependency on **`fnb-wf:00000000010520_wf_fn`** (for
`wf_fn.upsert_wf` / `wf_api.queue_workflow`), so `DEPLOY_PACKAGES` must order `fnb-wf` (and its
deps) before `fnb-storage`.

### 1. `storage_fn.resolve_asset_scan` — idempotent verdict writer

Called by the `resolve-asset` workflow handler over the worker's service connection (same DB access
posture as `_workflow-handler.ts`). Guards on the current status so a retried/duplicated run is a
no-op (idempotency).

```sql
create or replace function storage_fn.resolve_asset_scan(
    _asset_id uuid
    ,_verdict storage.scan_status          -- 'clean' | 'infected' | 'error'
    ,_scan_signature text                  -- ClamAV signature when infected, else null
    ,_final_storage_key text               -- final public|private key when clean, else null
  ) returns storage.asset
    language plpgsql volatile security definer
    as $$
  declare
    _asset storage.asset;
  begin
    select * into _asset from storage.asset where id = _asset_id for update;
    if _asset.id is null then
      raise exception 'asset not found: %', _asset_id;
    end if;
    if _asset.scan_status != 'pending' then
      return _asset;   -- already resolved; idempotent no-op
    end if;

    update storage.asset set
      scan_status = _verdict
      ,scan_signature = _scan_signature
      ,storage_key = coalesce(_final_storage_key, storage_key)
      ,asset_status = case when _verdict = 'infected' then 'deleted' else asset_status end
      ,updated_at = current_timestamp
    where id = _asset_id
    returning * into _asset;

    return _asset;
  end;
  $$;
```

No `storage_api` wrapper — this is **not** user-callable; only the worker (service role) executes
it. Grant execute to `service_role` only.

### 2. `storage_fn.ensure_asset_scan_wf(_tenant_id uuid)` — lazy template seed

Mirrors the `ensure_storage_resident` lazy-init pattern: if the tenant has no `asset-scan` wf
template, seed it via `wf_fn.upsert_wf(...)` (template body in `asset-scan-workflow.data.md`).
Called by the upload endpoint inside the insert/queue transaction, before
`wf_api.queue_workflow('asset-scan', ...)`.

Open question (recorded, not blocking): lazy per-tenant seed (this design) vs a single anchor-tenant
seed resolved system-wide. Per-tenant matches how `wf_api.queue_workflow` resolves templates by
`jwt.tenant_id()`.

### 3. Rework of the public read functions

Add `and a.scan_status = 'clean'` to `storage.public_asset` and
`storage.public_assets_for_entity` (amended SQL shown in the Public reads section above).

---

## (v2 draft) Worker-only tag/derived functions — in-place edit to `…10625_storage_resolve_asset_scan.sql`

Two new SECURITY DEFINER functions join `resolve_asset_scan` in the **existing** `…10625` deploy
file. That file is the required home: it deploys **after** `…10620_storage_policies.sql`'s blanket
`grant execute on all routines in schema storage_fn to authenticated`, so its explicit
`revoke … from authenticated; grant … to service_role` posture sticks. (A function defined in
`…10610_storage_fn.sql` would be re-granted to `authenticated` by the later blanket grant.)

```sql
-- Inserts a derived asset (v1: the thumbnail) for an existing parent. Worker-only.
create or replace function storage_fn.insert_derived_asset(
    _parent_asset_id uuid
    ,_id uuid                 -- app-generated so row id matches the storage_key uuid
    ,_storage_key text        -- final-prefix key (derived assets NEVER touch quarantine/)
    ,_extension text
    ,_content_type text
    ,_size_bytes bigint
    ,_checksum_sha256 text
    ,_tags citext[]           -- v1 always array['thumbnail']
  ) returns storage.asset
    language plpgsql volatile security definer as $$
  -- 1. load parent (raise if missing)
  -- 2. IDEMPOTENCY: if a child of _parent_asset_id with 'thumbnail' = any(tags) exists, return it
  -- 3. insert: inherits tenant_id, resident_id, context, owning_entity_id, is_public, bucket,
  --    original_name (verbatim — display metadata) from the parent;
  --    scan_status = 'clean' (born clean — see Tags + derived assets), asset_status = 'active',
  --    parent_asset_id = _parent_asset_id, tags = _tags (children do NOT inherit parent user tags)
  $$;

-- Set-union tag append (no duplicates on re-run); bumps updated_at. Worker-only.
create or replace function storage_fn.add_asset_tags(
    _asset_id uuid
    ,_tags citext[]
  ) returns storage.asset
    language plpgsql volatile security definer as $$
  -- update storage.asset set tags = (select array_agg(distinct t) from unnest(tags || _tags) t), …
  $$;

-- Same grant posture as resolve_asset_scan — never user-callable, no storage_api wrappers:
revoke all on function storage_fn.insert_derived_asset(uuid,uuid,text,text,text,bigint,text,citext[]) from public, authenticated;
grant execute on function storage_fn.insert_derived_asset(uuid,uuid,text,text,text,bigint,text,citext[]) to service_role;
revoke all on function storage_fn.add_asset_tags(uuid,citext[]) from public, authenticated;
grant execute on function storage_fn.add_asset_tags(uuid,citext[]) to service_role;
```

Callers: `thumbnail-asset` (insert_derived_asset) and `ai-tag-asset` (add_asset_tags) — see
`asset-scan-workflow.data.md`.

---

## (detail — implemented) DB additions for the detail page — delete + `wf_id`

Implemented (2026-07-07). Two schema touches for `asset-detail.*`: the `wf_id` column above,
and a **delete gate**, shipped as in-place edits to the existing deploy files (`wf_id` on the
`storage.asset` DDL in `…010600_storage.sql`; `delete_asset` in `…010615_storage_api.sql`; the
`UPDATE` grant in `…010620_storage_policies.sql`) with revert/verify kept in sync — no new sqitch
change; **no `git` during a sqitch session**.

### `storage_api.delete_asset(_id uuid)` — soft-delete + child cascade (SECURITY INVOKER)

The delete is a **REST carve-out** (`DELETE /storage/api/assets/[id]`, `endpoint.data.md`) —
`storage_api` stays hidden from GraphQL (`graphql.data.md` §1), so this never becomes a mutation.
The endpoint calls it via raw `pg` under `withClaims`.

**SECURITY INVOKER on purpose** — it runs as the caller, so the existing RLS policies scope exactly
which rows the update may touch: `manage_all_for_tenant` (own-tenant `p:app-user`) and
`manage_all_super_admin` (super-admin cross-tenant). A caller reaching for another tenant's asset
updates **0 rows** — this *is* the "own-tenant users + super-admin may delete" decision, with no
extra permission branch. (A SECURITY DEFINER helper would bypass RLS and let any `p:app-user`
delete any tenant's asset by id — do **not** delegate to one here.)

```sql
create or replace function storage_api.delete_asset(_id uuid)
  returns setof storage.asset            -- affected rows (asset + children) → endpoint purges their objects
  language plpgsql volatile security invoker as $$
begin
  perform jwt.enforce_any_permission(array['p:app-admin','p:app-user']::citext[]);   -- base auth (R12); RLS scopes the rows
  return query
    update storage.asset
       set asset_status = 'deleted'
          ,updated_at   = current_timestamp
     where (id = _id or parent_asset_id = _id)   -- the asset AND its derived children (thumbnails)
       and asset_status = 'active'               -- idempotent: a second delete matches 0 rows
    returning *;
end; $$;
```

- **Soft-delete** (`asset_status = 'deleted'`) — the row is retained for audit; the object is purged
  by the endpoint (best-effort `DeleteObject` per returned row). A soft-deleted asset's
  `downloadUrl` is **null** (see the gate note below), so no stale link survives.
- **Cascade** to `parent_asset_id = _id` removes the derived thumbnail(s) in the same statement.
- Returns the affected rows so the endpoint knows every `(bucket, storage_key)` to delete from MinIO.
- 0 rows returned ⇒ nothing matched under RLS ⇒ the endpoint responds **404** (distinguishes
  "not yours / not found / already deleted" from a real delete). See `endpoint.data.md`.
- Grants (as implemented 2026-07-07): **EXECUTE** is already covered by the blanket
  `grant execute on all routines in schema storage_api to authenticated, service_role` in the
  policies file — no per-function execute grant was needed. **But** because this is SECURITY INVOKER
  and runs the `UPDATE` as the caller, `authenticated` needs a table-level `UPDATE` on
  `storage.asset` — previously only `SELECT` was granted, so
  `grant update on storage.asset to authenticated, service_role;` was added to
  `…010620_storage_policies.sql`. RLS still scopes the rows; `anon` gets neither.

### `downloadUrl` gate — also require `asset_status = 'active'` (implemented)

The presign plugin (`graphql.data.md` §3) returned null unless `scan_status = 'clean'`. A
soft-deleted asset keeps `scan_status = 'clean'`, so an `asset_status = 'active'` check was **added**
to the plan (reads `$asset.get('asset_status')`; `if (assetStatus !== 'active') return null`, checked
before the scan gate). Its object is purged anyway, so a URL would 404 — better to null it. Applies
to public and private.

---

## Permission model

- **Upload / insert:** `p:app-admin` OR `p:app-user`. `storage_api.insert_asset` calls
  `jwt.enforce_any_permission(array['p:app-admin','p:app-user'])` (R12); the endpoint's claims
  check mirrors the same pair as a UI hint only (R13) — keep the two in sync.
- **Assets page (`/storage/assets`):** RLS-scoped — super-admins (`manage_all_super_admin`) read
  every tenant's assets; regular users only their own tenant's via `manage_all_for_tenant`. The
  same page serves both audiences; the site-admin **nav tool** is gated `p:app-admin-super`.
- **Delete (`/storage/assets/[id]`, detail):** base `p:app-admin` OR `p:app-user`
  (`jwt.enforce_any_permission` in `storage_api.delete_asset`), then RLS scopes which rows the
  SECURITY INVOKER update touches — **own-tenant users** (any `p:app-user` in the asset's tenant)
  **+ super-admins**. No new permission; the existing `manage_all_for_tenant` /
  `manage_all_super_admin` policies express the whole gate. Same pair mirrored as the endpoint's
  UI-hint claims check (R13) — keep in sync.
- No new permission or license type is created (both keys already exist in the anchor app).

---

## Types layer (fnb-types + mappers — updated 2026-07-06)

> This section has been rewritten twice: first when `db-types` (Kysely/Kanel) was retired, then when
> the **`fnb-types`** shared-vocabulary package landed (R3, current form). Read
> `graphql-api-pattern.md` + `packages/fnb-types/src/` siblings (e.g. `support-ticket.ts`) before
> implementing.

- **`@function-bucket/fnb-types` is the type vocabulary.** `Asset` (and its enum unions) are
  hand-written in `packages/fnb-types/src/asset.ts` and barrel-exported from `src/index.ts`
  (the barrel must list every module — a missing export crashes the Node ESM loader at startup).
- **Enum unions copy the GraphQL enum values verbatim (UPPERCASE)** — PostGraphile inflects the DB
  values `no_context`/`support-ticket` etc. to `NO_CONTEXT`/`SUPPORT_TICKET`. Mappers pass enum
  values through unchanged; never lowercase them.
- **Codegen types are internal** to `graphql-client-api`; the mapper
  `packages/graphql-client-api/src/mappers/asset.ts` exports `toAsset(f: AssetFragment): Asset`
  (String() ids, `new Date(...)` timestamps, enum pass-through — mirror `mappers/support-ticket.ts`).
- **Upload endpoint** is **raw pg** calling `storage_api.insert_asset` (H3 carve-out; multipart can't
  ride GraphQL). Its response type `AssetMeta` also lives in **fnb-types** (it is shared by the
  server endpoint and the tenant-app UI — exactly what the vocabulary package is for), using the
  **same UPPERCASE enum values** so the UI has one vocabulary; the endpoint translates to the DB's
  lowercase enum values when calling `insert_asset` / computing the storage key.

---

## Shared types (`packages/fnb-types/src/asset.ts`)

```ts
// Plain flat shapes for storage.asset. Enum unions mirror the GraphQL enums (UPPERCASE).

export type AssetContext = 'NO_CONTEXT' | 'TODO' | 'SUPPORT_TICKET'
export type ScanStatus = 'PENDING' | 'CLEAN' | 'INFECTED' | 'ERROR'
export type AssetStatus = 'ACTIVE' | 'DELETED'

// GraphQL read shape (mapped from AssetFragment by toAsset). downloadUrl is the computed
// presign field — NULL until scanStatus === 'CLEAN' (quarantine-first gating);
// storageKey/bucket are hidden from the API and deliberately absent here.
export interface Asset {
  id: string
  tenantId: string
  residentId: string
  context: AssetContext
  owningEntityId: string | null
  isPublic: boolean
  originalName: string
  extension: string
  contentType: string
  sizeBytes: number
  scanStatus: ScanStatus
  assetStatus: AssetStatus
  downloadUrl: string | null
  tags: string[]                  // (v2 draft) user + system tags; mapper un-Maybes with ?? []
  parentAssetId: string | null    // (v2 draft) set on derived assets (thumbnails)
  wfId: string | null             // (detail) asset-scan workflow instance id; deep-links the detail page
  tenantName: string | null   // from the `tenant` relation (AllAssets); null when not selected
  createdAt: Date
  updatedAt: Date
}

// Upload response (REST carve-out). Same vocabulary; createdAt is an ISO string on the wire.
export interface AssetMeta {
  id: string
  context: AssetContext
  owningEntityId: string | null
  isPublic: boolean
  originalName: string
  extension: string
  contentType: string
  sizeBytes: number
  scanStatus: ScanStatus
  tags: string[]                  // (v2 draft) normalized user tags as recorded at insert
  createdAt: string
}
```

The GraphQL `Asset` type adds a computed `downloadUrl: String` (**nullable** — null unless
`scan_status='clean'`) and **omits** `storageKey` / `bucket` (see `graphql.data.md`).

---

## Status badge color mapping (UC1) — `scanStatus` (fnb-types values, UPPERCASE)

| scanStatus | UBadge color | label |
|------------|--------------|-------|
| `CLEAN`    | `success`    | Clean |
| `PENDING`  | `neutral`    | Malware scan pending… |
| `INFECTED` | `error`      | Infected |
| `ERROR`    | `warning`    | Scan error |

`PENDING` is the **normal initial state** (quarantine-first): every fresh upload shows it until the
`asset-scan` workflow writes the verdict. `INFECTED` rows are soft-deleted by the workflow; `ERROR`
rows await operator review.

**Soft-delete visibility split (W3, decided 2026-07-09 — issue 0330, final-eval option a):**
`AssetsByOwningEntity` (entity pages — todo/ticket embedding via `useEntityAssets`) filters
`condition: { assetStatus: ACTIVE }`, so a user never sees their soft-deleted rows (including
auto-soft-deleted infected uploads) on an entity page. The site-admin `AllAssets` /
`useSiteAssets` **deliberately does not filter** — operator visibility of infected/deleted
attempts is a feature, and the INFECTED badge above renders there.

## Context badge (UC1) — `context` (fnb-types values, UPPERCASE)
| context | color |
|---------|-------|
| `TODO` | `primary` |
| `SUPPORT_TICKET` | `info` |
| `NO_CONTEXT` | `neutral` |
