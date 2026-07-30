# admin/subscription/index — Subscription List UI

## Status
Implemented

## Route
`/tenant/admin/subscription` → `apps/tenant-app/app/pages/admin/subscription/index.vue`

## Required Permission
`p:app-admin`

## Layout
- Back button → `/admin`
- Title: "Subscriptions"
- `UTabs` with two tabs: **Active** and **Inactive**
- Each tab contains a `SubscriptionList.vue` table

## Component: `SubscriptionList.vue`
Props: `subscriptions: TenantSubscription[]`
Emits: `deactivate(subscriptionId)`, `reactivate(subscriptionId)`

- Columns: license pack key (link to `/admin/subscription/{id}`), status badge, action button
- Status badge: active=success, inactive=neutral
- Action button: toggles deactivate ↔ reactivate based on status

## Computed State
- `activeSubscriptions` — filtered by `status === 'active'`
- `inactiveSubscriptions` — filtered by `status !== 'active'`

## User Interactions
| Action | Trigger |
|---|---|
| View detail | Click license pack key |
| Deactivate | "Deactivate" button (active tab) |
| Reactivate | "Reactivate" button (inactive tab) |
