# site-admin/application/[key] — Application Detail UI

## Status
Implemented

## Route
`/tenant/site-admin/application/[key]` → `apps/tenant-app/app/pages/site-admin/application/[key].vue`

## Required Permission
`p:app-admin-super`

## Layout
Fully read-only — no edit actions anywhere on this page.

**Application Card:** key (monospace), name

**Two-column layout:**

### License Types Card
Count badge. Per license type:
- Key (monospace), display name
- Assignment scope badge
- Permission keys as outline badges

### Modules Card
Count badge. Per module:
- Key (monospace), name, ordinal
- Nested tools (indented, left border):
  - Tool key (smaller, monospace)
  - Tool name
  - Route (monospace, right-aligned, small)
  - Tool permission badges

Modules ordered by `module.ordinal`; tools ordered by `tool.ordinal`.

## User Interactions
None — display only.
