# B3 — License Pack Mechanics

A license pack is a subscription bundle. Tenants subscribe to packs; packs contain license types.

## `number_of_licenses` Semantics

| Value | Meaning |
|-------|---------|
| `-1` | Unlimited — no cap, as many residents as needed |
| `0` | Tenant-level — one shared license for the whole tenant |
| `N` (positive) | Hard cap — at most N residents can hold this license type simultaneously |

## `auto_subscribe`

If `true`, every new tenant is automatically subscribed to this pack when created.
Also: `app_fn.install_basic_application` with `auto_subscribe = true` retroactively subscribes
all existing tenants.

## Built-in Packs

### `base` pack (`auto_subscribe = true`)
Every tenant automatically gets this. Contains:
- `app-user` (user scope) — unlimited
- `app-admin` (admin scope) — unlimited

### `anchor` pack (`auto_subscribe = false`)
Only the anchor tenant can subscribe (enforced by partial unique index — see
c1-anchor-tenant-unique-indexes.md). Contains:
- `app-admin-super` (superadmin scope) — unlimited
- `app-admin-support` (support scope) — unlimited

## `expiration_interval_type`

Licenses can have optional expiration. The enum supports: `none`, `day`, `week`, `month`,
`year`. When set, `license.expires_at` is populated and the license becomes inactive after
that date. The claims query filters `WHERE l.status = 'active'` — expired licenses are
excluded from permissions.

## Tenant Subscription Lifecycle

```
Super admin calls app_fn.create_tenant(...)
  → INSERT app.tenant
  → INSERT app.tenant_subscription for 'base' pack (auto_subscribe)
  → Tenants can then be subscribed to additional packs by super admin
```

One `tenant_subscription` row per (tenant, license_pack) — no duplicates.
