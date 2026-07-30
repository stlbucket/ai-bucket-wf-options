# support/tickets/new — New Ticket UI

## Status
Implemented

## Route
`/tenant/support/tickets/new` → `apps/tenant-app/app/pages/support/tickets/new.vue`

## Required Permission
`p:app-user` or `p:app-admin`

## Layout
Form with two fields:
- **Title** — text input, required
- **Description** — textarea, required

Submit button. On success: redirect to `/support/tickets` (list page).

## User Interactions
| Action | Trigger |
|---|---|
| Submit ticket | Submit button |
| Cancel / back | Browser back or navigate away |
