# Tenant/User Stack — End-to-End Example

This document traces a complete user interaction: a **tenant admin** visiting the resident detail page (`/admin/user/[id]`) to view and modify a user's licenses. This is the richest example in the codebase — it exercises every layer.

---

## The Feature

A tenant admin navigates to `/admin/user/abc-123`. The page shows:
- The resident's display name, email, type, status
- Their currently assigned licenses
- Controls to grant new licenses or revoke existing ones
- Block / Unblock buttons

---

## Component Tree

```
/admin/user/[id].vue (page)
├── <UCard> (resident info: displayName, email, status, type)
├── <UButton> Block / Unblock  →  POST /api/admin/residents/[id]/block|unblock
└── <LicenseAssignment>
    ├── Radio group (scoped licenses — only one allowed)
    │   └── Each = a license_type with assignment_scope = 'admin'
    └── Checkbox group (unscoped licenses — multiple allowed)
        └── Each = a license_type with assignment_scope = 'user'
    └── <UButton> Grant  →  POST /api/admin/residents/[id]/licenses/grant
    └── Per license: <UButton> Revoke  →  POST /api/admin/residents/[id]/licenses/[id]/revoke
```

---

## Full Sequence Diagram

```mermaid
sequenceDiagram
  participant A as Admin Browser
  participant MW as Server Middleware
  participant API as GET /api/admin/residents/[id]
  participant DB as PostgreSQL
  participant RLS as RLS Policies

  A->>MW: GET /admin/user/abc-123 page load
  Note over MW: Runs auth.ts server middleware
  MW->>DB: app_fn.profile_claims_for_user(session.id)<br/>(SECURITY DEFINER, runs as postgres)
  DB-->>MW: ProfileClaims {tenantId: X, permissions: ['p:app-admin', 'p:app-user']}
  MW->>API: event.context.claims = claims

  A->>API: GET /api/admin/residents/abc-123
  API->>DB: withClaims(db, claims, fn)
  Note over DB: BEGIN; SET ROLE authenticated;<br/>set_config('request.jwt.claims',...)
  API->>DB: SELECT r.*, l.* FROM app.resident r<br/>LEFT JOIN app.license l ON l.resident_id = r.id<br/>WHERE r.id = 'abc-123'
  DB->>RLS: Check app.resident policy
  Note over RLS: manage_own_tenant_residencies:<br/>auth.has_permission('p:app-admin', r.tenant_id)<br/>= 'p:app-admin' IN claims.permissions<br/>AND tenant_id = claims.tenant_id ✓
  DB->>RLS: Check app.license policy
  Note over RLS: view_own_tenant_licenses:<br/>auth.has_permission('p:app-admin', l.tenant_id) ✓
  RLS-->>DB: Rows allowed
  DB-->>API: Resident + licenses
  Note over DB: COMMIT
  API-->>A: { resident, licenses }

  A->>API: GET /api/admin/subscriptions (for available license types)
  API->>DB: withClaims(db, claims, fn)
  API->>DB: SELECT ts.*, lplt.*, lt.*<br/>FROM app.tenant_subscription ts<br/>JOIN ... WHERE ts.tenant_id = claims.tenant_id
  DB->>RLS: view_own_tenant_subscriptions:<br/>auth.has_permission('p:app-admin', tenant_id) ✓
  DB-->>API: Available license packs + types
  API-->>A: { subscriptions }

  Note over A: Admin checks a new license, clicks Grant
  A->>API: POST /api/admin/residents/abc-123/licenses/grant<br/>body: { licenseTypeKey: 'app-user' }
  API->>DB: withClaims(db, claims, fn)
  API->>DB: SELECT app_api.grant_user_license('abc-123', 'app-user')
  Note over DB: app_api checks auth.has_permission('p:app-admin', tenant_id)<br/>app_fn.grant_user_license inserts into app.license
  DB-->>API: New license record
  API-->>A: 200 { license }
  Note over A: Component reactively updates — new license shown as active
```

---

## File-by-File Walkthrough

### 1. Page: `apps/tenant-app/app/pages/admin/user/[id].vue`

```vue
<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const route = useRoute()
const id = route.params.id as string

// Fetch resident detail (includes their licenses)
const { data: resident, refresh } = await useFetch(`/api/admin/residents/${id}`)

// Fetch available license types from subscriptions
const { data: subscriptions } = await useFetch('/api/admin/subscriptions')
</script>

<template>
  <div>
    <!-- Resident info card -->
    <UCard>
      <p>{{ resident.displayName }} | {{ resident.email }}</p>
      <UBadge>{{ resident.status }}</UBadge>
      <UButton @click="blockResident">Block</UButton>
    </UCard>

    <!-- License management -->
    <LicenseAssignment
      :resident-id="id"
      :current-licenses="resident.licenses"
      :subscriptions="subscriptions"
      @updated="refresh()"
    />
  </div>
</template>
```

### 2. API Route: `apps/tenant-app/server/api/admin/residents/[id].get.ts`

```typescript
export default defineEventHandler(async (event) => {
  const { db, claims } = event.context
  if (!claims) throw createError({ statusCode: 401 })

  const id = getRouterParam(event, 'id')

  // withClaims wraps in transaction with SET ROLE + set_config
  const resident = await withClaims(db, claims, (trx) =>
    selectResidentById(trx, id!)
  )

  const licenses = await withClaims(db, claims, (trx) =>
    selectLicensesByResidentId(trx, id!)
  )

  return { ...resident, licenses }
})
```

### 3. Kysely Query: `packages/db-types/src/queries/resident.ts`

```typescript
export function selectResidentById(db: Kysely<Database>, id: string) {
  return db
    .selectFrom('app.resident')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
  // RLS policy fires: manage_own_tenant_residencies checks claims.tenant_id
}
```

### 4. Grant License: `apps/tenant-app/server/api/admin/residents/[id]/licenses/grant.post.ts`

```typescript
export default defineEventHandler(async (event) => {
  const { db, claims } = event.context
  if (!claims) throw createError({ statusCode: 401 })

  const residentId = getRouterParam(event, 'id')!
  const { licenseTypeKey } = await readBody(event)

  const license = await withClaims(db, claims, (trx) =>
    appApi.grantUserLicense(trx, residentId, licenseTypeKey)
  )
  return license
})
```

### 5. TypeScript mutation: `packages/db-types/src/mutations/fnb-app/app_api/grant-user-license.ts`

This is the thin wrapper that issues the raw SQL call to the `app_api` PostgreSQL function. `withClaims` has already set `role = authenticated` and injected the JWT claims, so `app_api.grant_user_license` can read `auth.has_permission()` from the session.

```typescript
export async function grantUserLicense(
  db: Kysely<Database>,
  residentId: string,
  licenseTypeKey: string,
): Promise<License> {
  const { rows } = await sql<License>`
    select * from app_api.grant_user_license(
      ${sql.val(residentId)},
      ${sql.val(licenseTypeKey)}
    )
  `.execute(db)
  return rows[0]
}
```

### 6. PostgreSQL API layer: `app_api.grant_user_license` (SQL)

`app_api` is the permission-enforcement layer. It is `SECURITY INVOKER` (runs as the calling role — `authenticated`), so `auth.*` helper functions read the JWT claims that `withClaims` injected. It explicitly checks `p:app-admin` before delegating to the business-logic layer.

```sql
CREATE OR REPLACE FUNCTION app_api.grant_user_license(
  _resident_id uuid,
  _license_type_key citext
) RETURNS app.license
  LANGUAGE plpgsql VOLATILE SECURITY INVOKER AS $$
DECLARE
  _license app.license;
BEGIN
  -- Permission gate — raises '30000: NOT AUTHORIZED' if check fails
  IF auth.has_permission('p:app-admin') != true
  AND auth.has_permission('p:app-admin-super') != true
  THEN RAISE EXCEPTION '30000: NOT AUTHORIZED'; END IF;

  -- Delegate to business logic, passing the current user's resident ID
  -- so app_fn can block self-modification of scoped licenses
  _license := app_fn.grant_user_license(_resident_id, _license_type_key, auth.resident_id());
  RETURN _license;
END;
$$;
```

### 7. DB Function: `app_fn.grant_user_license` (SQL)

`app_fn` is the business-logic layer. It is also `SECURITY INVOKER` but it is only callable from `app_api` (never exposed directly). It finds the right `tenant_subscription`, enforces the one-scoped-license-per-application rule, and upserts the `app.license` row.

```sql
CREATE OR REPLACE FUNCTION app_fn.grant_user_license(
  _resident_id uuid,
  _license_type_key citext,
  _current_user_appresident_id uuid   -- caller's resident_id, used to block self-modification
) RETURNS app.license
  LANGUAGE plpgsql VOLATILE SECURITY INVOKER AS $$
DECLARE
  _resident app.resident;
  _tenant_subscription app.tenant_subscription;
  _license_type app.license_type;
  _license app.license;
BEGIN
  SELECT * INTO _resident FROM app.resident WHERE id = _resident_id;

  -- Find the subscription that includes this license type
  SELECT ats.* INTO _tenant_subscription
  FROM app.tenant_subscription ats
  JOIN app.license_pack_license_type lplt ON lplt.license_pack_key = ats.license_pack_key
  WHERE ats.tenant_id = _resident.tenant_id
  AND lplt.license_type_key = _license_type_key;

  SELECT * INTO _license_type FROM app.license_type WHERE key = _license_type_key;

  -- Scoped license rule: only one of (superadmin/admin/support/user) per application
  -- Remove any existing scoped license before granting the new one
  IF _license_type.assignment_scope IN ('superadmin', 'admin', 'support', 'user') THEN
    IF _current_user_appresident_id = _resident.id THEN
      RAISE EXCEPTION '30025: USERS CANNOT ALTER OWN SCOPE LICENSE STATUS';
    END IF;
    DELETE FROM app.license
    WHERE resident_id = _resident.id
    AND license_type_key IN (
      SELECT key FROM app.license_type
      WHERE application_key = _license_type.application_key
      AND assignment_scope IN ('superadmin', 'admin', 'support', 'user')
    );
  END IF;

  INSERT INTO app.license(tenant_id, resident_id, tenant_subscription_id, license_type_key)
  VALUES (_resident.tenant_id, _resident.id, _tenant_subscription.id, _license_type_key)
  ON CONFLICT (resident_id, license_type_key)
  DO UPDATE SET updated_at = current_timestamp
  RETURNING * INTO _license;

  RETURN _license;
END;
$$;
```

---

## RLS Policy Chain for This Feature

When the API route runs `SELECT * FROM app.resident WHERE id = 'abc-123'` inside `withClaims`:

1. PostgreSQL checks which RLS policies apply to `app.resident` for the `authenticated` role
2. Policies use OR logic — a row is visible if **any** policy passes:
   - `view_own_resident`: `auth.uid() = profile_id` — not the admin's own resident, skipped
   - `manage_own_tenant_residencies`: `auth.has_permission('p:app-admin', tenant_id)` — **YES**, admin has `p:app-admin` for this tenant
3. Row returned

For `app.license`:
- `view_own_tenant_licenses`: `auth.has_permission('p:app-admin', tenant_id)` — **YES**

---

## Data Flow Summary

```
browser cookie [auth.user]
    → useAuth().user (ProfileClaims, client-side display)

browser cookie [session] (httpOnly)
    → server middleware → appFn.profileClaimsForUser(db, userId)
    → event.context.claims (ProfileClaims, server-side authority)
    → withClaims(db, claims, fn)
    → SET LOCAL ROLE authenticated
    → set_config('request.jwt.claims', payload)
    → Kysely query executes
    → RLS: auth.has_permission('p:app-admin', resident.tenant_id)
         reads from current_setting('request.jwt.claims')
         checks user_metadata.permissions array contains key
    → Row returned if authorized
```

---

## What a Tenant Admin Can vs Cannot Do

| Action | Allowed? | Why |
|--------|----------|-----|
| View residents in their tenant | ✓ | `manage_own_tenant_residencies` policy |
| View licenses in their tenant | ✓ | `view_own_tenant_licenses` policy |
| Grant a license to a resident | ✓ | `p:app-admin` checked in `app_api.grant_user_license` |
| View residents in another tenant | ✗ | `tenant_id` in policy doesn't match their claims |
| Grant `app-admin-super` license | ✗ | `app-admin-super` type only in `anchor` license pack; admin doesn't have that subscription |
| View `app.profile` of any user | ✗ | `view_self` policy only allows `auth.uid() = id`; `manage_all_super_admin` requires super |
