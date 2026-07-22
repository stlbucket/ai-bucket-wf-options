# first-run-setup — Shared Data

## Status
Draft — fill in all [FILL IN] sections before implementing.

## Purpose

The data contract for the **first-run initialization flow**: an empty environment (schema
deployed, no anchor tenant, no profiles) is bootstrapped by a human filling in a one-time setup
form. That form mints the anchor tenant + first site-admin profile in Postgres **and** the
matching ZITADEL human user, then hands the person to the ZITADEL login.

This is a **pre-claims / no-session carve-out** (R5) exactly like the OIDC login trio: there are
no claims to enforce RLS with — nobody is logged in yet — so all DB access goes through
`db-access`'s raw-pg root of trust, never PostGraphile.

## Locked decisions (from the spec Q&A, 2026-07-21)

| Decision | Choice | Why |
|---|---|---|
| App install timing | **Inside the setup flow** | `create_anchor_tenant` already installs the `base` application idempotently before creating the tenant. One code path; nothing runs until submit. |
| Host app | **auth-app (`/auth/setup`)** | Already the pre-claims carve-out; owns the ZITADEL transport (internal URL + Host spoof) and mounts the seeder PAT volume. |
| ZITADEL seeding | **Runtime management API + password** | Setup collects a password; auth-app calls `POST /v2/users/human` with the seeder PAT, then redirects to login. Self-contained. |
| Scope | **Alternate path, fires only when no anchor tenant** | Dev keeps the fat `seed.sql` / `zitadel-seed` roster. Setup activates only when `app.tenant` has no `anchor` row. |

## The gate — "does setup need to run?"

A single source of truth: **an anchor tenant exists**. `app_fn.create_anchor_tenant` already keys
off `select * from app.tenant where type = 'anchor'`. The whole flow is gated on the inverse.

```sql
-- fnb-app, new sqitch change (next in sequence after 00000000010290_session.sql,
-- e.g. 00000000010300_app_fn_initialize_anchor.sql; sqitch-expert places it).

-- Read helper: pre-claims safe, no side effects, callable by the login role.
CREATE OR REPLACE FUNCTION app_fn.anchor_exists()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  AS $$ SELECT exists(select 1 from app.tenant where type = 'anchor') $$;

GRANT EXECUTE ON FUNCTION app_fn.anchor_exists() TO authenticator;
```

## The initializer — `app_fn.initialize_anchor(...)`

A **pre-claims root-of-trust** function, modeled exactly on `app_fn.provision_idp_user`
(00000000010270_profile_idp_user.sql): `SECURITY DEFINER`, `search_path = pg_catalog, public`
(**NOT `''`** — that breaks citext operator resolution), **no `app_api` exposure**, granted only
to `authenticator` and called solely via `db-access` raw pg.

It is the setup-time analog of what `db/seed.sql` does by hand for `bucket@function-bucket.net`:
`create_anchor_tenant` → insert profile → link resident → `assume_residency`.

```sql
CREATE OR REPLACE FUNCTION app_fn.initialize_anchor(
    _tenant_name   citext,
    _email         citext,
    _display_name  citext default null,
    _first_name    citext default null,
    _last_name     citext default null,
    _phone         citext default null
  )
  RETURNS app.profile
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  SET search_path = pg_catalog, public
  AS $function$
  DECLARE
    _profile  app.profile;
    _resident app.resident;
  BEGIN
    -- HARD GATE: this is an unauthenticated entry point. It may ONLY ever run on a
    -- virgin environment. Once an anchor tenant exists it is inert forever.
    if exists (select 1 from app.tenant where type = 'anchor') then
      raise exception 'SETUP_ALREADY_COMPLETE' using errcode = '42501';
    end if;

    -- 1. Installs the base application (modules/tools/license-types/packs) idempotently,
    --    creates the anchor tenant, subscribes it to the `anchor` + auto-subscribe (`base`)
    --    packs, and invites _email at `superadmin` scope (grants the app-admin-super license).
    perform app_fn.create_anchor_tenant(_tenant_name, _email);

    -- 2. Create the profile directly in app.profile (no auth.user; ZITADEL owns credentials).
    --    idp_user_id stays null — it links on first OIDC login (provision_idp_user email match).
    insert into app.profile (email, display_name, first_name, last_name, phone)
    values (
      _email,
      coalesce(_display_name, split_part(_email, '@', 1)::citext),
      _first_name,
      _last_name,
      _phone
    )
    returning * into _profile;

    -- 3. Link the just-created superadmin resident to the profile (what the retired
    --    handle_new_user trigger / provision_idp_user step 3 does).
    update app.resident set profile_id = _profile.id
    where email = _email
      and status not in ('blocked_individual', 'blocked_tenant');

    -- 4. Activate residency so the first login lands straight in (seed.sql does this too).
    select * into _resident from app.resident where email = _email and profile_id = _profile.id
    limit 1;
    perform app_fn.assume_residency(_resident.id, _email);

    return _profile;
  end;
  $function$;

GRANT EXECUTE ON FUNCTION app_fn.initialize_anchor(citext,citext,citext,citext,citext,citext)
  TO authenticator;
```

Notes:
- **Idempotency / retry.** Because of the hard gate, a second call after a successful run raises
  `SETUP_ALREADY_COMPLETE`. The endpoint (`setup.data.md`) creates the ZITADEL user **first**
  (idempotent on already-exists) and calls this **second**, so a mid-flight retry is safe: the
  ZITADEL side no-ops, and either the DB runs (still virgin) or the gate reports done.
- **Not exposed via `app_api`** and **not** reachable through PostGraphile — same posture as
  `provision_idp_user`. There is no GraphQL surface for this feature at all.

## db-access surface (the raw-pg carve-out)

Mirrors `packages/db-access/src/mutations/provision-idp-user.ts`.

| File | Export | Signature |
|---|---|---|
| `packages/db-access/src/queries/anchor-exists.ts` | `anchorExists` | `() => Promise<boolean>` — `select app_fn.anchor_exists() as exists` |
| `packages/db-access/src/mutations/initialize-anchor.ts` | `initializeAnchor` | `(input: InitializeAnchorInput) => Promise<Profile>` — `select to_jsonb(app_fn.initialize_anchor($1..$6)) as profile`, `camelCaseKeys` + status uppercase + `Date` normalization (R3), returns `fnb-types` `Profile` |

Both added to the `db-access` barrel. `InitializeAnchorInput`:

```ts
export type InitializeAnchorInput = {
  tenantName: string
  email: string
  displayName?: string | null
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
}
```

## ZITADEL admin client (auth-app server util)

New `apps/auth-app/server/utils/zitadel-admin.ts` — a **runtime** management-API client that
reuses the transport already proven in `docker/zitadel/seed.mjs` and `server/utils/oidc.ts`:
**`node:http`** (not fetch) against the internal origin (`ZITADEL_INTERNAL_URL`) carrying the
**external domain in the `Host` header** (undici strips a Host override; ZITADEL resolves the
instance from Host). Authenticated with the FirstInstance **seeder PAT** read from the shared
`zitadel-seed` volume at `ZITADEL_PAT_FILE` (`/zitadel-seed/admin.pat`).

Exports:

```ts
// resolves org via GET /management/v1/orgs/me (cached), then:
export async function createHumanUser(input: {
  email: string
  givenName: string
  familyName: string
  password: string
}): Promise<{ created: boolean }>
//   POST /v2/users/human  { username, organization:{orgId}, profile:{givenName,familyName},
//                           email:{email,isVerified:true}, password:{password,changeRequired:false} }
//   201/200 → { created: true }; 409 / "already exists" → { created: false } (idempotent)
```

`givenName` / `familyName` derive from the form's first/last name, falling back to the email
local-part when blank (matches the seed roster's shape). The PAT holds instance-owner scope
(the seed job creates users with it), so no extra grants are needed.

## Permissions

- **No `p:` permission gates this feature** — it runs unauthenticated, before any resident or
  license exists. Its *only* gate is the `anchor_exists()` check, enforced in the DB function
  (hard) and pre-checked in the endpoint (soft, for a clean 409).
- The first user is granted the site-admin license by `create_anchor_tenant` →
  `invite_user(..., 'superadmin')` → the `app-admin-super` license type
  (`{"p:app-admin-super","p:app-admin","p:app-admin-support",...}`). Identical to the existing
  anchor-tenant bootstrap; this flow adds no new permission keys.

## Types

Reuses `Profile` / `ProfileStatus` from `@function-bucket/fnb-types` (R3). The only new type is
`InitializeAnchorInput` (above), co-located with the db-access mutation. No `fnb-types` change.

## Open Questions

- [ ] **Password policy at setup.** ZITADEL's password-complexity policy still applies to
      `POST /v2/users/human`. In dev the compose relaxes it; on a real empty/prod deploy it is at
      ZITADEL defaults. Does the setup form enforce/display the complexity rules, or just surface
      the ZITADEL error verbatim on rejection? [FILL IN]
- [ ] **`changeRequired`.** Setup creates the user with `changeRequired: false` (person just chose
      the password). Confirm that matches the desired posture (vs. forcing a reset on first login).
