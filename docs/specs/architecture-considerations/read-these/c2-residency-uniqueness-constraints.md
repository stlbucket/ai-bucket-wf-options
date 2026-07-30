# C2 — Residency Uniqueness Constraints

Three constraints work together to enforce the multi-residency model at the DB level.

## The Three Constraints

```sql
-- 1. One active resident per profile at any moment in time
CREATE UNIQUE INDEX idx_uq_resident
  ON app.resident(profile_id)
  WHERE status = 'active';

-- 2. One home-type resident per profile, ever
CREATE UNIQUE INDEX idx_uq_home_resident
  ON app.resident(profile_id)
  WHERE type = 'home';

-- 3. One resident per (tenant, profile, type) combination
ALTER TABLE app.resident
  ADD CONSTRAINT uq_resident UNIQUE(tenant_id, profile_id, type);
```

## What Each Enforces

**Index 1 (single-active-tenant invariant):** A user can be resident in many tenants, but
only one can be `active` at a time. When `assume_residency` switches tenants, it sets the
previous active resident to `inactive` before activating the new one. This index ensures
that constraint is never violated.

**Index 2 (immutable home residency):** The first tenant a user joins creates a `home`-type
resident. This is their permanent home. A second home-type resident can never be created —
even if the first one is inactive. `become_support` creates `support`-type residents for
this reason, not home-type.

**Index 3 (no duplicate residencies):** A user cannot have two `home` residents in the same
tenant, two `guest` residents in the same tenant, etc. Uniqueness is per combination of
(tenant, profile, type).

## Interaction with Support Mode

Support mode creates a `support`-type resident in the target tenant — never a `home` or
`guest`. This sidesteps index 2 (only restricts `home` type) and avoids conflicts with
index 3 (support type is unique per tenant+profile).

During support mode:
- Home resident status = `supporting` (not `active` or `inactive`)
- Support resident status = `active`
- Index 1 allows this: `supporting` is not `active`, so both can coexist
