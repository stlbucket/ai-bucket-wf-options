---
name: tenant-app-datasets-airports-id-ui
description: Airport detail page UI — read-only field card, type badge, codes/links blocks, runways + frequencies + navaids child tables, and a single-marker mini map.
metadata:
  type: reference
---

# /tenant/datasets/airports/[id] — Detail Page (UI)

Data contract: `[id].data.md`. Shared model: `_shared.data.md`. Breweries precedent:
`.claude/specs/tenant-app/datasets/breweries/[id].ui.md`.

## Status
Implemented — GraphQL (2026-07-10). Built as specced; UI-verified by the user (EGLL exercises
all three child tables).

---

## Layout

Page file: `apps/tenant-app/app/pages/datasets/airports/[id].vue`

Read-only — no edit/delete affordances anywhere (dataset is sync-managed). Richer than the
brewery detail because airports have child data: runways, frequencies, associated navaids.

```
UCard (UC4)
├── header: flex justify-between flex-wrap
│   ├── left: back UButton (ghost, i-lucide-arrow-left → /tenant/datasets/airports)
│   │         + airport name (title) + ident (monospace, muted) + type UBadge
│   │         + "Scheduled service" UBadge (success) when scheduledService
│   └── right: website UButton (i-lucide-external-link, target=_blank, only if homeLink)
│              + Wikipedia UButton (ghost, only if wikipediaLink)
├── body:
│   ├── two-column grid (md:grid-cols-2, stacks on mobile — UC5)
│   │   ├── Location block: municipality (location.city) / region code + country code /
│   │   │   continent / elevation ("<N> ft MSL", skip when null) / lat, lon (from location)
│   │   ├── Codes block: ICAO · IATA · GPS · local (each "—" when null; monospace)
│   │   └── Meta block (muted, small): external id (OurAirports integer) · keywords (when
│   │       present) · last updated · notes when present (e.g. raw upstream type on
│   │       'unknown'-coerced rows)
│   ├── Runways section (only when any): heading "Runways (N)" +
│   │   UTable in overflow-x-auto — columns: Ident pair ("09L/27R" from leIdent/heIdent),
│   │   Length ft, Width ft, Surface (raw text), Lighted (check icon), Closed (error badge
│   │   when true)
│   ├── Frequencies section (only when any): heading "Frequencies (N)" +
│   │   UTable — columns: Type (raw text), Description, MHz
│   └── Navaids section (only when any): heading "Navaids (N)" +
│       UTable — columns: Ident, Name, Type badge (neutral), kHz, Usage, Power
└── footer: MapboxMap mini map — single default marker at [lon, lat], zoom ~11 (airports are
    bigger than breweries — a touch wider than the brewery zoom 13), streets-v12, h-64,
    non-interactive scroll (cooperative gestures / scrollZoom off) — same setup as loc/[id].vue
```

- Airports are always geocoded — the mini map renders unconditionally (unlike brewery).
- Loading: skeleton or centered spinner in the card body while `fetching`.
- Not found / error: `UAlert` (persistent — UC7) with a back link.

## Interactions

| Action | Result |
|---|---|
| Back button | `navigateTo('/tenant/datasets/airports')` |
| Website / Wikipedia button | Opens link in a new tab |

Nothing else — no mutations on this page. Child tables are plain reads (no row navigation;
runways/frequencies/navaids have no detail pages).
