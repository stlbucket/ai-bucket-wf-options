# UI / Components Rules

Rules for UI implementation across all apps in the fnb monorepo.
These apply everywhere a Vue component or page is written.

Migrated from `global-rules.md` (R15–R16) and expanded.

---

## Status
Active — enforced across all modules.

---

## Component Selection

### UC3 — Always use Nuxt UI components before reaching for raw HTML or custom CSS
Check https://ui.nuxt.com/components before building anything.
Prefer `UCard`, `UButton`, `UTable`, `UModal`, `UBadge`, `UInput`, etc. over custom div structures.
If a Nuxt UI component covers the use case, use it — do not reinvent it.

### UC4 — Use UCard as the default page content container
- **List pages:** one `UCard` wrapping the filter bar + table
- **Detail pages:** one or more `UCard`s grouping related fields
- Avoid bare `<div class="p-4 border rounded">` wrappers.

### UC8 — Use UEmpty for empty states
When a list has zero items, render `<UEmpty ... />` with a descriptive label.
Do not render an empty table with headers and no rows.

### UC9 — Use UTabs for detail pages with multiple sections
When a detail page has 3+ sections of content, use `<UTabs>` to organize them
rather than stacked `<UCard>` blocks that require scrolling.

### UC10 — Use UDropdownMenu for row-level actions beyond a single button
If a table row has more than one action (edit, delete, view), group them in a
`<UDropdownMenu>` with a `...` icon trigger, not a row of buttons.

---

## Styling

### UC6 — Use Nuxt UI color tokens on components, not raw Tailwind color classes
```html
<!-- correct -->
<UButton color="primary" />
<UBadge color="success" />

<!-- wrong -->
<button class="bg-green-500 text-white" />
```
Stick to the semantic palette: `primary`, `secondary`, `success`, `warning`, `error`, `info`, `neutral`.

**Non-CSS consumers (Mapbox paint, canvas, WebGL):** the theme variables resolve to `oklch(...)`,
which Mapbox GL's color parser rejects — layers fail silently. Resolve the token to `rgb()`
through a probe element first (precedent: `BreweryMapView.vue` `resolvedPrimary()`):
```ts
const probe = document.createElement('span')
probe.style.color = 'var(--ui-primary)'
document.body.appendChild(probe)
const rgb = getComputedStyle(probe).color // always rgb()/rgba()
probe.remove()
```

### UC11 — Icon names come from Lucide, prefixed with `i-lucide-`
```html
<UButton icon="i-lucide-pencil" />
<UButton icon="i-lucide-trash" />
```
Do not use heroicons or other icon packs. Always verify the icon name exists before using it —
copying an icon name from another component without checking is a known source of bugs.

### UC12 — Page-level width constraint: `max-w-5xl` for hubs, `max-w-3xl` for detail pages
All content pages must be width-constrained with `mx-auto`.
Do not let content stretch to full viewport width.
- Hub/landing pages: `max-w-5xl mx-auto`
- Detail pages: `max-w-3xl mx-auto`

---

## Responsiveness

### UC5 — All UIs must be responsive (mobile-first)
- Stack vertically on mobile, side-by-side on `sm:` and above
- Filter bars use `flex flex-wrap` — never overflow on small screens
- Fixed-width inputs (`w-64`) must add `max-w-full` or convert to `w-full sm:w-64`
- Tables that won't fit on mobile must be wrapped in `overflow-x-auto`

---

## Data and Types

### UC1 — Status badge colors are defined per-domain and applied consistently
Each domain defines its own status color mapping (see `_shared.data.md` files).
Do not invent new color mappings for statuses that already have one.

### UC2 — Display components receive a typed prop, never a raw object
```ts
// correct
props: { location: Location }   // Location imported from a shared package

// wrong
props: { lat: number, lng: number, name: string }  // local shape
```
Import the type from the shared packages — a generated GraphQL type or composable view type from
`@function-bucket/fnb-graphql-client-api`, or a hand-written root-of-trust type from
`@function-bucket/fnb-db-access` (e.g. `ProfileClaims`, `MessageWithSender`). Never redefine the shape locally.

---

## Feedback

### UC7 — Use useToast for transient feedback, not inline messages
```ts
const toast = useToast()
toast.add({ title: 'Saved', color: 'success' })
toast.add({ title: 'Failed to save', color: 'error' })
```
Reserve inline `UAlert` for persistent, contextual warnings (e.g. a form-level validation
summary) — not for success/error toast notifications.

---

## Known Gaps

- **Form validation** — `UForm` + zod is the likely standard but not yet mandated. New forms
  should use it speculatively; this will be formalized as UC13 once adopted.
- **Loading/pending states** — no standard established yet (`USkeleton` vs spinner).
- **Optimistic UI updates** — not yet used anywhere.
