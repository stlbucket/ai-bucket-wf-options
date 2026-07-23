begin;

-- Server-side sessions (spec: .claude/specs/future-auth/session-refresh-pattern.md; issues
-- 0185 + 0180-merged). The sealed `session` cookie grows to { id, sid }; validity is decided
-- by this row, not the seal's maxAge. The `auth` schema survives the ZITADEL cutover and is
-- the right domain; the change lives in fnb-app because it references app.profile + app_fn
-- (same reasoning as 00000000010270_profile_idp_user).

create table auth.session (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references app.profile (id) on delete cascade,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  revoked_at    timestamptz,
  -- auth_method distinguishes the ZITADEL login ceremony from a link-driven OTP quick session
  -- (spec: .claude/specs/otp-login/). It drives per-method lifetimes in claims_for_session below;
  -- it is server-side only — never added to request.jwt.claims (nothing in RLS branches on it).
  auth_method   text not null default 'zitadel' check (auth_method in ('zitadel', 'otp'))
);
create index on auth.session (profile_id);

-- Deny-all (R9): no policies — the table is reachable only through the SECURITY DEFINER
-- functions below. fnb-auth's 00000000010500 default privileges auto-grant ALL on new auth
-- tables to anon/authenticated/service_role, so revoke explicitly on top of the empty-policy
-- RLS.
alter table auth.session enable row level security;
revoke all on auth.session from anon, authenticated, service_role;

-- Pre-claims root of trust (R5 carve-out, same shape as app_fn.provision_idp_user): called
-- by auth-app / the layers through db-access raw pg, so NO app_api wrapper and no jwt.* gate.
-- search_path pinned to pg_catalog, public (citext operators live in public).

----------------------------------------------------------------- create_session
-- Called by the OIDC callback after provision_idp_user; the returned id is sealed into the
-- cookie as `sid`. The cookie is written only there — renewal never re-seals.
-- _auth_method defaults to 'zitadel' so the existing 1-arg call site (the OIDC callback via
-- db-access createSession) is unchanged; the OTP verify path passes 'otp'.
create or replace function app_fn.create_session(_profile_id uuid, _auth_method text default 'zitadel')
  returns uuid
  language sql
  volatile
  security definer
  set search_path = pg_catalog, public
  as $$
    insert into auth.session (profile_id, auth_method) values (_profile_id, _auth_method) returning id
  $$;

----------------------------------------------------------------- claims_for_session
-- The per-request choke point: validate (revoked → idle → absolute) against the EXISTING
-- last_seen_at, touch it (throttled to ~1 write/session/hour — a single idempotent
-- conditional UPDATE, so parallel requests race harmlessly), then build the claims.
-- One DB round trip, replacing the claims-only call. Invalid/unknown/null session → null;
-- callers read null as unauthenticated (fail closed, never throw).
--
-- Lifetimes (single source of truth): touch-throttle 1h / idle 24h / absolute 7d.
create or replace function app_fn.claims_for_session(_session_id uuid)
  returns jsonb
  language plpgsql
  volatile
  security definer
  set search_path = pg_catalog, public
  as $$
  declare
    _session auth.session;
    _idle interval;
    _absolute interval;
  begin
    select * into _session from auth.session where id = _session_id;

    if _session.id is null then return null; end if;                                -- unknown
    if _session.revoked_at is not null then return null; end if;                    -- revoked

    -- Per-method lifetimes. zitadel: idle 24h / absolute 7d (unchanged). otp: sliding 1h idle /
    -- 8h absolute cap (spec .claude/specs/otp-login/ D2) — "good for an hour unless refreshed
    -- [by activity]", the cap forcing a fresh code eventually. Assigned after the select because
    -- they depend on _session.auth_method.
    if _session.auth_method = 'otp' then
      _idle := interval '1 hour'; _absolute := interval '8 hours';
    else
      _idle := interval '24 hours'; _absolute := interval '7 days';
    end if;

    if _session.last_seen_at < now() - _idle then return null; end if;              -- idle
    if _session.created_at < now() - _absolute then return null; end if;            -- absolute

    update auth.session set last_seen_at = now()
    where id = _session_id
    and last_seen_at < now() - interval '1 hour';

    return to_jsonb(app_fn.profile_claims_for_user(_session.profile_id));
  end;
  $$;

----------------------------------------------------------------- revoke_session
-- Called by logout with the sid from the unsealed cookie. Idempotent; unknown id is a no-op.
create or replace function app_fn.revoke_session(_session_id uuid)
  returns void
  language sql
  volatile
  security definer
  set search_path = pg_catalog, public
  as $$
    update auth.session set revoked_at = now()
    where id = _session_id
    and revoked_at is null
  $$;

-- Same grant shape as app_fn.provision_idp_user: callable by the login role pre-claims;
-- USAGE on app_fn was granted at 00000000010260_app_bootstrap.
grant execute on function app_fn.create_session(uuid, text) to authenticator;
grant execute on function app_fn.claims_for_session(uuid) to authenticator;
grant execute on function app_fn.revoke_session(uuid) to authenticator;

----------------------------------------------------------------- revoke_my_sessions
-- Post-claims "log out everywhere" (0180 Tier 2), two-layer per R8, exposed by PostGraphile
-- as the revokeMySessions mutation. Returns the number of sessions revoked.
create or replace function app_fn.revoke_my_sessions(_profile_id uuid)
  returns integer
  language plpgsql
  volatile
  security definer
  set search_path = pg_catalog, public
  as $$
  declare
    _count integer;
  begin
    update auth.session set revoked_at = now()
    where profile_id = _profile_id
    and revoked_at is null;
    get diagnostics _count = row_count;
    return _count;
  end;
  $$;

create or replace function app_api.revoke_my_sessions()
  returns integer
  language plpgsql
  volatile
  security invoker
  as $$
  begin
    -- Self-scoped: the gate is authentication itself (any logged-in profile may revoke its
    -- own sessions), not a licensed permission — a profile with no active residency still
    -- owns its sessions.
    if jwt.profile_id() is null then raise exception '30000: NOT AUTHORIZED'; end if;

    return app_fn.revoke_my_sessions(jwt.profile_id());
  end;
  $$;

commit;
