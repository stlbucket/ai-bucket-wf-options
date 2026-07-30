# C1 — Partial Unique Indexes Enforcing Anchor Tenant Exclusivity

Three partial unique indexes work together to structurally enforce that super admin and
support licenses can only exist in the anchor tenant. No application-layer check needed —
the DB rejects any violation.

## The Three Indexes

```sql
-- Only one license pack can contain app-admin-super
CREATE UNIQUE INDEX idx_uq_lplt_admin_super
  ON app.license_pack_license_type(license_pack_key)
  WHERE license_type_key = 'app-admin-super';

-- Only one license pack can contain app-admin-support
CREATE UNIQUE INDEX idx_uq_lplt_admin_support
  ON app.license_pack_license_type(license_pack_key)
  WHERE license_type_key = 'app-admin-support';

-- Only one tenant can subscribe to the anchor pack
CREATE UNIQUE INDEX idx_uq_anchor_subscription
  ON app.tenant_subscription(id)
  WHERE license_pack_key = 'anchor';
```

## How They Chain Together

1. `app-admin-super` can only exist in ONE license pack (index 1)
2. `app-admin-support` can only exist in ONE license pack (index 2)
3. The `anchor` pack can only be subscribed to by ONE tenant (index 3)
4. Those packs ARE the anchor pack (established at bootstrap)

Combined result: super admin and support licenses are structurally impossible outside the
anchor tenant. Any attempt to add them to another pack or let another tenant subscribe to
anchor fails at the DB constraint level.

## Source

`db/fnb-app/deploy/00000000010220_app.sql` — defined alongside the core schema tables.
