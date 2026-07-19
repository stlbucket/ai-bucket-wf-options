---
name: airports-expert
description: Expert in the OurAirports open dataset (https://ourairports.com) — a public-domain, nightly-updated dataset of ~85,700 airports worldwide plus runways, radio frequencies, navaids, countries, and regions. There is NO API — the data ships as seven bulk CSV files on GitHub Pages (davidmegginson/ourairports-data). Use this skill whenever fetching, parsing, importing, or modeling OurAirports data — file URLs, the real column lists, live enum vocabularies (which diverge from the data dictionary), nullability in practice, and CSV parsing gotchas. Triggers include: "OurAirports", "airports dataset", "airports.csv", "runways/frequencies/navaids data", or building any feature backed by airport data. Prefer this skill over memory and over the site's data dictionary — the dictionary lags the live data.
---

# OurAirports Dataset Expert

OurAirports is a volunteer-maintained, **public-domain** dataset of world airports.
**There is no query API.** The site exports the entire database nightly as seven CSV files
served from GitHub Pages — the access pattern is *download the whole file and process it
locally*, not paginated requests.

**Data base URL:** `https://davidmegginson.github.io/ourairports-data/<file>.csv`
**Docs (data dictionary):** https://ourairports.com/help/data-dictionary.html
**Downloads page (terms, HXL/RSS variants):** https://ourairports.com/data/
**License:** Public domain ("comes with no guarantee of accuracy or fitness for use").
**Update cadence:** nightly ("we update every night").

---

## Access

- **No auth, no API key, no rate limits** — plain HTTPS GETs against GitHub Pages.
- Politeness: files total ~24 MB; one GET per file per sync is the whole load. Never poll
  more than daily — the data only changes nightly.
- **Conditional GET supported** (verified live): responses carry `Last-Modified` and `ETag`
  (`cache-control: max-age=600`). Send `If-None-Match`/`If-Modified-Since` to skip unchanged
  files on re-sync. Note the ETags are **weak** (`W/"…"`) — that's fine: use the header value
  verbatim as `If-None-Match` (weak comparison applies); don't strip the `W/` prefix.
- Encoding is UTF-8 throughout; RFC-4180 quoting (fields may contain commas/newlines —
  use a real CSV parser, never `split(',')`).

## The seven files (live row counts, 2026-07-09)

| File | Rows | Primary key | Notes |
|------|-----:|-------------|-------|
| `airports.csv` | 85,716 | `id` (int, persistent) | The main table; `ident` also unique |
| `runways.csv` | 48,096 | `id` | FK `airport_ref` → airports.id (0 orphans live) |
| `airport-frequencies.csv` | 30,312 | `id` | FK `airport_ref` → airports.id (0 orphans live) |
| `navaids.csv` | 11,009 | `id` | Optional `associated_airport` → airports.ident |
| `countries.csv` | 249 | `id`; `code` unique | ISO-3166-1 alpha-2 + unofficial codes (`XK` Kosovo) |
| `regions.csv` | 3,984 | `id`; `code` unique | ISO-3166-2-ish; airports FK via `iso_region` |
| `airport-comments.csv` | 16,315 | `id` | User comments — **skip for import** (free text, quirky header) |

Referential integrity is clean in practice, but treat FKs as *soft* — import parents before
children and tolerate misses.

> **Confirmed by a full import (fnb, 2026-07-10):** all six files loaded with exactly the
> row counts above; 0 orphaned runways/frequencies; 0 unrecognized airport `type` values
> (the vocabulary above is complete as of that date); 31 navaid enum coercions — all from the
> empty `usageType`/`power` cells noted below, no novel values. 7,374 of 11,009 navaids have a
> resolvable `associated_airport` ident.

## airports.csv — the main table

Columns (live header, in order):
`id, ident, type, name, latitude_deg, longitude_deg, elevation_ft, continent, iso_country,
iso_region, municipality, scheduled_service, icao_code, iata_code, gps_code, local_code,
home_link, wikipedia_link, keywords`

- `id` — internal integer PK, persistent across code changes.
- `ident` — the URL/interop key: ICAO code when available, else a local code, else a generated
  `<ISO2>-<4 digits>` code. Unique (verified live).
- `latitude_deg` / `longitude_deg` — decimal degrees, **never empty** in live data (0 of
  85,716). `elevation_ft` is empty for 17.4% of rows.
- `scheduled_service` — literal `yes` / `no` strings → boolean.
- `keywords` — comma-separated free text inside one quoted field (search fodder, not a list
  to normalize).

### `type` — the docs lie

The data dictionary lists `closed_airport`; **the live value is `closed`**. Live vocabulary
with counts (2026-07-09):

| Value | Count |
|-------|------:|
| `small_airport` | 42,668 |
| `heliport` | 23,106 |
| `closed` | 13,331 |
| `medium_airport` | 4,101 |
| `seaplane_base` | 1,274 |
| `large_airport` | 1,175 |
| `balloonport` | 61 |

Treat as an **open** enum — coerce unknown values to a sentinel and record the raw string.

### Nullability in practice (% empty of 85,716)

`icao_code` 88% · `iata_code` 89.4% · `gps_code` 48.3% · `local_code` 58% ·
`home_link` 94.5% · `wikipedia_link` 80.5% · `keywords` 74.9% · `municipality` 5.5% ·
`elevation_ft` 17.4%. Everything except `id`, `ident`, `type`, `name`, lat/lon, `continent`,
`iso_country`, `iso_region` should be nullable.

`continent` closed set: `AF AN AS EU NA OC SA` (all present live; NA is 46%).

## runways.csv

Columns: `id, airport_ref, airport_ident, length_ft, width_ft, surface, lighted, closed,
le_ident, le_latitude_deg, le_longitude_deg, le_elevation_ft, le_heading_degT,
le_displaced_threshold_ft, he_*` (same five for the higher-numbered end).

- `lighted` / `closed` — `0`/`1` strings → boolean.
- **`surface` is NOT an enum**: 664 distinct free-text values live (`ASP`, `TURF`, `CON`,
  `CONC`, `Turf`, `Grass`, `grass`, …). Model as text; don't try to normalize.
- The per-end (`le_`/`he_`) geo columns are mostly empty (~65–70%);
  `*_displaced_threshold_ft` ~94% empty. `airport_ident` duplicates the airport's `ident` —
  join on `airport_ref` instead.

## airport-frequencies.csv

Columns: `id, airport_ref, airport_ident, type, description, frequency_mhz`.
**`type` is NOT an enum** — 549 distinct values live (`TWR`, `CTAF`, `UNIC`, `MISC`, `APP`,
`A/D`, `GND`, `ATIS`, …). Model as text. `frequency_mhz` is a stringly decimal.

## navaids.csv

Columns: `id, filename, ident, name, type, frequency_khz, latitude_deg, longitude_deg,
elevation_ft, iso_country, dme_frequency_khz, dme_channel, dme_latitude_deg,
dme_longitude_deg, dme_elevation_ft, slaved_variation_deg, magnetic_variation_deg,
usageType, power, associated_airport`.

- `type` live vocab (closed-ish, still treat open): `NDB` 6,610 · `VOR-DME` 2,601 ·
  `VORTAC` 744 · `TACAN` 442 · `VOR` 308 · `DME` 167 · `NDB-DME` 137.
- `usageType` (note the **camelCase header** — the one inconsistent column name in the
  dataset): `BOTH`, `LO`, `HI`, `TERMINAL`, `RNAV`, plus 27 empty.
- `power`: `LOW`/`MEDIUM`/`HIGH`/`UNKNOWN`, plus 27 empty — the dataset itself already uses
  an `UNKNOWN` sentinel here.
- `associated_airport` references airports **`ident`** (not `id`), and is often empty.

## countries.csv / regions.csv

- countries: `id, code, name, continent, wikipedia_link, keywords` — 249 rows.
- regions: `id, code, local_code, name, continent, iso_country, wikipedia_link, keywords` —
  `code` is `<ISO2>-<subdivision>` (e.g. `GB-ENG`, custom codes like `US-U-A` exist);
  airports' `iso_region` points here.

## airport-comments.csv — avoid

Header is malformed relative to the others: `id,  "threadRef",  "airportRef", …` —
space-padded, quoted, camelCase. Parseable, but it's user-generated comment text with no
modeling value for an import.

## Parsing gotchas (all hit or verified during recon)

1. Every numeric column arrives as a string and may be empty — coerce at the edge,
   store nullable.
2. Fields contain commas and quotes (`keywords`, `name`, `description`) — real CSV parser
   mandatory.
3. Header names are snake_case except `usageType` and the `*_degT` suffix in runways.
4. The data dictionary is *directionally* right but lags reality (`closed_airport` vs
   `closed`; "allowed values" lists for surface/frequency-type that are actually free text).
   Trust a live scan over the dictionary.
5. `x-cache`/proxy headers show GitHub Pages + Fastly — transient 5xx are possible;
   a retry is safe (GETs are idempotent).

## Recipes

```bash
# Grab the main file
curl -sSL -o airports.csv https://davidmegginson.github.io/ourairports-data/airports.csv

# Re-sync politely: only download if changed since last time
curl -sSL -H 'If-None-Match: "<etag-from-last-sync>"' -o airports.csv -w '%{http_code}' \
  https://davidmegginson.github.io/ourairports-data/airports.csv   # 304 → skip

# Live enum scan before trusting any documented vocabulary (python)
python3 -c "import csv,collections;print(collections.Counter(r['type'] for r in csv.DictReader(open('airports.csv'))))"
```

## Operational notes

- Full import = stream-parse each CSV and upsert by `id`; there is no incremental feed, so
  re-sync is a full re-walk (idempotent upserts). ETag check makes the no-op case free.
- Row counts drift nightly; verify a sync against the freshly-downloaded file's own row
  count, not against numbers recorded here.
- For the layers above the fetch (composables, pages) → skill `fnb-stack-implementor`.
