# Special Cases

## 1. Anchor Tenant

The anchor tenant is the platform operator's own tenant — the one that owns the super admin and support licenses. There can be **only one** anchor tenant, enforced by database constraints, not application code.

### How Exclusivity Is Enforced

```sql
-- Only one license pack can ever contain app-admin-super:
create unique index idx_uq_lplt_admin_super
  on app.license_pack_license_type(license_pack_key)
  where license_type_key = 'app-admin-super';

-- Only one license pack can ever contain app-admin-support:
create unique index idx_uq_lplt_admin_support
  on app.license_pack_license_type(license_pack_key)
  where license_type_key = 'app-admin-support';

-- Only one tenant can subscribe to the anchor license pack:
create unique index idx_uq_anchor_subscription
  on app.tenant_subscription(id)
  where license_pack_key = 'anchor';
```

These three partial unique indexes together mean: super admin and support licenses can only exist in the `anchor` license pack, and only one tenant can subscribe to that pack. The anchor tenant's `type = 'anchor'` is purely informational — the real enforcement is in the indexes.

### Creating the Anchor Tenant

```sql
-- NO API — called directly from a seed script or initial setup
SELECT app_fn.create_anchor_tenant('Function Bucket', 'admin@function-bucket.net');
```

This function:
1. Calls `app_fn.install_anchor_application()` (creates the anchor app with super/support license types and the `anchor` pack)
2. Creates the anchor tenant (`type='anchor'`)
3. Subscribes the anchor tenant to the `anchor` pack
4. Invites the email as a super admin (grants `app-admin-super`)

---

## 2. Support Mode

Support staff (users with `p:app-admin-support`) can temporarily "become" a resident of any other tenant to troubleshoot issues. This is tracked via a separate `support`-type resident record and the `actual_resident_id` field in claims.

### Enter Support Mode

```sql
CREATE OR REPLACE FUNCTION app_fn.become_support(_tenant_id uuid, _profile_id uuid)
  RETURNS app.resident AS $$
DECLARE
  _support_resident app.resident;
BEGIN
  -- Requires p:app-admin-super OR p:app-admin-support
  PERFORM auth.enforce_permission('p:app-admin-support');

  -- Reuse existing support resident or create new one
  SELECT * INTO _support_resident
  FROM app.resident
  WHERE profile_id = _profile_id AND tenant_id = _tenant_id AND type = 'support';

  IF _support_resident.id IS NULL THEN
    INSERT INTO app.resident(profile_id, tenant_id, type, status, email, tenant_name, display_name)
    SELECT _profile_id, t.id, 'support', 'supporting', p.email, t.name, p.display_name
    FROM app.tenant t, app.profile p
    WHERE t.id = _tenant_id AND p.id = _profile_id
    RETURNING * INTO _support_resident;
  ELSE
    UPDATE app.resident SET status = 'supporting' WHERE id = _support_resident.id;
  END IF;

  -- Deactivate current active resident
  UPDATE app.resident SET status = 'inactive'
  WHERE profile_id = _profile_id AND status = 'active' AND id != _support_resident.id;

  -- Grant all admin/all-scope licenses from the target tenant's subscriptions
  -- (so the support person has admin access in the target tenant)
  ...

  RETURN _support_resident;
END;
$$;
```

After `become_support`, calling `current_profile_claims` for this profile returns:
- `tenant_id` = the target tenant
- `resident_id` = the support-type resident
- `actual_resident_id` = the support person's original home resident (from `_home_resident.id`)
- `permissions` = whatever licenses were granted to the support resident

### Exit Support Mode

```sql
SELECT app_fn.exit_support_mode(_support_resident_id, _actual_resident_id);
```

This:
1. Sets the support resident to `inactive`
2. Calls `assume_residency(_actual_resident_id, email)` to reactivate the original home tenant

### Detecting Support Mode in the UI

The `actual_resident_id` field in `ProfileClaims` differs from `resident_id` when in support mode. The frontend can compare them to show a "You are in support mode" banner.

---

## 3. Multiple Residencies (Multi-Tenant)

A user (profile) can be a resident of multiple tenants. The `resident_type` determines their relationship:

| Situation | Type | What happens |
|-----------|------|-------------|
| First time joining any tenant | `home` | One home resident per profile (enforced by partial unique index) |
| Invited to another tenant | `guest` | Additional residency |
| Acting as support staff | `support` | Transient, created by `become_support` |

### Uniqueness Constraints

```sql
-- At most one active resident per profile at any time:
create unique index idx_uq_resident on app.resident(profile_id) where status = 'active';

-- At most one home-type resident per profile ever:
create unique index idx_uq_home_resident on app.resident(profile_id) where type = 'home';

-- At most one resident per (tenant, profile, type) combination:
alter table only app.resident add constraint uq_resident unique(tenant_id, profile_id, type);
```

### Switching Tenants: `assume_residency`

When a user switches to a different tenant (or accepts an invitation):

```sql
CREATE OR REPLACE FUNCTION app_fn.assume_residency(_resident_id uuid, _email citext)
  RETURNS app.resident AS $$
BEGIN
  -- Verify the resident belongs to this email
  SELECT * INTO _resident FROM app.resident WHERE id = _resident_id AND email = _email;

  -- Deactivate all other residents for this profile
  UPDATE app.resident SET status = 'inactive'
  WHERE profile_id = _resident.profile_id
  AND status IN ('active', 'supporting')
  AND id != _resident_id;

  -- Activate the target resident
  UPDATE app.resident SET status = 'active' WHERE id = _resident_id
  RETURNING * INTO _resident;

  -- Update all licenses to point to the new active profile
  UPDATE app.license SET profile_id = _resident.profile_id
  WHERE resident_id IN (
    SELECT id FROM app.resident WHERE email = _resident.email
  );

  RETURN _resident;
END;
$$;
```

The license `profile_id` update is important for the `view_own_profile_licenses` RLS policy — it ensures that license records track the active profile even as the user switches tenants.

---

## 4. Invited Users Without Profiles

`app.resident.profile_id` is **nullable**. This allows inviting someone by email before they create an account.

```sql
-- resident can exist with email but no profile_id:
create table if not exists app.resident (
    ...
    profile_id uuid null references app.profile(id)
    ...
);
```

The invited user sees this in the `view_own_resident_email` policy:
```sql
CREATE POLICY view_own_resident_email ON app.resident
  FOR SELECT
  USING (auth.jwt()->>'email' = email AND auth.tenant_id() = tenant_id);
```

When they eventually register, the `handle_new_user` trigger fires and links them:
```sql
-- trigger on auth.user INSERT
create or replace function app_fn.handle_new_user()
  ...
  INSERT INTO app.profile (id, email, display_name)
  VALUES (new.id, new.email, split_part(new.email, '@', 1));

  -- Link any existing residents with this email
  UPDATE app.resident SET profile_id = new.id
  WHERE email = new.email
  AND status NOT IN ('blocked_individual', 'blocked_tenant');
```

This means a tenant admin can invite `alice@company.com` before Alice has registered. When she signs up, she automatically gets her residency linked.

---

## 5. The `handle_new_user` Trigger Chain

When a new `auth.user` record is inserted:

```
auth.user INSERT
  ↓ trigger: on_auth_user_created
  ↓ app_fn.handle_new_user()
      → INSERT app.profile (id=user.id, email=user.email, display_name=split_part(email,'@',1))
      → UPDATE app.resident SET profile_id = user.id WHERE email = user.email
```

This is a `SECURITY DEFINER` trigger — it runs as `postgres`, so it can write to `app.profile` and `app.resident` without claims being set.

---

## 6. `display_name` Propagation

When `app.profile.display_name` is updated, triggers propagate the change to all module shadow residents:

```sql
-- In fnb-msg:
create or replace trigger msg_on_app_profile_updated
  after update on app.profile
  for each row execute procedure msg_fn.handle_update_profile();

-- msg_fn.handle_update_profile:
UPDATE msg.msg_resident SET display_name = new.display_name
WHERE resident_id IN (SELECT id FROM app.resident WHERE profile_id = new.id);
```

The same trigger pattern exists in `fnb-todo` (`todo_on_app_profile_updated`) and `fnb-loc` (`loc_on_app_profile_updated`). This keeps display names consistent across all modules without requiring join queries.

---

## 7. `profile_claims_for_user` vs `current_profile_claims` — Bootstrap Problem

There's a chicken-and-egg problem during session startup: to use `withClaims`, you need claims; to get claims, you need to query the DB; but to query the DB with RLS, you need claims.

The solution is the **bootstrap function** `profile_claims_for_user`:
- It's `SECURITY DEFINER` (runs as `postgres`, bypasses RLS)
- It's granted directly to `authenticator` (the DB login role)
- It takes a `user_id` (from the httpOnly `session` cookie) instead of requiring existing claims
- It joins `auth.user → app.profile` by email to find the profile, then calls `current_profile_claims`

Once claims are bootstrapped by middleware, all subsequent queries in that request use `withClaims` normally.

---

## 8. Scoped License Type Uniqueness

Each application is constrained to have at most one license type per assignment scope. This prevents a bug where multiple `admin`-scope license types could be created for the same application (which would make license assignment ambiguous):

```sql
create unique index idx_uq_app_license_type_scope_superadmin
  on app.license_type(key, application_key) where assignment_scope = 'superadmin';
create unique index idx_uq_app_license_type_scope_admin
  on app.license_type(key, application_key) where assignment_scope = 'admin';
create unique index idx_uq_app_license_type_scope_user
  on app.license_type(key, application_key) where assignment_scope = 'user';
create unique index idx_uq_app_license_type_scope_support
  on app.license_type(key, application_key) where assignment_scope = 'support';
```

---

## 9. The `actual_resident_id` Field

`ProfileClaims.actualResidentId` (mapped to `app_fn.profile_claims.actual_resident_id`) is always set to the **home resident's ID**, regardless of which tenant is currently active.

Why it matters:
- **Normal session**: `residentId == actualResidentId` (active resident IS the home resident)
- **Support session**: `residentId` = the support-type resident, `actualResidentId` = the original home resident

The UI can use this to detect support mode, and `exit_support_mode` uses it to know which resident to re-activate.

---

## 10. License Status vs Resident Status

Both licenses and residents have statuses, and they interact:

- A resident's **active** licenses contribute to their permissions
- If a resident is `blocked_individual` or `blocked_tenant`, they typically can't log in (the application layer enforces this — RLS doesn't block login itself)
- If a license is `inactive` or `expired`, its permissions are NOT included in the claims aggregation (`WHERE l.status = 'active'` in `current_profile_claims`)
- An admin can deactivate a specific license without deactivating the resident — fine-grained permission revocation

---

## 11. Unique Resident Active Index

```sql
-- Only one resident can be 'active' per profile at any time:
create unique index idx_uq_resident on app.resident(profile_id) where status = 'active';
```

This is a **partial unique index** — it only indexes rows where `status = 'active'`. A profile can have many `inactive` or `invited` residents across tenants, but at most one `active`. This enforces the single-active-tenant invariant at the database level.
