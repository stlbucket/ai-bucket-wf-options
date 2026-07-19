# A2 — `jwt.*()` SQL Helper Function Implementations

These functions live in the `jwt` schema (`db/fnb-auth/deploy/00000000010150_jwt.sql`) and are
called by all RLS policies and `SECURITY INVOKER` `_api` functions. They parse the JWT payload
set by `withClaims`. Knowing their implementations explains exactly what the payload shape must be.

The `authenticated` and `anon` roles have `GRANT USAGE` on the `jwt` schema (set in
`db/fnb-auth/deploy/00000000010500_auth_policies.sql`).

```sql
-- Base: read raw JWT claims from session config
jwt.jwt() → current_setting('request.jwt.claims', true)::jsonb

-- Identity helpers
jwt.uid()               → (jwt.jwt()->'user_metadata'->>'profile_id')::uuid
jwt.tenant_id()         → (jwt.jwt()->'user_metadata'->>'tenant_id')::uuid
jwt.resident_id()       → (jwt.jwt()->'user_metadata'->>'resident_id')::uuid
jwt.actual_resident_id()→ (jwt.jwt()->'user_metadata'->>'actual_resident_id')::uuid
jwt.profile_id()        → (jwt.jwt()->'user_metadata'->>'profile_id')::uuid
jwt.email()             → (jwt.jwt()->>'email')::citext
jwt.display_name()      → (jwt.jwt()->>'display_name')::citext

-- Permission helpers
jwt.user_permissions() →
  permissions citext[] from jwt.jwt()->'user_metadata'->'permissions'

jwt.has_permission(key citext) →
  EXISTS (SELECT 1 FROM unnest(jwt.user_permissions()) WHERE perm LIKE key||'%')

jwt.has_permission(key citext, tenant_id uuid) →
  has_permission(key) AND jwt.tenant_id() = tenant_id

jwt.enforce_permission(key citext) →
  IF NOT jwt.has_permission(key) THEN
    RAISE EXCEPTION 'NOT AUTHORIZED' USING ERRCODE = '30000'
  END IF
```

**Usage in RLS policies:**
```sql
-- Most common pattern (tenant-scoped):
USING (jwt.has_permission('p:app-admin', tenant_id))

-- Super admin bypass:
USING (jwt.has_permission('p:app-admin-super'))

-- Self-only access:
USING (jwt.uid() = id)

-- In _api functions (raises on failure):
PERFORM jwt.enforce_permission('p:app-admin');
```

**Important:** `jwt.jwt()` uses `true` as the second arg to `current_setting` — this means
it returns `NULL` rather than raising an error when the setting is not set (e.g., outside
a `withClaims` transaction). RLS policies using these functions will correctly return no rows
when called without claims context.
