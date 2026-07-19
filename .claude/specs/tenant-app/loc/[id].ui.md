# loc/[id] — Location Detail UI

## Status
Ready to implement.

## Route
`/tenant/loc/[id]` → `apps/tenant-app/app/pages/loc/[id].vue`

## Required Permission
`p:app-user` or `p:app-admin`

## Layout
`max-w-3xl mx-auto` (UC12). Single `<UCard>` wrapping the `<Loc>` component plus an action bar.

## Component: `Loc.vue`
**File**: `packages/tenant-layer/app/components/Loc.vue` (tenant-layer, reusable across apps)

Props:
```typescript
props: { location: LocationFragment }  // import from @function-bucket/fnb-graphql-client-api — never define locally
```

Displays (text-only, no map):
- `name` — heading / bold
- Address block: `address1`, `address2` (if present), `city`, `state`, `postal_code`, `country`
- Coordinates: `lat` / `lon` as plain strings (only shown if both are non-null)

Behavior: display-only, no API calls inside the component.

## Edit Mode
Inline toggle on the detail page (not a separate `/edit` route). An "Edit" button reveals a form
with the same fields pre-populated. On save → `updateLocation()` from composable → `refresh()` →
collapse form. Uses `useToast()` for success/error feedback (UC7).

## User Interactions
- Back button → `/loc` (NuxtLink)
- "Edit" button → toggles inline form
- "Delete" button → confirmation, then `deleteLocation(id)` → navigate back to `/loc`
- `useToast()` for all mutation feedback (UC7)

## Fields in Edit Form
All fields from `location_info`: name, address1, address2, city, state, postal_code, country, lat, lon.
No field is required (all nullable in the DB).
