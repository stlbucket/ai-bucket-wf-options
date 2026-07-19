---
name: tenant-app-datasets-airports-shared
description: Shared data model for the Airports dataset tool — the airports schema trio (six tables + sync_source), public loc.location rows, permissions, nav, GraphQL client setup, and the fnb-airports sqitch package.
metadata:
  type: reference
---

# datasets/airports — Shared Data Types & Permissions

> **URN-registry migration (2026-07-10):** the `<module>_tenant`/`<module>_resident` mirror
> tables, `ensure_<module>_resident`, and the `handle_update_profile` triggers described below
> are **removed**. Resident references are now URN columns (`posted_by_resident_urn`,
> `resident_urn` — `text REFERENCES res.resource(urn)`); `tenant_id` FKs point at
> `app.tenant(id)`; display names resolve via `resourceBy…Urn { resident { displayName } }`;
> the resident picker is the shared `residentsList` query (`ActiveTenantResidents`). Registered
> tables carry a generated `urn` column. Authoritative contract: `.claude/specs/urn-registry/`
> (`_shared.data.md` §5–§6). Mirror-table details below are historical.


Referenced by all `datasets/airports/*.data.md` files. Do not duplicate these there.

## Status
Implemented — GraphQL (2026-07-10). Implementation corrections are folded in below; both Open
Questions resolved (see §Open Questions). First sync verified: counts matched recon exactly,
zero `unknown` airport-type coercions, 31 navaid enum coercions (empty upstream values).

---

## Concept

The second **public dataset** tool (pattern: breweries —
`.claude/specs/tenant-app/datasets/breweries/`). OurAirports has **no API**: the entire
dataset ships as seven nightly-refreshed CSV files on GitHub Pages; the sync downloads six of
them whole and upserts locally (see `.claude/skills/airports-expert/SKILL.md` — the recon
source of truth; skip `airport-comments.csv`).

Six tables in a dedicated **`airports`** schema (`airports` / `airports_fn` / `airports_api`
trio, new sqitch package `db/fnb-airports`): `airport` is the main entity; `runway`,
`airport_frequency` are its children; `navaid` is a sibling geo entity; `country` and `region`
are lookup tables the others reference by code. Each **airport** FKs to a **public**
`loc.location` row (anchor-tenant-owned, `is_public = true`, `resident_id` null — the
mechanism `fnb-loc:00000000010340` built for breweries) holding name/city/geo. Only airports
get the loc split; runway ends and navaids keep plain coordinate columns.

Data is empty on a fresh system and populated/refreshed by the **`sync-airports`** wf workflow
(see `sync-workflow.data.md`), triggered from the list page by a site-admin. Every signed-in
user reads everything; nobody writes through the API — writes happen only inside `airports_fn`
from the worker.

---

## Navigation

Registered in DB (`db/fnb-app/deploy/00000000010240_app_fn.sql`, R14). The `datasets` module
row already exists (breweries) — add one tool row:

```
Module: 'datasets' (existing — no change)
  'tenant-datasets-airports' → /tenant/datasets/airports  i-lucide-plane  p:app-user, p:app-admin
```

## Permission Model

| Action | Required |
|---|---|
| View airport list / map / detail | `p:app-user` or `p:app-admin` (any signed-in user) |
| Trigger `sync-airports` workflow | `p:app-admin-super` (site-admin only, UI-gated — same posture as breweries; API-level wf gate deferred to issue 0030) |
| Create/update/delete any dataset row via API | **nobody** — writes only via `airports_fn` from the worker |

RLS: public-catalog read policy (`using (true)`) on all six tables + `sync_source`; no
insert/update/delete policies. Airports' `loc.location` rows are readable via the existing
`view_public` policy — no `fnb-loc` change needed this time.

---

## DB Changes

### New sqitch package `db/fnb-airports` (range **10800+** — next free; 10900 is taken by `fnb-auth`'s webhook)

Scaffold via `/new-db-package`. Appended to `DEPLOY_PACKAGES` in `.env` (+ `.env.example`)
after `fnb-location-datasets`:
`… fnb-wf fnb-storage fnb-location-datasets fnb-airports`. Cross-project dependencies:
`fnb-loc:00000000010340_loc_public_locations`, `fnb-app:00000000010250_app_policies`.

| Change | Contents |
|---|---|
| `00000000010800_airports` | schemas `airports`, `airports_fn`, `airports_api`; enums; tables `country`, `region`, `airport`, `runway`, `airport_frequency`, `navaid`, `sync_source` |
| `00000000010810_airports_fn` | `airports_fn` composite types + the six `upsert_*` fns, `record_sync_source`, `airport_sync_status` |
| `00000000010815_airports_api` | `airports_api.search_airports`, `airport_map_points`, `airport_sync_status` |
| `00000000010820_airports_policies` | schema grants (house pattern) + RLS |

### Enums

All **open** enums: `'unknown'` sentinel first, upsert coerces unrecognized/empty raw values
against `pg_enum` and records `upstream <column>: <raw>` in the row's `notes` (the breweries
drift armor). Live vocabularies verified 2026-07-09 (`airports-expert`).

```sql
-- docs say 'closed_airport'; live data says 'closed' (13,331 rows) — trust the data
create type airports.airport_type as enum (
  'unknown','balloonport','closed','heliport','large_airport','medium_airport',
  'seaplane_base','small_airport'
);

create type airports.continent as enum (
  'unknown','AF','AN','AS','EU','NA','OC','SA'
);

create type airports.navaid_type as enum (
  'unknown','NDB','NDB-DME','DME','VOR','VOR-DME','VORTAC','TACAN'
);

-- upstream is UPPERCASE (LO/HI/BOTH/TERMINAL/RNAV); coerce case-insensitively
create type airports.navaid_usage_type as enum (
  'unknown','lo','hi','both','terminal','rnav'
);

-- upstream already has literal 'UNKNOWN' plus empties — both coerce to 'unknown'
create type airports.navaid_power as enum (
  'unknown','low','medium','high'
);
```

**NOT enums** (recon: free text in practice): `runway.surface` (664 distinct live values),
`airport_frequency.type` (549 distinct). Model both as `text`.

### Tables

House conventions throughout: uuid PKs, `external_id` = the upstream integer id (upsert key,
unique), `created_at`/`updated_at` timestamptz, FK columns indexed. Upstream numeric columns
arrive as strings-or-empty → nullable typed columns, coerced at the worker edge.

```sql
create table airports.country (
  id uuid not null default gen_random_uuid() primary key,
  external_id integer not null,
  code citext not null,              -- ISO-3166-1 alpha-2 (+ unofficial e.g. 'XK')
  name text not null,
  continent airports.continent not null default 'unknown',
  wikipedia_link text,
  keywords text,
  notes text,
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);
create unique index idx_uq_country_external_id on airports.country(external_id);
create unique index idx_uq_country_code on airports.country(code);

create table airports.region (
  id uuid not null default gen_random_uuid() primary key,
  external_id integer not null,
  code citext not null,              -- '<ISO2>-<subdivision>' e.g. 'GB-ENG'
  local_code text,
  name text not null,
  continent airports.continent not null default 'unknown',
  iso_country citext not null,       -- soft ref → airports.country.code
  wikipedia_link text,
  keywords text,
  notes text,
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);
create unique index idx_uq_region_external_id on airports.region(external_id);
create unique index idx_uq_region_code on airports.region(code);
create index idx_region_iso_country on airports.region(iso_country);

create table airports.airport (
  id uuid not null default gen_random_uuid() primary key,
  external_id integer not null,      -- OurAirports persistent integer id (upsert key)
  ident citext not null,             -- ICAO / local / generated code — unique upstream
  type airports.airport_type not null default 'unknown',
  name citext not null,
  location_id uuid not null references loc.location(id),
  elevation_ft integer,              -- 17.4% empty upstream
  continent airports.continent not null default 'unknown',
  iso_country citext not null,       -- soft ref → country.code
  iso_region citext not null,        -- soft ref → region.code
  scheduled_service boolean not null default false,  -- upstream 'yes'/'no'
  icao_code citext,                  -- 88% empty
  iata_code citext,                  -- 89% empty
  gps_code citext,
  local_code text,
  home_link text,
  wikipedia_link text,
  keywords text,                     -- comma-separated search fodder; not normalized
  notes text,                        -- raw values from enum coercion
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);
create unique index idx_uq_airport_external_id on airports.airport(external_id);
create unique index idx_uq_airport_ident on airports.airport(ident);
create unique index idx_uq_airport_location_id on airports.airport(location_id);
create index idx_airport_name on airports.airport(name);
create index idx_airport_type on airports.airport(type);
create index idx_airport_iso_country on airports.airport(iso_country);
create index idx_airport_iso_region on airports.airport(iso_region);
create index idx_airport_iata_code on airports.airport(iata_code);

create table airports.runway (
  id uuid not null default gen_random_uuid() primary key,
  external_id integer not null,
  airport_id uuid not null references airports.airport(id),
  length_ft integer,
  width_ft integer,
  surface text,                      -- free text upstream (664 distinct) — NOT an enum
  lighted boolean not null default false,   -- upstream '1'/'0'
  closed boolean not null default false,
  le_ident text,
  le_latitude_deg text,              -- ~67% empty; text like loc.location lat/lon
  le_longitude_deg text,
  le_elevation_ft integer,
  le_heading_deg_t numeric,
  le_displaced_threshold_ft integer,
  he_ident text,
  he_latitude_deg text,
  he_longitude_deg text,
  he_elevation_ft integer,
  he_heading_deg_t numeric,
  he_displaced_threshold_ft integer,
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);
create unique index idx_uq_runway_external_id on airports.runway(external_id);
create index idx_runway_airport_id on airports.runway(airport_id);

create table airports.airport_frequency (
  id uuid not null default gen_random_uuid() primary key,
  external_id integer not null,
  airport_id uuid not null references airports.airport(id),
  type text,                         -- free text upstream (549 distinct) — NOT an enum
  description text,
  frequency_mhz numeric,
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);
create unique index idx_uq_airport_frequency_external_id on airports.airport_frequency(external_id);
create index idx_airport_frequency_airport_id on airports.airport_frequency(airport_id);

create table airports.navaid (
  id uuid not null default gen_random_uuid() primary key,
  external_id integer not null,
  ident citext,
  name text not null,
  type airports.navaid_type not null default 'unknown',
  frequency_khz numeric,
  latitude_deg text,
  longitude_deg text,
  elevation_ft integer,
  iso_country citext,
  dme_frequency_khz numeric,
  dme_channel text,
  dme_latitude_deg text,
  dme_longitude_deg text,
  dme_elevation_ft integer,
  slaved_variation_deg numeric,
  magnetic_variation_deg numeric,
  usage_type airports.navaid_usage_type not null default 'unknown',
  power airports.navaid_power not null default 'unknown',
  associated_airport_ident citext,   -- upstream refs airport.ident (not id); often empty
  associated_airport_id uuid references airports.airport(id),  -- resolved at sync time; null if no match
  notes text,
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);
create unique index idx_uq_navaid_external_id on airports.navaid(external_id);
create index idx_navaid_associated_airport_id on airports.navaid(associated_airport_id);

-- Per-file sync bookkeeping: powers the status line AND conditional-GET skips (ETag)
create table airports.sync_source (
  file citext primary key,           -- 'airports.csv', 'runways.csv', …
  etag text,
  last_modified text,
  row_count integer not null default 0,
  synced_at timestamptz not null default current_timestamp
);
```

### RLS

```sql
-- every table incl. sync_source:
alter table airports.<table> enable row level security;
create policy view_all on airports.<table> for select using (true);
```

No write policies anywhere — the worker's root-of-trust client writes via `airports_fn` only.

### CSV field mapping (OurAirports → fnb)

`airports.csv` → `airports.airport` + its public `loc.location` row:

| CSV field | Destination |
|---|---|
| `id` | `airport.external_id` |
| `ident` | `airport.ident` |
| `type` | `airport.type` (coerced; raw → `notes` on `unknown`) |
| `name` | `airport.name` **and** `location.name` |
| `latitude_deg` / `longitude_deg` | `location.lat` / `location.lon` (text columns; **never empty** upstream — 0 of 85,716) |
| `elevation_ft` | `airport.elevation_ft` (int-or-null) |
| `continent` | `airport.continent` |
| `iso_country` | `airport.iso_country` **and** `location.country` (code, not name) |
| `iso_region` | `airport.iso_region` **and** `location.state` (code, not name — region names resolve via `airports.region` when display needs them) |
| `municipality` | `location.city` (5.5% empty) |
| `scheduled_service` | `airport.scheduled_service` (`'yes'` → true) |
| `icao_code`, `iata_code`, `gps_code`, `local_code`, `home_link`, `wikipedia_link`, `keywords` | same-named `airport` columns, empty string → null |

Location rows: `tenant_id = <anchor>`, `resident_id = null`, `is_public = true`,
`address1`/`address2`/`postal_code` null (airports have no street addresses upstream).

Other files map column-for-column to the tables above with these edges:
- `runways.csv` / `airport-frequencies.csv`: `airport_ref` (upstream airport id) resolves to
  `airport_id` via `airport.external_id`; the redundant `airport_ident` column is dropped;
  `lighted`/`closed` `'1'`/`'0'` → boolean; `le_heading_degT`/`he_heading_degT` →
  `le_heading_deg_t`/`he_heading_deg_t`.
- `navaids.csv`: `usageType` (the one camelCase upstream header) → `usage_type` (coerced
  case-insensitively); literal `UNKNOWN` power and empty strings both → `'unknown'`;
  `associated_airport` → `associated_airport_ident` + resolved `associated_airport_id`
  (null when no match — soft ref); `filename` column dropped (upstream site internal).
- `countries.csv` / `regions.csv`: direct; `keywords` kept as raw text.

---

## `airports_fn` / `_api` Functions

House pattern (R8): `_api` is `SECURITY INVOKER` + `jwt.*` gates, delegates to `_fn` which
takes explicit parameters and never calls `jwt.*`.

### Worker-only upserts (no `_api` wrappers — same trust model as `location_datasets_fn.upsert_breweries`)

One per file, each `(_rows jsonb) returns airports_fn.upsert_result` — called with chunks
(~1,000 rows) by the sync handler, keyed on `external_id`, update-in-place, **no delete pass**:

| Function | Notes |
|---|---|
| `airports_fn.upsert_countries(_rows jsonb)` | plain upsert |
| `airports_fn.upsert_regions(_rows jsonb)` | plain upsert |
| `airports_fn.upsert_airports(_rows jsonb)` | resolves the anchor tenant + ensures its `loc.loc_tenant` mirror row (once per call); per element: existing → update `airport` + its `loc.location`; new → insert location then airport. Coerces `type`/`continent` via `pg_enum` |
| `airports_fn.upsert_runways(_rows jsonb)` | resolves `airport_id` from `airport_ref`; **skips** (and counts) rows whose airport is missing |
| `airports_fn.upsert_airport_frequencies(_rows jsonb)` | same resolution/skip posture |
| `airports_fn.upsert_navaids(_rows jsonb)` | coerces `type`/`usage_type`/`power`; resolves `associated_airport_id` from ident, null on no-match (not a skip) |
| `airports_fn.record_sync_source(_file citext, _etag text, _last_modified text, _row_count int)` | upsert on `sync_source.file` |
| `airports_fn.airport_sync_status()` | see composite below |
| `airports_fn.coerce_enum_label(_enum_type regtype, _raw text)` | *(implementation addition)* the shared drift armor — returns the matching enum label (exact, then case-insensitive) or null; every upsert calls it and substitutes `'unknown'` + a `notes` entry on null. Factored out because airports has five enums vs breweries' one |

### Composite types (`airports_fn`)

```sql
create type airports_fn.upsert_result as (inserted int, updated int, skipped int);

create type airports_fn.airport_sync_status as (
  last_synced_at timestamptz,   -- max(sync_source.synced_at); null when never synced
  airport_count int,
  runway_count int,
  frequency_count int,
  navaid_count int,
  country_count int,
  region_count int,
  in_progress boolean           -- non-terminal sync-airports wf instance exists
);

create type airports_fn.search_airports_options as (
  search_text text,             -- matches name ilike OR ident/icao_code/iata_code/gps_code exact-insensitive
  airport_type airports.airport_type,
  continent airports.continent,
  iso_country citext,
  iso_region citext,
  scheduled_service boolean,    -- true = scheduled service only; null = all
  paging_options app_fn.paging_options
);

create type airports_fn.airport_map_point_options as (
  include_closed boolean        -- default false: map omits type='closed' (13,331 rows)
);

create type airports_fn.airport_map_point as (
  id uuid, ident citext, name citext, type airports.airport_type,
  iata_code citext, lat text, lon text
);
```

`in_progress` detection reuses the breweries-resolved vocabulary: an `is_template = false`
`wf.wf` row for identifier `sync-airports` whose root `type='wf'` uow status is in
(`incomplete`, `paused`, `waiting`, `trigger_set`).

### `airports_api.*` (PostGraphile surface, all `SECURITY INVOKER`)

| Function | Returns | Gate | Purpose |
|---|---|---|---|
| `search_airports(_options airports_fn.search_airports_options)` | `setof airports.airport` | `p:app-user` or `p:app-admin` (`jwt.enforce_any_permission`) | List query: search + filters + paging |
| `airport_map_points(_options airports_fn.airport_map_point_options)` | `setof airports_fn.airport_map_point` | same | Lightweight payload for the map GeoJSON source; **excludes `closed` unless `include_closed`** — 72k points is Mapbox-clusterable but keep fields minimal |
| `airport_sync_status()` | `airports_fn.airport_sync_status` | same | Status line + sync-button state |

Detail page reads the table directly via the PostGraphile `airport(id)` root field (RLS
`view_all` exposes it), joined to its `location`, plus the child relation list fields —
**verified in GraphiQL 2026-07-10**: `runwaysList`, `airportFrequenciesList`,
`navaidsByAssociatedAirportIdList` (PgSimplifyInflection drops the `ByAirportId` suffix on the
unambiguous FK relations, keeps `ByAssociatedAirportId`). Input types are
`SearchAirportsOptionInput` / `AirportMapPointOptionInput`, arg name `_options` (the breweries
inflections recurred exactly as expected).

---

## fnb-types (R3)

New in `packages/fnb-types` (enum values copy the PostGraphile GraphQL enum **verbatim,
UPPERCASE** — memory `fnbtypes-enum-values-match-graphql`; note PostGraphile renders
`'NDB-DME'` → `NDB_DME`, verify in GraphiQL):

```ts
export type AirportType =
  | 'UNKNOWN' // sync coerces unrecognized upstream values here; raw value lands in notes
  | 'BALLOONPORT' | 'CLOSED' | 'HELIPORT' | 'LARGE_AIRPORT' | 'MEDIUM_AIRPORT'
  | 'SEAPLANE_BASE' | 'SMALL_AIRPORT'

export type Continent = 'UNKNOWN' | 'AF' | 'AN' | 'AS' | 'EU' | 'NA' | 'OC' | 'SA'
export type NavaidType =
  | 'UNKNOWN' | 'NDB' | 'NDB_DME' | 'DME' | 'VOR' | 'VOR_DME' | 'VORTAC' | 'TACAN'
export type NavaidUsageType = 'UNKNOWN' | 'LO' | 'HI' | 'BOTH' | 'TERMINAL' | 'RNAV'
export type NavaidPower = 'UNKNOWN' | 'LOW' | 'MEDIUM' | 'HIGH'

export interface Airport {
  id: string
  externalId: number
  ident: string
  type: AirportType
  name: string
  elevationFt: number | null
  continent: Continent
  isoCountry: string
  isoRegion: string
  scheduledService: boolean
  icaoCode: string | null
  iataCode: string | null
  gpsCode: string | null
  localCode: string | null
  homeLink: string | null
  wikipediaLink: string | null
  keywords: string | null
  notes: string | null
  location: Location          // existing loc vocabulary type (name/city/state/country/lat/lon)
  createdAt: Date
  updatedAt: Date
}

// implementation correction: complete per-end fields included (fragments select every field —
// memory `fragments-all-fields`; the lean subset first drafted here violated that rule)
export interface Runway {
  id: string
  externalId: number
  lengthFt: number | null
  widthFt: number | null
  surface: string | null
  lighted: boolean
  closed: boolean
  leIdent: string | null
  leLatitudeDeg: string | null
  leLongitudeDeg: string | null
  leElevationFt: number | null
  leHeadingDegT: number | null
  leDisplacedThresholdFt: number | null
  heIdent: string | null
  heLatitudeDeg: string | null
  heLongitudeDeg: string | null
  heElevationFt: number | null
  heHeadingDegT: number | null
  heDisplacedThresholdFt: number | null
}

export interface AirportFrequency {
  id: string
  externalId: number
  type: string | null
  description: string | null
  frequencyMhz: number | null
}

// implementation correction: complete fields (same fragments-all-fields reasoning as Runway)
export interface Navaid {
  id: string
  externalId: number
  ident: string | null
  name: string
  type: NavaidType
  frequencyKhz: number | null
  latitudeDeg: string | null
  longitudeDeg: string | null
  elevationFt: number | null
  isoCountry: string | null
  dmeFrequencyKhz: number | null
  dmeChannel: string | null
  dmeLatitudeDeg: string | null
  dmeLongitudeDeg: string | null
  dmeElevationFt: number | null
  slavedVariationDeg: number | null
  magneticVariationDeg: number | null
  usageType: NavaidUsageType
  power: NavaidPower
  associatedAirportIdent: string | null
}

export interface AirportMapPoint {
  id: string
  ident: string
  name: string
  type: AirportType
  iataCode: string | null
  lat: number
  lon: number
}

export interface AirportSyncStatus {
  lastSyncedAt: Date | null
  airportCount: number
  runwayCount: number
  frequencyCount: number
  navaidCount: number
  countryCount: number
  regionCount: number
  inProgress: boolean
}
```

`Country` / `Region` get no fnb-types entries for now — they are import-side lookups with no
page; add types when a UI consumes them.

---

## GraphQL Client Setup

Same stack as breweries (see `.claude/specs/tenant-app/datasets/breweries/_shared.data.md`):

- **urql plugin**: `apps/tenant-app/app/plugins/urql.ts` (already present — no change)
- **PostGraphile schemas**: add `airports` + `airports_api` to `graphile.config.ts` `schemas`
  (mirror how `location_datasets`/`location_datasets_api` are listed)
- **Fragments**: `packages/graphql-client-api/src/graphql/airports/fragment/` —
  `Airport.graphql` (all airport fields + nested location fields — expand fully, memory
  `fragments-all-fields`), `Runway.graphql`, `AirportFrequency.graphql`, `Navaid.graphql`,
  `AirportMapPoint.graphql`
- **Operations**: `src/graphql/airports/query/` — `searchAirports`, `airport` (detail incl.
  child relations), `airportMapPoints`, `airportSyncStatus`. No new mutation — sync reuses the
  existing wf `queueWorkflow` operation.
- **Mappers**: `src/mappers/airport.ts` (`toAirport`, `toRunway`, `toAirportFrequency`,
  `toNavaid`, `toAirportMapPoint`, `toAirportSyncStatus`)
- **Composables** (`src/composables/`): `useAirports.ts` (search + sync status + `queueSync`),
  `useAirport.ts` (detail), `useAirportMapPoints.ts`
- **Re-exports**: `apps/tenant-app/app/composables/useAirports.ts`, `useAirport.ts`,
  `useAirportMapPoints.ts` + `packages/graphql-client-api/src/index.ts`
- **routeRules**: `'/datasets/**': { ssr: false }` already covers the new pages (breweries)

## Map Infrastructure

Already in place — no new env vars, no new deps in tenant-app: `mapbox-gl` + `nuxt-mapbox`,
`MAPBOX_ACCESS_TOKEN`. OurAirports needs **no key** (public-domain CSVs); the worker container
needs outbound HTTPS to `davidmegginson.github.io` (it already has outbound HTTPS).

**New worker-app dep**: a real CSV parser (`csv-parse` — RFC-4180, streaming) declared
directly in `apps/worker-app/package.json` (memory `pnpm-no-hoist-app-deps`; the rebuild the
DB changes already require covers the install cycle).

---

## Open Questions

Both resolved 2026-07-10:

- [x] 1. **Map payload scale** — shipped as specced (~72k rows, `include_closed` false by
      default, query paused until the map first opens) and UI-verified working. The recorded
      fallback (server-side type filtering: large/medium/scheduled-only default) stays on file
      but no live evidence calls for it.
- [x] 2. **Inflected relation/input names** — verified in GraphiQL before the `.graphql`
      documents were written; all names matched (see the §`airports_api` note above:
      `runwaysList` / `airportFrequenciesList` / `navaidsByAssociatedAirportIdList`,
      `_options`, `NDB_DME`).
