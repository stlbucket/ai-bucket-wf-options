---
name: tenant-app-datasets-airports-index-ui
description: Airports landing page UI — list/map view toggle, clustered Mapbox map defaulting to the US, search/filter row, and the site-admin sync control.
metadata:
  type: reference
---

# /tenant/datasets/airports — List/Map Page (UI)

Data contract: `index.data.md`. Shared model: `_shared.data.md`. Breweries precedent:
`.claude/specs/tenant-app/datasets/breweries/index.ui.md`.

## Status
Implemented — GraphQL (2026-07-10). Built as specced; UI-verified by the user. The
"Include closed on map" switch renders only while the map view is active (`v-if` on the view
state) — it's the map's only filter, so showing it on the list view would mislead.

---

## Layout

Page file: `apps/tenant-app/app/pages/datasets/airports/index.vue`

```
UCard (UC4)
├── header: flex justify-between flex-wrap (UC5)
│   ├── title "Airports" + subtitle line: sync status
│   │     "Last synced <relative time> · <N> airports"
│   │     (empty state: "No data yet — run a sync to load the dataset")
│   └── controls (flex gap-2 flex-wrap)
│       ├── view toggle — same component choice as breweries: [List] [Map]  (default: List)
│       └── sync button (site-admin only, see below)
├── filter row (both views visible; list-scoped except where noted): UInput search
│   (name / ident / IATA / ICAO) · USelectMenu type · UInput country (ISO2) ·
│   UInput region code · USwitch "Scheduled service only" ·
│   USwitch "Include closed on map" (map-scoped — re-queries map points) ·
│   clear-filters UButton (ghost)
└── body: AirportListView | AirportMapView  (v-if on view state)
```

### View toggle
- `ref<'list' | 'map'>('list')` — default list, nothing persisted (breweries pattern).
- Filters apply to the list; the map always shows the full geocoded dataset **minus `closed`
  airports by default** — the "Include closed on map" switch is the map's only filter (payload
  rationale in `_shared.data.md` Open Question 1).

### Sync control (site-admin only)
- Visible only when claims include `p:app-admin-super` (via `useAuth()` permissions).
- `UButton` label "Sync airports", icon `i-lucide-refresh-cw`.
- Disabled + `loading` while `syncStatus.inProgress`; status line reads "Sync in progress…".
- Click → `queueSync()` → success toast (UC7) "Airport sync queued"; error → error toast.
  Re-poll sync status after queueing (see `index.data.md`).

## Components

### `AirportListView` (`apps/tenant-app/app/components/datasets/AirportListView.vue`)
- Props: `airports: Airport[]`, `fetching: boolean`; emits nothing (row navigation only).
- `UTable` inside `overflow-x-auto` (UC5). Columns: Ident (link to
  `/tenant/datasets/airports/[id]`, monospace), Name (link), Type (`UBadge`, colors below),
  IATA, Municipality (`location.city`), Region (`isoRegion`), Country (`isoCountry`),
  Scheduled (`UBadge` "Scheduled" success, only when true — no badge otherwise).
- Server-side pagination: `UPagination` bound to paging offset/limit (page size 25) — with
  85,716 rows this is non-negotiable.
- Empty state: plain empty-table slot text; the header's empty-state subtitle already explains.

### `AirportMapView` (`apps/tenant-app/app/components/datasets/AirportMapView.vue`)
- Props: `points: AirportMapPoint[]`, `fetching: boolean`.
- `MapboxMap` (nuxt-mapbox, precedent `loc/[id].vue` + `BreweryMapView`), style
  `mapbox://styles/mapbox/streets-v12`, full-width, ~`h-[70vh]`.
- **Default viewport = continental US**: center `[-98.5795, 39.8283]`, zoom `3.5`.
- **Clustered rendering**: one GeoJSON source from `points` (`cluster: true`,
  `clusterMaxZoom: 14`, `clusterRadius: 50`) + cluster circles / count labels / unclustered
  points — ~72k points is well within supercluster's comfort zone. Cluster click →
  `getClusterExpansionZoom` → ease. Point click → popup: airport name (link to detail) +
  `ident` + type badge text.
- Colors: Nuxt UI primary token (UC6) — **resolve `oklch(...)` to `rgb()` via the probe
  element** (breweries correction; Mapbox rejects oklch silently → invisible pins).
- No ungeocoded footnote — airports are 100% geocoded upstream (recon-verified).

## Type badge colors (both views + detail)

| `type` | UBadge color |
|---|---|
| `LARGE_AIRPORT` | `primary` |
| `MEDIUM_AIRPORT` | `secondary` |
| `SMALL_AIRPORT` | `success` |
| `HELIPORT` | `info` |
| `SEAPLANE_BASE` | `info` |
| `BALLOONPORT` | `neutral` |
| `CLOSED` | `error` |
| `UNKNOWN` | `warning` (coerced upstream drift — visible on purpose; raw value in `notes`) |

Badge label: humanize the value (`LARGE_AIRPORT` → "Large airport").

## Interactions

| Action | Result |
|---|---|
| Toggle List/Map | Swaps the body component; filter row stays visible (list-scoped except the map's closed switch) |
| Search/filter inputs | Debounced (~300ms) re-query of `searchAirports` (list only) |
| "Include closed on map" switch | Re-queries `airportMapPoints` with `includeClosed` |
| Click ident/name / popup name | `navigateTo('/tenant/datasets/airports/' + id)` |
| Click "Sync airports" (site-admin) | Queues workflow, toast, button enters in-progress state |
| Map cluster click | Zoom-expand cluster |
| Map point click | Popup with name link + ident + type |

## Responsive (UC5)
Header wraps; filter row `flex-wrap`; table scrolls horizontally; map takes full card width.

## Icons (UC11 — verify before use)
`i-lucide-plane` (nav tool), `i-lucide-refresh-cw`, `i-lucide-external-link`,
`i-lucide-arrow-left` — all already verified by breweries except `i-lucide-plane` (exists in
lucide; re-check at build). tenant-app already declares `@iconify-json/lucide` (memory
`iconify-collection-per-app`).
