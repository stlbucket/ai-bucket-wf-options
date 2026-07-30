# A1 — JWT Payload Structure (buildJwtPayload)

The exact JSON shape written into Postgres `request.jwt.claims` via `set_config`. This is
what all `auth.*()` SQL helper functions actually parse — the nested `user_metadata` wrapper
is critical and easy to get wrong.

```json
{
  "email": "alice@example.com",
  "display_name": "Alice",
  "user_metadata": {
    "profile_id": "uuid-of-profile",
    "tenant_id": "uuid-of-tenant",
    "resident_id": "uuid-of-resident",
    "actual_resident_id": "uuid-of-home-resident",
    "permissions": ["p:app-user", "p:app-admin", "p:discussions"]
  }
}
```

Built by `buildJwtPayload(claims: ProfileClaims)` in `packages/db-access/src/jwt.ts` (the same
payload shape is also assembled inline by `grafast.context()` in
`apps/graphql-api-app/server/graphile.config.ts` on the default GraphQL path):

```typescript
function buildJwtPayload(claims: ProfileClaims): Record<string, unknown> {
  return {
    email: claims.email,
    display_name: claims.displayName,
    user_metadata: {
      profile_id: claims.profileId,
      tenant_id: claims.tenantId,
      resident_id: claims.residentId,
      actual_resident_id: claims.actualResidentId,
      permissions: claims.permissions ?? [],
    },
  }
}
```

Set into the Postgres session as a transaction-local config (`true` = transaction-scoped,
cleared at COMMIT/ROLLBACK):
```typescript
await sql`select set_config('request.jwt.claims', ${sql.val(payload)}, true)`.execute(trx)
```

**Why this matters:** The TypeScript `ProfileClaims` type uses camelCase. The Postgres JWT
payload uses snake_case inside `user_metadata`. The `auth.*()` functions parse the nested
`user_metadata` key — if you change the payload shape, all RLS policies break silently.
