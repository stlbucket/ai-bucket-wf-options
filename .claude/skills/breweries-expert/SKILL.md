---
name: breweries-expert
description: Expert in the Open Brewery DB API (https://api.openbrewerydb.org/v1) — a free, no-auth public dataset of ~11,700 breweries, cideries, brewpubs, and bottleshops worldwide. Use this skill whenever the user is fetching, filtering, searching, or paginating brewery data — including the list/single/random/search/meta endpoints, filters (by_city, by_state, by_country, by_type, by_postal, by_name, by_ids, by_dist), sort syntax, brewery types, and the response schema. Triggers include: "breweries API", "Open Brewery DB", "find breweries near X", "brewery search/autocomplete", or building any feature backed by brewery data. Prefer this skill over memory — the filter names, sort syntax, and response quirks are easy to get wrong.
---

# Open Brewery DB Expert

Open Brewery DB is a free, open-source dataset and API of breweries, cideries, brewpubs, and
bottleshops. **No authentication, no API key** — plain HTTPS GETs returning JSON.

**Base URL:** `https://api.openbrewerydb.org/v1`
**Docs:** https://www.openbrewerydb.org/documentation
**Dataset size:** ~11,700 breweries (live count from `/breweries/meta` → `total`)

---

## Endpoints

| Endpoint | Returns |
|----------|---------|
| `GET /breweries` | Array of breweries (filterable, sortable, paginated) |
| `GET /breweries/{id}` | Single brewery object by its UUID id |
| `GET /breweries/random` | **Array** of random breweries (array even at default `size=1`) |
| `GET /breweries/search?query={q}` | Array — partial, case-insensitive match on brewery name |
| `GET /breweries/meta` | Aggregate counts (accepts the same filters as `/breweries`) |
| `GET /breweries/autocomplete?query={q}` | **Deprecated** — HTTP redirects to `/breweries/search` (verified live); use search directly |

`/search` returns `[]` (not an error) when nothing matches.

## Query parameters (`/breweries` and `/breweries/meta`)

| Param | Meaning | Notes |
|-------|---------|-------|
| `by_city` | Filter by city | Encode spaces as underscores or `%20` (e.g. `san_diego`) |
| `by_state` | Filter by **full** state/province name | No abbreviations — `ohio` works, `OH` does not |
| `by_country` | Filter by country | Dataset is international (US, Germany, NZ, South Korea, …) |
| `by_name` | Filter by name (partial match) | Spaces as underscores |
| `by_type` | Filter by brewery type | See type table below |
| `by_postal` | 5-digit or postal+4 | postal+4 needs hyphen or underscore: `44107-4020` / `44107_4020` |
| `by_ids` | Comma-separated brewery UUIDs | |
| `by_dist` | Sort by distance from `latitude,longitude` | e.g. `by_dist=38.6270,-90.1994` — **cannot combine with `sort`** |
| `sort` | `field:asc` / `field:desc`, comma-separated for multiple | e.g. `sort=type,name:desc` (verified: colon syntax) |
| `page` | Page number, default 1 | |
| `per_page` | Default 50, **max 200** | |

`/breweries/random` takes only `size` (default 1, max 50).

## Brewery types (`by_type` / `brewery_type` values)

| Type | Meaning |
|------|---------|
| `micro` | Most craft breweries |
| `nano` | Very small, local-only distribution |
| `regional` | Regional location of an expanded brewery |
| `brewpub` | Beer-focused restaurant brewing on premises |
| `contract` | Brews on another brewery's equipment |
| `proprietor` | Brewery-incubator tenant |
| `planning` | In planning, not yet open |
| `closed` | Permanently closed |
| `large` | Very large brewery — **deprecated** but still present in data |
| `bar` | Bar without brewing equipment — **deprecated** |

**Undocumented values present in live data** (from `/breweries/meta` `by_type`, 2026-07-09 —
the documentation page above does NOT list these):

| Type | Live count | Meaning |
|------|-----------:|---------|
| `taproom` | 47 | Taproom pouring its own beer, no on-site restaurant |
| `cidery` | 7 | Cider producer |
| `beergarden` | 3 | Beer garden |
| `location` | 1 | Data quirk — a single stray record |

> The type vocabulary is **not closed** and the docs lag the data. Before mapping
> `brewery_type` into an enum, fetch `/breweries/meta` and read the live `by_type` keys;
> expect new values to appear over time.

## Response schema

Every brewery object (verified live):

```json
{
  "id": "5be46e78-dd4c-44c7-9164-6aa1f502af37",
  "name": "Yellow Springs Brewery",
  "brewery_type": "micro",
  "address_1": "305 N Walnut St Ste B",
  "address_2": null,
  "address_3": null,
  "city": "Yellow Springs",
  "state_province": "Ohio",
  "postal_code": "45387-2059",
  "country": "United States",
  "longitude": null,
  "latitude": null,
  "phone": "9377670222",
  "website_url": "http://www.yellowspringsbrewery.com",
  "state": "Ohio",
  "street": "305 N Walnut St Ste B"
}
```

Gotchas:

- `state` and `street` are **deprecated duplicates** of `state_province` and `address_1` —
  don't model them; some responses omit them entirely.
- `longitude`/`latitude` are numbers **or `null`** (many records are ungeocoded) and may be
  absent from list responses — always null-check before mapping/`by_dist` math.
- `phone`, `website_url`, `address_1..3` are all nullable.
- `id` is a UUID string.

`/breweries/meta` shape (with or without filters):

```json
{ "total": 303, "by_state": {"Ohio": 303}, "by_country": {"United States": 303},
  "by_type": {"micro": 163, "brewpub": 94, "...": 0}, "page": 1, "per_page": 50 }
```

Use filtered `meta.total` to size pagination before walking pages.

## Recipes

```bash
# Micro breweries in San Diego, alphabetical
curl 'https://api.openbrewerydb.org/v1/breweries?by_city=san_diego&by_type=micro&sort=name:asc'

# Nearest breweries to a point (distance-ordered; do NOT add sort=)
curl 'https://api.openbrewerydb.org/v1/breweries?by_dist=38.6270,-90.1994&per_page=10'

# Name search (also the autocomplete replacement)
curl 'https://api.openbrewerydb.org/v1/breweries/search?query=dogfish'

# Fetch a known set by id
curl 'https://api.openbrewerydb.org/v1/breweries?by_ids=<uuid1>,<uuid2>'

# How many pages will a filter need?
curl 'https://api.openbrewerydb.org/v1/breweries/meta?by_state=ohio'   # → total / per_page
```

Full-dataset walk: loop `page=1..ceil(total/200)` with `per_page=200`; stop on an empty array.

## Operational notes

- No documented rate limits or SLA — it's a volunteer-run open project, so cache responses and
  keep request volume polite; don't hammer it from client-side loops.
- Read-only API; the underlying dataset lives at https://github.com/openbrewerydb/openbrewerydb
  (CSV/JSON) if a bulk import beats live API calls.
- For the layers above the fetch (composables, pages) → skill `fnb-stack-implementor`.
