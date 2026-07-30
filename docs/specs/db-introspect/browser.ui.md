# browser.ui.md — static DB-structure tree browser

## Status
Implemented 2026-07-24 (`docs/db-structure/index.html`, hand-written — never regenerated).

**Scope note:** this is a hand-written static page (`docs/db-structure/index.html`)
outside the Nuxt apps — no auth, no build step, no deploy. The Nuxt UI rules (UC1–UC12)
do **not** apply here; the only house carry-over is the green/slate brand palette.
Zero dependencies: vanilla JS + inline CSS, data via
`<script src="db-structure.data.js">` so the page works over `file://` (no fetch/CORS).

## Layout

```
┌──────────────────────────────────────────────────────────────┐
│ fnb db structure      generated 2026-07-23T…      [search…]  │  ← header bar
├───────────────────────┬──────────────────────────────────────┤
│ ▸ _overview           │  app/tables/tenant.txt               │  ← breadcrumb
│ ▾ app                 │ ┌──────────────────────────────────┐ │
│   grants              │ │ Table "app.tenant"               │ │
│   ▾ tables            │ │  Column │ Type │ …               │ │
│     profile           │ │  Policies:                       │ │
│     tenant   ◀ active │ │   …                              │ │
│   ▸ enums             │ │                                  │ │  ← <pre> content pane
│   ▸ functions         │ └──────────────────────────────────┘ │
│ ▸ app_api             │                                      │
│ ▸ app_fn              │                                      │
│ …                     │                                      │
└───────────────────────┴──────────────────────────────────────┘
```

- **Header bar**: title `fnb db structure`, `generatedAt` from the rollup, search input
  (right-aligned).
- **Tree pane** (left, ~300px, own scroll, resizable via CSS `resize: horizontal` is
  acceptable but not required): three levels — schema → category (`tables`, `functions`,
  `enums`, `types`, `triggers`, …; only non-empty ones) → object leaf. `_overview` is a
  pinned first branch whose leaves are the overview files; each schema's `grants` is a
  direct leaf under the schema (no category folder). Category labels show a count badge:
  `functions (34)`.
- **Content pane** (right, fills remaining width, own scroll): breadcrumb line with the
  repo-relative file path, then the file content in a `<pre>` (monospace, no wrapping,
  horizontal scroll inside the pane — the page body never scrolls horizontally).
- Empty state (nothing selected): short hint text ("select an object, or search").

## Interactions

| Action | Behavior |
|---|---|
| Click schema / category row | Toggle expand/collapse (chevron rotates) |
| Click leaf | Render its `content` in the content pane; mark row active; set `location.hash` to the leaf's `file` path (e.g. `#app/tables/tenant.txt`) |
| Load with hash present | Expand ancestors, select + scroll to that leaf (shareable deep links) |
| Type in search | Case-insensitive substring filter on leaf names (object names); non-matching leaves hidden, matching branches auto-expanded; clearing restores the prior collapsed state |
| Enter in search with exactly one match | Selects it |

Initial state (no hash): all schemas collapsed, nothing selected.

## Styling

- System font stack for chrome, monospace for `<pre>` and leaf names.
- Green (primary accent: active row, focus ring, chevrons) on slate neutrals — mirrors
  the app's green/slate theme.
- Light/dark via `@media (prefers-color-scheme: dark)`; both themes styled.
- Responsive: below ~700px the tree pane becomes a collapsible overlay (hamburger in the
  header); content pane takes full width.

## Data contract

Consumes `window.DB_STRUCTURE` exactly as specified in `db-structure.data.md` (step 4
rollup shape). The page renders whatever kinds/categories are present — it has no
hardcoded schema or kind list beyond the category display order given there.

If `db-structure.data.js` is missing (fresh checkout before first generation… it is
committed, so this is rare), show a full-page hint: run `pnpm db-introspect`.
