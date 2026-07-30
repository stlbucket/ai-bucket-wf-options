# site-admin/tenant/index — Tenant List Data

## Status
Implemented — GraphQL (CreateTenant wiring built 2026-07-27; admin-identity extension —
`_first_name`/`_last_name`/`_phone` + admin-profile pre-create — built 2026-07-30, plan
`0650`; manual e2e verification pending).

## Route
`/tenant/site-admin/tenant` — see `index.ui.md` for UI details

## GraphQL

### Query: `SearchTenants`
- File: `packages/graphql-client-api/src/graphql/app/query/searchTenants.graphql`
- Generated hook: `useSearchTenantsQuery()` in `src/generated/fnb-graphql-api.ts`
- Variable: `$searchTerm: String` — pass `null` / empty string to fetch all tenants
- Fetches: all tenants with their subscriptions and license packs

### Mutation: BecomeSupport (pure GraphQL)
- File: `packages/graphql-client-api/src/graphql/app/mutation/becomeSupport.graphql`
- Generated hook: `useBecomeSupportMutation()`; composable `useBecomeSupport().becomeSupportForTenant(tenantId)`
- After the mutation, the client calls `useAuth().refreshClaims()` (re-fetches claims via GraphQL
  into localStorage) and navigates to `/admin`. There is no Nitro route (tenant-app has no `server/`).

### Mutation: `CreateTenant` (admin-identity extension built 2026-07-30)
- File: `packages/graphql-client-api/src/graphql/app/mutation/createAppTenant.graphql` (pre-existing,
  unused until the New Tenant modal — its first consumer)
- Generated hook: `useCreateTenantMutation()` in `src/generated/fnb-graphql-api.ts` (re-run codegen
  after the DB change below)
- Variables: `$name: String!`, `$email: String!`, `$firstName: String!`, `$lastName: String!`,
  `$phone: String` →
  `createTenant(input: { _name, _email, _firstName, _lastName, _phone })`, returns
  `tenant { ...Tenant }`. (Arg inflection assumed to match the existing `_name`/`_email`
  pattern — confirm `_firstName`/`_lastName`/`_phone` in the regenerated schema at codegen
  time.) Identifier still not passed (stays `null`), type still defaults to `'customer'`
  (locked decision).
- Backing function: `app_api.create_tenant(_name, _identifier = null, _email = null,
  _type = 'customer', _first_name = null, _last_name = null, _phone = null)`
  → `app_fn.create_tenant` (same signature extension) in
  `db/fnb-app/deploy/00000000010240_app_fn.sql`.
  **Sqitch/PostGraphile gotcha:** `CREATE OR REPLACE` with a different arg count creates an
  **overload** — the sqitch change must `DROP` the old 4-arg `app_api.create_tenant` and
  `app_fn.create_tenant` first, or PostGraphile sees two `createTenant` candidates
  (sqitch-expert owns the rework mechanics at implementation time).
- What the DB does (extension in **bold**): uniqueness check on root-tenant name/identifier
  (raises `30002` on conflict), inserts `app.tenant`, registers the URN resource
  (`res_fn.register_resource`), subscribes every `auto_subscribe = true` license pack,
  **pre-creates/updates the admin's `app.profile` row (below)**, and invites `_email` as tenant
  **admin** (`app_fn.invite_user(..., 'admin')` — creates the `app.resident` row, so email is
  effectively **required** even though the SQL parameter is nullable).
- Auth: no `jwt.enforce_permission` call in `app_api.create_tenant` — enforcement is the RLS
  `manage_tenant` policy on `app.tenant` (`p:app-admin-super`). See Known Gaps.

**Admin-profile pre-create** (in `app_fn.create_tenant`, **before** the `invite_user` call so
the resident picks up the profile's display name — the `app_fn.initialize_anchor` /
first-run-setup precedent; `app_fn.provision_idp_user` links the row by email match on first
OIDC login and leaves it untouched):
- No `app.profile` row for `_email` → insert one with `first_name`/`last_name`/`phone` and
  `display_name` = **lowercase first initial + last name**
  (`lower(left(_first_name, 1) || _last_name)`, e.g. `jsmith`; user picks 2026-07-30).
  `display_name` is UNIQUE — on conflict (or when names are null) fall back to the lowercased
  email local part (`lower(split_part(_email, '@', 1))`); if that is also taken, leave
  `display_name` null (nullable) rather than failing tenant creation.
- Existing profile → **blank-fill only** (user pick 2026-07-30):
  `first_name = coalesce(first_name, _first_name)` etc. for the three new fields;
  `display_name` and everything else untouched — a super admin never clobbers a real user's
  self-maintained data.
- Side effect worth knowing: because the profile now exists before `invite_user`, the new
  resident is created **already linked** (`profile_id` set, display_name copied from the
  profile) instead of linking later at first login.
- Phone arrives E.164 (`+1XXXXXXXXXX`) from `PhoneSegments`, stored raw on
  `app.profile.phone` — same as the profile page; **no** notify phone-verification ceremony is
  triggered here (that stays the user's own later flow, D13).

## Composable

**Source:** `packages/graphql-client-api/src/composables/useSiteAdminTenants.ts`
**Re-export:** `apps/tenant-app/app/composables/useSiteAdminTenants.ts`

| Export | Return shape | Usage |
|---|---|---|
| `useSiteAdminTenants()` | `{ tenants: Ref<TenantSummary[]>, fetching, error }` (from `useSearchTenantsQuery`) | called in index.vue setup |
| `useBecomeSupport()` | `{ becomeSupportForTenant(id) }` (runs `useBecomeSupportMutation`) | support button handler |
| `useCreateTenant()` | `{ createTenant(input: CreateTenantInput): Promise<Tenant> }` — runs `useCreateTenantMutation`, throws on `res.error`, returns the mapped `Tenant` (page needs `id` for navigation). `CreateTenantInput = { name, email, firstName, lastName, phone?: string \| null }` (admin-identity extension 2026-07-30 — replaces the original `(name, email)` positional signature; the page is the only consumer) | New Tenant modal Create handler |

`useCreateTenant` lives in the same `useSiteAdminTenants.ts` source file (and its existing
tenant-app re-export). After a successful create the page navigates to the detail route —
no list re-fetch needed on this page (`SearchTenants` re-runs naturally on return).

## Types
See `_shared.data.md` → Tenant, GraphQL Operations, Support Mode Flow (GraphQL).

## Known Gaps
- `app_api.create_tenant` is the only site-admin mutation without an explicit
  `jwt.enforce_permission` gate — it relies solely on the RLS `manage_tenant` policy
  (`p:app-admin-super`, `db/fnb-app/deploy/00000000010250_app_policies.sql`). Effective
  enforcement is equivalent, but it diverges from the `app_api.*` convention documented in
  `_shared.data.md`. No DB change is in scope for the New Tenant modal (it calls existing
  infrastructure as-is).
