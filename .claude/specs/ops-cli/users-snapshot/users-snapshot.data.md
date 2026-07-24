# users-snapshot — data contract

## Status
Draft — approved for implementation (no `[FILL IN]`s outstanding).

Companion to `README.md` (decisions live there). This file is the full technical contract.

## CLI surface

```
pnpm ops:users-snapshot export --out snapshot-2026-07-23.json
pnpm ops:users-snapshot import --file snapshot-2026-07-23.json [--dry-run]
pnpm ops:users-snapshot --help
```

- `scripts/ops/users-snapshot.ts`, run via tsx. Imports `PG_URL` from `scripts/_env.ts`
  (fail-fast if unset). No new dependencies.
- All psql executions use the `scripts/db-exec.ts` transport:
  `docker run --rm -i --network fnb-network -v <file>:/tmp/… postgres:18 psql ${PG_URL} …`
  with `-v ON_ERROR_STOP=1`.
- `--help` includes the droplet restore drill: `env-rebuild-empty` (user-run) → **do not**
  visit `/auth/setup` → `import --file …` → log in via ZITADEL.

## Snapshot envelope

```jsonc
{
  "version": 1,
  "exported_at": "2026-07-23T18:00:00.000Z",   // exporting DB's clock, ISO-8601 UTC
  "source": "<PG_URL host/dbname, credentials stripped>",
  "counts": { "tenant": 3, "profile": 12, "tenant_subscription": 5, "resident": 14, "license": 20 },
  "tables": {
    "tenant": [ /* rows, columns below, ordered parents-first */ ],
    "profile": [ /* … */ ],
    "tenant_subscription": [ /* … */ ],
    "resident": [ /* … */ ],
    "license": [ /* … */ ]
  }
}
```

Import refuses any file whose `version` ≠ 1 or whose `counts` disagree with the actual array
lengths (cheap corruption/truncation check).

## Exported columns (explicit lists — never `select *`)

Generated columns are **excluded** (they cannot be inserted): `profile.full_name`, and the
`res_urn` columns on `tenant`/`resident` (added by `db/fnb-res` retrofit).

| Table | Columns |
|---|---|
| `app.tenant` | `id, created_at, updated_at, identifier, name, type, status, parent_tenant_id` |
| `app.profile` | `id, created_at, updated_at, email, identifier, first_name, last_name, phone, display_name, avatar_key, status, is_public, idp_user_id` |
| `app.tenant_subscription` | `id, tenant_id, license_pack_key, created_at, updated_at, status` |
| `app.resident` | `id, profile_id, invited_by_profile_id, invited_by_display_name, tenant_id, tenant_name, email, display_name, created_at, updated_at, status, type` |
| `app.license` | `id, tenant_id, resident_id, profile_id, tenant_subscription_id, license_type_key, created_at, updated_at, expires_at, status` |

Enums (`tenant.type/status`, `profile.status`, `resident.status/type`, `license.status`,
`tenant_subscription.status`) serialize as their text labels; the import casts them back.

## Export

One psql call (`-At -c`) selecting a single JSON document built server-side:
`json_build_object('version', 1, 'exported_at', …, 'counts', …, 'tables',
json_build_object('tenant', (select coalesce(json_agg(t), '[]') from (…) t), …))`.

- **Tenant ordering — parents before children, recursively.** The self-FK
  `parent_tenant_id` is not guaranteed one level deep (workspace/client/organization nest),
  so the tenant sub-select orders by depth from a recursive CTE rooted at
  `parent_tenant_id is null`, then `created_at`. Other tables order by `created_at` (FK
  targets are upserted in table order — see below — so intra-table order is cosmetic).
- Script writes stdout to `--out` (refusing to overwrite an existing file), then prints the
  `counts` object.
- All tenants are exported, **including the anchor** and blocked/invited residents —
  the snapshot is a verbatim capture, no filtering.

## Import

The script reads + validates the JSON, generates one SQL file in the scratchpad, and executes
it via the docker psql transport. The JSON is embedded as a dollar-quoted literal (the script
picks a tag like `$snap1$` and verifies it does not occur in the payload) and parsed once into
a `jsonb` in the transaction. Structure of the generated SQL:

```sql
begin;

-- 1. Preamble: seed application/license packs/types on a virgin env. Idempotent no-op
--    if already installed (db/fnb-app/deploy/00000000010240_app_fn.sql:212).
select app_fn.install_anchor_application();

-- 2. Ordered upserts, each shaped as:
--    insert into app.<table> (<explicit columns>)
--    select … from jsonb_to_recordset($snap1$…$snap1$::jsonb #> '{tables,<table>}')
--      as r(id uuid, …, type app.tenant_type, …)        -- enum/citext casts in the AS clause
--    on conflict (id) do update set <every non-id column> = excluded.<column>;
--
--    Table order (FK targets first):
--      tenant → profile → tenant_subscription → resident → license
--    Tenant rows are already parents-first in the file; the single INSERT…SELECT preserves
--    that order, satisfying the parent_tenant_id self-FK.

-- 3. URN registration (deny-all res.resource; res_fn.register_resource is idempotent):
--      per tenant:   res_fn.register_resource(id, id, 'app', 'tenant')
--      per resident: res_fn.register_resource(id, tenant_id, 'app', 'resident')

-- 4. Assertions: for each table, actual row count in the DB >= snapshot count; raise
--    exception (aborting everything) on any shortfall. Print a per-table
--    inserted/updated summary (from xmax = 0 style counting or RETURNING into a temp table).

commit;   -- or rollback; when --dry-run
```

### Failure modes (all abort the whole transaction — nothing partial ever lands)

| Condition | Outcome |
|---|---|
| Target already bootstrapped with a **different** anchor | `app.tenant.identifier` unique violation on `'anchor'` → abort. Correct: restore targets a virgin env; a human decides otherwise. |
| Profile on target with same `email`/`identifier`/`display_name`/`idp_user_id` but different `id` | Unique violation → abort (fail-loud decision, README). |
| Snapshot references a `license_pack_key`/`license_type_key` not seeded by the preamble | FK violation → abort. Means source had non-base packs; those would need their own install step — surface, don't guess. |
| `counts` mismatch / wrong `version` | Script refuses before touching the DB. |

### Idempotence

Re-importing the same file is safe: every upsert re-applies the same values, and
`register_resource` no-ops. Self-import onto the source env is the standard `--dry-run`
verification.

## Permissions / auth

None — this never runs inside the app. `PG_URL` is the superuser/owner connection from
`.env` (same trust level as `db-deploy`/`db-exec`). RLS does not apply to it. The script must
never be reachable from any app or workflow (not registered in nav — R14 irrelevant; not an
n8n workflow — R22 irrelevant).

## Out of scope (deliberate)

Messages, todos, polls, games, assets/storage, notifications + channel preferences, support
tickets, OTP/phone verification, sessions, n8n state. Also excluded: `res.resource` rows for
anything other than the tenant/resident registrations above, and ZITADEL's own user store
(it persists independently; `idp_user_id` re-links).
