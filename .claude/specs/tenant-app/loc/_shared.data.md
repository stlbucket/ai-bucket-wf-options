# loc — Shared Data Types & Permissions

> **URN-registry migration (2026-07-10):** the `<module>_tenant`/`<module>_resident` mirror
> tables, `ensure_<module>_resident`, and the `handle_update_profile` triggers described below
> are **removed**. Resident references are now URN columns (`posted_by_resident_urn`,
> `resident_urn` — `text REFERENCES res.resource(urn)`); `tenant_id` FKs point at
> `app.tenant(id)`; display names resolve via `resourceBy…Urn { resident { displayName } }`;
> the resident picker is the shared `residentsList` query (`ActiveTenantResidents`). Registered
> tables carry a generated `urn` column. Authoritative contract: `.claude/specs/urn-registry/`
> (`_shared.data.md` §5–§6). Mirror-table details below are historical.


Referenced by all `loc/*.data.md` files. Do not duplicate these here.

## Status
Implemented — GraphQL

## Navigation

Registered in DB (`db/fnb-app/deploy/00000000010240_app_fn.sql`):
```
Module: 'loc' / 'Locations' / icon: i-lucide-map-pin / permission: p:app-user, p:app-admin
  'tenant-loc'  → /tenant/loc  i-lucide-map-pin  p:app-user
```

## Permission Model

| Action | Required |
|---|---|
| View location list | `p:app-user` or `p:app-admin` |
| View location detail | `p:app-user` or `p:app-admin` |
| Create location | `p:app-user` |
| Update location | `p:app-user` (own) / `p:app-admin` |
| Delete location | `p:app-user` (own) / `p:app-admin` |

Enforcement: `app_api.*` PL/pgSQL functions check permissions at the DB layer; PostGraphile enforces via RLS + `pgSettings` claims.

## GraphQL Client Setup

- **urql plugin**: `apps/tenant-app/app/plugins/urql.ts`
  - `url: pub.graphqlApiUrl`, `preferGetMethod: false`
  - exchanges: `cacheExchange → mapExchange(onError) → fetchExchange`
- **Composable source**: `packages/graphql-client-api/src/composables/`
- **Generated hooks**: `packages/graphql-client-api/src/generated/fnb-graphql-api.ts`
- **Re-export location**: `apps/tenant-app/app/composables/useLocations.ts` (single-line re-export from `@function-bucket/fnb-graphql-client-api`)
- **Package index**: `packages/graphql-client-api/src/index.ts` — add `useLocations` and `useLocation` exports

## Data Types

Types are derived from the PostGraphile schema. Fragment defined in:
`packages/graphql-client-api/src/graphql/locations/fragment/Location.graphql`

### Location (fragment: `locations/fragment/Location.graphql`)

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| tenantId | UUID | anchor tenant on public dataset rows |
| residentId | UUID \| null | null on public dataset rows |
| name | string \| null | |
| address1 | string \| null | |
| address2 | string \| null | |
| city | string \| null | |
| state | string \| null | |
| country | string \| null | |
| postalCode | string \| null | GraphQL camelCase of `postal_code` |
| lat | string \| null | Stored as string, not geography |
| lon | string \| null | Stored as string, not geography |
| isPublic | boolean | public dataset rows (`fnb-loc:00000000010340`); `view_public` RLS arm |
| isGeolocated | boolean | generated column: lat and lon both present (`fnb-loc:00000000010350`) |

On writes, `tenant_id`/`resident_id` are populated from auth claims server-side (they are not
part of `LocationInfoInput`); `is_public` defaults false and is set only by dataset sync flows;
`is_geolocated` is generated and never written.

### LocationInfoInput (mutation input)

`LocationInfoInput` from PostGraphile (`packages/graphql-client-api/src/generated/fnb-graphql-api.ts`):

| Field | Type |
|---|---|
| id | UUID \| null | (null = create, present = update) |
| name | string \| null |
| address1 | string \| null |
| address2 | string \| null |
| city | string \| null |
| state | string \| null |
| country | string \| null |
| postalCode | string \| null |
| lat | string \| null |
| lon | string \| null |

Never define a local `Location` or `LocationInfoInput` type — the entity type `Location` comes
from `@function-bucket/fnb-types`, the mutation input `LocationInfoInput` from
`@function-bucket/fnb-graphql-client-api` (R3).

## DB Notes (preserved for reference)

**Bug in `00000000010240_app_fn.sql`**: `app_fn.create_location` uses `_loc_resident.tenant_id` but `_loc_resident` is never fetched. Replace with `auth.tenant_id()::uuid`.

Remove unused `_loc_resident app.resident;` declaration from `app_fn.update_location`.
