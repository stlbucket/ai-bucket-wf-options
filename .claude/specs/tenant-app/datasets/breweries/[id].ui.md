---
name: tenant-app-datasets-breweries-id-ui
description: Brewery detail page UI — read-only field card, type badge, website/phone links, and a single-marker mini map when geocoded.
metadata:
  type: reference
---

# /tenant/datasets/breweries/[id] — Detail Page (UI)

Data contract: `[id].data.md`. Shared model: `_shared.data.md`.

## Status
Implemented — GraphQL (2026-07-09).

---

## Layout

Page file: `apps/tenant-app/app/pages/datasets/breweries/[id].vue`

Read-only — there are no edit/delete affordances anywhere (dataset is sync-managed).

```
UCard (UC4)
├── header: flex justify-between flex-wrap
│   ├── left: back UButton (ghost, i-lucide-arrow-left → /tenant/datasets/breweries)
│   │         + brewery name (title) + type UBadge (color map in index.ui.md)
│   └── right: website UButton (i-lucide-external-link, target=_blank, only if websiteUrl)
├── body: two-column grid (md:grid-cols-2, stacks on mobile — UC5)
│   ├── Address block: address1 / address2 / city, state postal_code / country
│   │   (skip null lines; loc/[id].vue formatting precedent)
│   ├── Contact block: phone (tel: link, formatted as-is) · website (plain link, duplicate of
│   │   header button is fine on mobile where the header wraps)
│   └── Meta block (muted, small): external id (Open Brewery DB UUID) · last updated ·
│       notes when present (e.g. the raw upstream type on 'unknown'-coerced rows)
└── footer (only when lat/lon present): MapboxMap mini map — single default marker at
    [lon, lat], zoom ~13, streets-v12 style, h-64, non-interactive scroll (cooperative gestures
    or scrollZoom disabled so the page still scrolls) — same setup as loc/[id].vue
```

- No map when ungeocoded — omit the section entirely (no placeholder alert).
- Loading: skeleton or centered spinner in the card body while `fetching`.
- Not found / error: `UAlert` (persistent — UC7) with a back link.

## Interactions

| Action | Result |
|---|---|
| Back button | `navigateTo('/tenant/datasets/breweries')` |
| Website button/link | Opens `websiteUrl` in a new tab |
| Phone link | `tel:` href |

Nothing else — no mutations on this page.
