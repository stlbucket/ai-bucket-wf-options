---
name: tenant-app-datasets-breweries-index-ui
description: Breweries landing page UI — list/map view toggle, clustered Mapbox map defaulting to the US, filters, and the site-admin sync control.
metadata:
  type: reference
---

# /tenant/datasets/breweries — List/Map Page (UI)

Data contract: `index.data.md`. Shared model: `_shared.data.md`.

## Status
Implemented — GraphQL (2026-07-09).

---

## Layout

Page file: `apps/tenant-app/app/pages/datasets/breweries/index.vue`

```
UCard (UC4)
├── header: flex justify-between flex-wrap (UC5)
│   ├── title "Breweries" + subtitle line: sync status
│   │     "Last synced <relative time> · <N> breweries"
│   │     (empty state: "No data yet — run a sync to load the dataset")
│   └── controls (flex gap-2 flex-wrap)
│       ├── view toggle — UTabs or UButtonGroup: [List] [Map]   (default: List)
│       └── USync button (site-admin only, see below)
├── filter row (both views): UInput search (name) · USelectMenu type ·
│   UInput state · UInput country · USwitch "Geocoded only" (is_geolocated) ·
│   clear-filters UButton (ghost)
└── body: BreweryListView | BreweryMapView  (v-if on view state)
```

### View toggle
- `ref<'list' | 'map'>('list')` — **default list** (user decision). Persist nothing; a page
  visit always starts on list.
- Filters apply to the list view; the map always shows the full geocoded dataset (user
  decision: "map shows all breweries within map settings").

### Sync control (site-admin only)
- Visible only when claims include `p:app-admin-super` (via `useAuth()` permissions).
- `UButton` label "Sync breweries", icon `i-lucide-refresh-cw`.
- Disabled + `loading` while `syncStatus.inProgress` is true; while in progress the status line
  reads "Sync in progress…".
- Click → `queueSync()` → success toast (UC7: `useToast`) "Brewery sync queued"; error → error
  toast. After queueing, re-poll sync status (see `index.data.md`).

## Components

### `BreweryListView` (`apps/tenant-app/app/components/datasets/BreweryListView.vue`)
- Props: `breweries: Brewery[]`, `fetching: boolean`; emits nothing (row navigation only).
- `UTable` inside `overflow-x-auto` (UC5). Columns: Name (link to
  `/tenant/datasets/breweries/[id]`), Type (`UBadge`, colors below), City, State, Country,
  Website (external-link icon `i-lucide-external-link`, `target="_blank"`, only when present).
- Server-side pagination: `UPagination` bound to paging offset/limit (page size 25).
- Empty state: `UAlert`? No — plain empty-table slot text; the header's empty-state subtitle
  already explains (UC7: UAlert only for persistent warnings).

### `BreweryMapView` (`apps/tenant-app/app/components/datasets/BreweryMapView.vue`)
- Props: `points: BreweryMapPoint[]`, `ungeocodedCount: number`, `fetching: boolean`.
- `MapboxMap` (nuxt-mapbox, precedent `loc/[id].vue`), style `mapbox://styles/mapbox/streets-v12`,
  full-width, ~`h-[70vh]`.
- **Default viewport = continental US**: center `[-98.5795, 39.8283]`, zoom `3.5` (user
  decision: "map settings should default to the US"). Users can pan/zoom freely — the data
  source always contains the whole world's points.
- **Clustered rendering** (user decision): one GeoJSON source built from `points`
  (`cluster: true`, `clusterMaxZoom: 14`, `clusterRadius: 50`) + three layers — cluster
  circles (step-sized by `point_count`), cluster count labels, and unclustered points.
  Cluster click → `getClusterExpansionZoom` → ease to it. Unclustered point click → Mapbox
  popup: brewery name (link to detail page) + type badge text.
- Colors: use the Nuxt UI primary token value for circles (UC6 — do not hardcode a random hex).
  **Implementation correction:** the token resolves to `oklch(...)`, which Mapbox GL rejects
  (layers fail silently → no pins); resolve to `rgb()` via a probe element — see UC6 in
  `ui-components-rules.md` for the pattern.
- Footer note (small muted text, not an alert): "N breweries have no coordinates and are not
  shown" when `ungeocodedCount > 0`.

## Type badge colors (both views + detail)

| `breweryType` | UBadge color |
|---|---|
| `MICRO` | `primary` |
| `BREWPUB`, `TAPROOM`, `BEERGARDEN` | `success` |
| `REGIONAL`, `LARGE` | `secondary` |
| `NANO`, `CIDERY` | `info` |
| `PLANNING` | `warning` |
| `CLOSED` | `error` |
| `CONTRACT`, `PROPRIETOR`, `BAR`, `LOCATION` | `neutral` |
| `UNKNOWN` | `warning` (coerced upstream drift — visible on purpose; raw value in `notes`) |

## Interactions

| Action | Result |
|---|---|
| Toggle List/Map | Swaps the body component; filters row stays visible but only affects List |
| Type search/filter inputs | Debounced (~300ms) re-query of `searchBreweries` (list only) |
| Click table row / popup name | `navigateTo('/tenant/datasets/breweries/' + id)` |
| Click "Sync breweries" (site-admin) | Queues workflow, toast, button enters in-progress state |
| Map cluster click | Zoom-expand cluster |
| Map point click | Popup with name link + type |

## Responsive (UC5)
Header wraps; filter row `flex-wrap`; table scrolls horizontally; map takes full card width.
