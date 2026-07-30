# E3 — Permission Check for Become-Support Button

## The Database Allows Two Permissions

`app_api.become_support` accepts calls from users with either:
- `p:app-admin-support` — dedicated support staff
- `p:app-admin-super` — platform super admins (can also enter support mode)

## The UI Check (Both Pages)

Both the tenant list and tenant detail page use the same `canSupport` computed:

```typescript
const canSupport = computed(
  () =>
    user.value?.permissions?.includes('p:app-admin-support')
    || user.value?.permissions?.includes('p:app-admin-super')
)
```

## Where the Button Appears

1. **Tenant list page** (`/site-admin/tenant`) — passed as `:can-support` prop to `TenantList`
2. **Tenant detail page** (`/site-admin/tenant/[id]`) — passed to `SupportButton.vue`

## Confirmation Modal (Detail Page)

The detail page routes through `SupportButton.vue`, which wraps the action in a `UModal`
confirmation before emitting `confirm`. The list page calls `becomeSupportForTenant` directly
with no intermediate modal.

## Post-Support Flow (Both Pages)

```typescript
async function onSupport(tenant: Tenant) {
  await becomeSupportForTenant(tenant.id)  // from useSiteAdminTenants composable
  await fetchUser()                         // re-syncs useAuth before internal navigation
  router.push('/admin')
}
```

`fetchUser()` is needed here because `router.push` is an internal navigation — the browser
does not reload, so the updated `auth.user` cookie must be explicitly synced into `useAuth`.
See E1 for the full cookie refresh pattern.
