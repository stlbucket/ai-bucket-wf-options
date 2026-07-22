-- pgTAP test harness setup — run ONCE per `pnpm db-test` invocation by scripts/db-test.ts,
-- OUTSIDE the per-file transactions, so the `tap` extension + `test` helper schema persist for
-- the whole run. Idempotent (safe to re-run after a crashed run). Teardown drops `test`.
-- Spec: .claude/specs/db-testing/ (_shared.md = the helper contract).

-- ── pgTAP itself ────────────────────────────────────────────────────────────────────────────
-- Created on demand (dev only). Requires the pgtap OS package baked into the dev db image
-- (docker/db.Dockerfile). If this line errors, rebuild: `docker compose build db && docker
-- compose up -d db` — see .claude/specs/db-testing/harness.md §1.
create schema if not exists tap;
create extension if not exists pgtap schema tap;
-- assertions run while the session role is `authenticated` (test._login switches role), so the
-- switched-to role needs USAGE on the tap schema; EXECUTE on the functions is PUBLIC by default.
grant usage on schema tap to public;

-- ── test helper schema (dropped by teardown.sql) ────────────────────────────────────────────
create schema if not exists test;
grant usage on schema test to public;

-- become an authenticated user with the given tenant + permissions. SET LOCAL inside a plpgsql
-- function persists to end-of-transaction (the documented trick), so the caller's session runs
-- as `authenticated` with these claims for the rest of the test file — until ROLLBACK.
create or replace function test._login(
  _profile_id  uuid,
  _tenant_id   uuid,
  _perms       text[] default '{}',
  _resident_id uuid   default null
) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    jsonb_build_object('user_metadata', jsonb_build_object(
      'profile_id',  _profile_id,
      'tenant_id',   _tenant_id,
      'resident_id', _resident_id,
      'permissions', to_jsonb(_perms)
    ))::text, true);              -- is_local = true → scoped to the surrounding txn
  set local role authenticated;
end;
$$;

-- drop back to the owning (superuser) connection + clear claims
create or replace function test._logout() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '{}', true);
end;
$$;

-- Minimal seed helpers — run as the owner (before test._login), RLS bypassed. Deferred FKs to
-- res.resource (id) are unchecked under ROLLBACK, so no res.resource row is needed. Registration
-- of tenant/resident lives in app_fn BODIES, not triggers, so a raw insert has no side effects.
create or replace function test._seed_tenant(_id uuid, _name text default 'test-tenant')
  returns void language sql as $$
  insert into app.tenant (id, name, type, status)
  values (_id, _name::citext, 'customer', 'active');
$$;

create or replace function test._seed_resident(_id uuid, _tenant_id uuid)
  returns void language sql as $$
  insert into app.resident (id, profile_id, tenant_id, tenant_name, email, display_name, type, status)
  values (_id, null, _tenant_id,
          (select name from app.tenant where id = _tenant_id),
          'resident@test.local', 'Test Resident'::citext, 'home', 'active');
  -- Register the resident in res.resource so its generated urn exists there. Required because
  -- todo_fn.create_todo sets todo.resident_urn = resident.urn, and todo.resident_urn → res.resource
  -- (urn) is an IMMEDIATE FK (not the deferred id-FK). SECURITY DEFINER, so it writes the deny-all
  -- registry regardless of the calling role.
  select res_fn.register_resource(_id, _tenant_id, 'app', 'resident');
$$;
