---
name: tenant-app-datasets-breweries-shared
description: Shared data model for the Breweries dataset tool — location_datasets schema, public loc.location rows, permissions, nav, GraphQL client setup, and the fnb-location-datasets sqitch package.
metadata:
  type: reference
---

# datasets/breweries — Shared Data Types & Permissions

> **URN-registry migration (2026-07-10):** the `<module>_tenant`/`<module>_resident` mirror
> tables, `ensure_<module>_resident`, and the `handle_update_profile` triggers described below
> are **removed**. Resident references are now URN columns (`posted_by_resident_urn`,
> `resident_urn` — `text REFERENCES res.resource(urn)`); `tenant_id` FKs point at
> `app.tenant(id)`; display names resolve via `resourceBy…Urn { resident { displayName } }`;
> the resident picker is the shared `residentsList` query (`ActiveTenantResidents`). Registered
> tables carry a generated `urn` column. Authoritative contract: `.claude/specs/urn-registry/`
> (`_shared.data.md` §5–§6). Mirror-table details below are historical.


Referenced by all `datasets/breweries/*.data.md` files. Do not duplicate these there.

## Status
Implemented — GraphQL (2026-07-09).

---

## Concept

A **public dataset** tool. `location_datasets.brewery` holds the Open Brewery DB–specific fields;
each brewery FKs to a **public** `loc.location` row (anchor-tenant-owned, `is_public = true`,
`resident_id` null) that holds the address/geo fields. Data is empty on a fresh system and is
populated/refreshed by the `sync-breweries` wf workflow (see `sync-workflow.data.md`), triggered
from the list page by a site-admin. Every signed-in user can read everything; nobody writes
through the API — writes happen only inside `location_datasets_fn` from the worker.

Source API: Open Brewery DB (`https://api.openbrewerydb.org/v1`) — no auth, ~11,700 records,
max `per_page=200`. See `.claude/skills/breweries-expert/SKILL.md` for endpoint/field details.

---

## Navigation

Registered in DB (`db/fnb-app/deploy/00000000010240_app_fn.sql`, R14) — new module after the
existing ones:

```
Module: 'datasets' / 'Datasets' / icon: i-lucide-database / permissions: p:app-user, p:app-admin
  'tenant-datasets-breweries' → /tenant/datasets/breweries  i-lucide-beer  p:app-user, p:app-admin
```

## Permission Model

| Action | Required |
|---|---|
| View brewery list / map / detail | `p:app-user` or `p:app-admin` (any signed-in user) |
| Trigger `sync-breweries` workflow | `p:app-admin-super` (site-admin only) |
| Create/update/delete breweries via API | **nobody** — writes only via `location_datasets_fn` from the worker |

RLS: public-catalog read policy (`USING (true)`) on `location_datasets.brewery`; no
insert/update/delete policies. `loc.location` gains a public-read arm (below).

---

## DB Changes

### 1. `fnb-loc` — new sqitch changes `00000000010340_loc_public_locations` + `00000000010350_loc_geolocated`

Public-dataset support on the existing table:

```sql
alter table loc.location add column is_public boolean not null default false;
alter table loc.location alter column resident_id drop not null;

create policy view_public on loc.location
  for select
  using (is_public = true);

-- 00000000010350: flags rows that still need geolocation (any location, not just datasets)
alter table loc.location add column is_geolocated boolean
  generated always as (lat is not null and lon is not null) stored;
```

- Public rows are owned by the **anchor tenant** (`app.tenant.type = 'anchor'`), `resident_id`
  null, `is_public = true`. The anchor tenant's `loc.loc_tenant` mirror row is ensured by
  `location_datasets_fn` at sync time.
- The existing `manage_all_for_tenant` policy is untouched; tenant-owned rows behave exactly as
  before (`resident_id` stays required at the `loc_fn`/`loc_api` layer for tenant flows).

### 2. New sqitch package `db/fnb-location-datasets` (range 10700+)

Appended to `DEPLOY_PACKAGES` in `.env` (after `fnb-storage`):
`… fnb-loc fnb-wf fnb-storage fnb-location-datasets`. Cross-project dependencies:
`fnb-loc:00000000010340_loc_public_locations`, `fnb-app:00000000010250_app_policies`.

| Change | Contents |
|---|---|
| `00000000010700_location_datasets` | schemas `location_datasets`, `location_datasets_fn`, `location_datasets_api`; enum `location_datasets.brewery_type`; table `location_datasets.brewery` |
| `00000000010710_location_datasets_fn` | `location_datasets_fn` composite types + `upsert_breweries`, `brewery_sync_status` |
| `00000000010715_location_datasets_api` | `location_datasets_api.search_breweries`, `brewery_map_points`, `brewery_sync_status` |
| `00000000010720_location_datasets_policies` | schema grants (house pattern) + RLS |

### Enum

```sql
create type location_datasets.brewery_type as enum (
  'unknown','micro','nano','regional','brewpub','contract','proprietor',
  'planning','closed','large','bar','taproom','beergarden','cidery','location'
);
```

`large` and `bar` are deprecated upstream but still present in the data — keep them. `taproom`,
`beergarden`, `cidery`, `location` are **undocumented but present in live data** — the first
sync failed on a `taproom` record, and `/breweries/meta` `by_type` revealed the full live
vocabulary (checked 2026-07-09). Upstream can grow the vocabulary at any time, so the sync is
**self-healing**: `upsert_breweries` validates the raw value against `pg_enum` and coerces
anything unrecognized to `'unknown'`, recording `upstream brewery_type: <raw>` in the row's
`notes` column (a later sync after extending the enum re-updates the row in place). Import
scope is **everything** including `planning`/`closed`; the list view filters visually.

### Table

```sql
create table location_datasets.brewery (
  id uuid not null default gen_random_uuid() primary key,
  external_id text not null,                       -- Open Brewery DB UUID (upsert key)
  location_id uuid not null references loc.location(id),
  name citext not null,
  brewery_type location_datasets.brewery_type not null,
  notes text,                                      -- e.g. the raw upstream type when coerced to 'unknown'
  phone text,
  website_url text,
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);

create unique index idx_uq_brewery_external_id on location_datasets.brewery(external_id);
create unique index idx_uq_brewery_location_id on location_datasets.brewery(location_id);
create index idx_brewery_name on location_datasets.brewery(name);
create index idx_brewery_type on location_datasets.brewery(brewery_type);
```

### RLS

```sql
alter table location_datasets.brewery enable row level security;
create policy view_all on location_datasets.brewery for select using (true);
```

No write policies — the worker's root-of-trust client writes via `location_datasets_fn` only.

### API field mapping (Open Brewery DB → fnb)

| API field | Destination |
|---|---|
| `id` | `brewery.external_id` |
| `name` | `brewery.name` **and** `location.name` |
| `brewery_type` | `brewery.brewery_type` |
| `phone` | `brewery.phone` |
| `website_url` | `brewery.website_url` |
| `address_1` | `location.address1` |
| `address_2`, `address_3` | `location.address2` (joined with `', '`, null if both null) |
| `city` | `location.city` |
| `state_province` | `location.state` (`state` API field is a deprecated duplicate — ignore) |
| `postal_code` | `location.postal_code` |
| `country` | `location.country` |
| `latitude` / `longitude` | `location.lat` / `location.lon` (text columns; frequently null) |
| `street` | ignore (deprecated duplicate of `address_1`) |

Location rows are created with `tenant_id = <anchor>`, `resident_id = null`, `is_public = true`.

---

## `location_datasets_fn` / `_api` Functions

House pattern (R8): `_api` is `SECURITY INVOKER` + `jwt.*` gates, delegates to `_fn` which takes
explicit parameters and never calls `jwt.*`.

### `location_datasets_fn.upsert_breweries(_breweries jsonb) returns location_datasets_fn.upsert_result`

Worker-only (no `_api` wrapper — called by the sync handler through the root-of-trust client,
same trust model as `wf_fn.complete_uow`). Per call (one API page, ≤200 elements):

1. Resolve the anchor tenant (`select id from app.tenant where type = 'anchor'`); ensure its
   `loc.loc_tenant` mirror row exists (insert … on conflict do nothing).
2. For each element: upsert keyed on `brewery.external_id` —
   - exists → update `brewery` fields + its `loc.location` row, bump `updated_at`
   - new → insert `loc.location` (public row, mapping above), then insert `brewery`
3. Return `(inserted int, updated int)` composite.

Re-invocation therefore only updates existing rows (plus inserts genuinely new upstream records).
There is **no delete pass** — records removed upstream go stale; `closed` type covers the common
case.

### Composite types (`location_datasets_fn`)

```sql
create type location_datasets_fn.upsert_result as (inserted int, updated int);
create type location_datasets_fn.brewery_sync_status as (
  last_synced_at timestamptz,   -- max(brewery.updated_at); null when table empty
  brewery_count int,
  in_progress boolean           -- a non-terminal sync-breweries wf instance exists
);
create type location_datasets_fn.search_breweries_options as (
  search_text text,             -- ilike on brewery.name
  brewery_type location_datasets.brewery_type,
  state text,
  country text,
  is_geolocated boolean,        -- true = geocoded only, false = ungeocoded only, null = all
  paging_options app_fn.paging_options
);
```

### `location_datasets_api.*` (PostGraphile surface, all `SECURITY INVOKER`)

| Function | Returns | Gate | Purpose |
|---|---|---|---|
| `search_breweries(_options search_breweries_options)` | `setof location_datasets.brewery` | `p:app-user` or `p:app-admin` | List query: name ilike + type/state/country/is_geolocated filters + paging |
| `brewery_map_points()` | `setof location_datasets_fn.brewery_map_point` | `p:app-user` or `p:app-admin` | Lightweight `(id, name, brewery_type, lat, lon)` for geocoded rows only (`l.is_geolocated`) — feeds the map GeoJSON source |
| `brewery_sync_status()` | `location_datasets_fn.brewery_sync_status` | `p:app-user` or `p:app-admin` | Status line + button disable state |

Detail page reads the table directly via the PostGraphile `brewery(id)` root field (RLS
`view_all` makes it visible), joined to its `location`.

`in_progress` detection: an `is_template = false` `wf.wf` row for identifier/type
`sync-breweries` whose status is non-terminal — verify the exact status vocabulary against
`wf_fn` at implementation time (Open Question 1).

---

## fnb-types (R3)

New in `packages/fnb-types`:

```ts
export type BreweryType =
  | 'UNKNOWN' // sync coerces unrecognized upstream values here; raw value lands in notes
  | 'MICRO' | 'NANO' | 'REGIONAL' | 'BREWPUB' | 'CONTRACT' | 'PROPRIETOR'
  | 'PLANNING' | 'CLOSED' | 'LARGE' | 'BAR'
  | 'TAPROOM' | 'BEERGARDEN' | 'CIDERY' | 'LOCATION'   // verbatim GraphQL enum values

export interface Brewery {
  id: string
  externalId: string
  name: string
  breweryType: BreweryType
  notes: string | null
  phone: string | null
  websiteUrl: string | null
  location: Location          // existing loc vocabulary type
  createdAt: Date
  updatedAt: Date
}

export interface BreweryMapPoint {
  id: string
  name: string
  breweryType: BreweryType
  lat: number
  lon: number
}

export interface BrewerySyncStatus {
  lastSyncedAt: Date | null
  breweryCount: number
  inProgress: boolean
}
```

Enum values copy the PostGraphile enum verbatim (UPPERCASE — see memory
`fnbtypes-enum-values-match-graphql`); mappers pass through without case changes.

---

## GraphQL Client Setup

Same stack as `loc` (see `.claude/specs/tenant-app/loc/_shared.data.md`):

- **urql plugin**: `apps/tenant-app/app/plugins/urql.ts` (already present — no change)
- **Fragments**: `packages/graphql-client-api/src/graphql/locationDatasets/fragment/`
  — `Brewery.graphql` (all brewery fields + nested location fields — expand fully, memory
  `fragments-all-fields`), `BreweryMapPoint.graphql`
- **Operations**: `src/graphql/locationDatasets/query/` — `searchBreweries`, `brewery`,
  `breweryMapPoints`, `brewerySyncStatus`. No new mutation — sync reuses the existing
  `queueWorkflow` operation from the wf module.
- **Mappers**: `src/mappers/brewery.ts` (`toBrewery`, `toBreweryMapPoint`, `toBrewerySyncStatus`)
- **Composables** (`src/composables/`): `useBreweries.ts` (search + sync status + `queueSync`),
  `useBrewery.ts` (detail), `useBreweryMapPoints.ts`
- **Re-exports**: `apps/tenant-app/app/composables/useBreweries.ts`, `useBrewery.ts`,
  `useBreweryMapPoints.ts` (single-line re-exports) + `packages/graphql-client-api/src/index.ts`

---

## Map Infrastructure

Already in place — no new env vars:
- `mapbox-gl` + `nuxt-mapbox` are direct deps of `apps/tenant-app` (memory
  `pnpm-no-hoist-app-deps` satisfied)
- Token: `MAPBOX_ACCESS_TOKEN` via compose → `nuxt.config.ts` `mapbox.accessToken`
- Existing usage precedent: `apps/tenant-app/app/pages/loc/[id].vue`

Open Brewery DB needs no key; the worker container needs outbound HTTPS (it already has it —
future `get-stock-quote`-style handlers assume the same).

---

## Open Questions

Both resolved 2026-07-09 during implementation planning (see
`.claude/issues/identified/0010__loc_______breweries-dataset_______________MED__.plan.md`):

- [x] 1. Non-terminal status vocabulary: `wf.uow_status_type` =
      `incomplete · paused · waiting · complete · canceled · deleted · error · template ·
      trigger_set`; instance status is the root `type = 'wf'` uow's status (`wf.wf_status`).
      `in_progress` = a `is_template = false` `sync-breweries` `wf.wf` row whose root uow status
      is in (`incomplete`, `paused`, `waiting`, `trigger_set`).
- [x] 2. `wf_api.queue_workflow` carries **no permission gate** (SECURITY DEFINER, granted to
      `anon`/`authenticated`), and `wf_fn.clone_wf_template` resolves templates globally (tenant
      filter commented out) — so any authenticated user can queue `sync-breweries`.
      **User decision:** no guard in this feature; the sync trigger ships **UI-gated only**
      (button hidden without `p:app-admin-super`). The API-level template gate is deferred to
      `.claude/issues/identified/0030__wf________wf-rls-missing__________________CRT__.plan.md`
      (holistic wf permissions; includes a `required_permission_key` sketch).
