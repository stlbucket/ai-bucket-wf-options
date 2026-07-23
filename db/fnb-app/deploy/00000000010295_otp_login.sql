-- Deploy fnb-app:00000000010295_otp_login to pg
-- Link-driven, short-lived, app-owned OTP login (spec .claude/specs/otp-login/). A TENANT-SCOPED
-- auth.deep_link addresses a URN element (D13 — no assigned recipient; the link works for any
-- resident of the URN's tenant). The opener self-identifies with their own phone/email at request
-- time; the server matches it to a resident of the link's tenant and delivers the code there.
-- auth.otp_login is the pre-claims code store. Code generation + verification are ROOT OF TRUST
-- (they run before any session/claims exist) — same posture as app_fn.provision_idp_user /
-- create_session: SECURITY DEFINER, pinned search_path, granted to `authenticator`, NO app_api
-- wrapper, callable only via db-access raw pg. Delivery of the code rides the existing
-- send-notification n8n webhook (auth-app route), not the DB.
--
-- Cross-package note: recipient resolution reads notify.channel_preference / app.profile. fnb-notify
-- deploys AFTER fnb-app, but these are plpgsql bodies — references resolve at execution (login time,
-- well after notify has deployed), never at deploy time. Same pattern as the urn-registry app_fn
-- bodies calling res_fn before fnb-res deploys.

begin;

-- ─── Tables (deny-all RLS; reachable only via the SECURITY DEFINER fns below — like auth.session).
-- fnb-auth's 00000000010500 default privileges auto-grant ALL on new auth tables to
-- anon/authenticated/service_role, so revoke explicitly on top of the empty-policy RLS.

-- The TENANT-SCOPED shareable link (D13). subject_urn is plain text (no FK) to avoid coupling to
-- fnb-res's deploy order; it is validated by resolution at use time (URNs are immutable). subject_label
-- is a display cache set by the authenticated sender so the pre-claims landing page shows context
-- without an RLS read. target_tenant_id is the ONLY scope — there is no assigned recipient; the code
-- recipient is resolved at request time from the contact the opener enters (must be a resident of it).
create table auth.deep_link (
  id                     uuid primary key default gen_random_uuid(),
  subject_urn            text not null,
  subject_label          text,
  target_tenant_id       uuid not null references app.tenant (id),
  created_by_resident_id uuid not null references app.resident (id),
  expires_at             timestamptz not null,
  revoked_at             timestamptz,
  created_at             timestamptz not null default now()
);
create index on auth.deep_link (target_tenant_id);
alter table auth.deep_link enable row level security;
revoke all on auth.deep_link from anon, authenticated, service_role;

-- The OTP code store. Codes are bcrypt-hashed (never plaintext at rest), expiring, attempt-limited —
-- same shape as notify.phone_verification.
create table auth.otp_login (
  id           uuid primary key default gen_random_uuid(),
  deep_link_id uuid not null references auth.deep_link (id) on delete cascade,
  profile_id   uuid not null references app.profile (id) on delete cascade,
  channel      text not null check (channel in ('sms', 'email')),
  destination  text not null,
  code_hash    text not null,
  expires_at   timestamptz not null,
  attempts     integer not null default 0,
  consumed_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index on auth.otp_login (deep_link_id);
alter table auth.otp_login enable row level security;
revoke all on auth.otp_login from anon, authenticated, service_role;

-- ─── Composite return types (consumed only by db-access raw pg — never seen by PostGraphile:
-- app_fn is not an exposed schema).
-- No channel/destination — the link is tenant-scoped (D13), so there is no known recipient at
-- landing; the opener supplies their own contact at request time.
create type app_fn.deep_link_public as (
  id                 uuid,
  subject_urn        text,     -- the client parseUrn's the tenant/module/id from this
  subject_label      text,
  module             text,
  expired            boolean,
  revoked            boolean
);

-- `matched` = did the opener's contact map to a resident of the link's tenant. On a miss, the rest
-- are null (enumeration-safe — the route responds identically to a hit and sends nothing).
create type app_fn.otp_login_dispatch as (
  matched            boolean,
  code               text,     -- plaintext — returned to the auth-app server only, for delivery
  channel            text,
  destination_raw    text,     -- server-side only; never forwarded to the browser
  destination_masked text
);

create type app_fn.otp_login_result as (
  sid        uuid,
  profile_id uuid
);

-- ─── Helpers ─────────────────────────────────────────────────────────────────

-- Mask a delivery destination for display. ASCII-only (no unicode in SQL sources).
create or replace function app_fn.mask_destination(_channel text, _dest text)
  returns text language sql immutable as $$
  select case
    when _dest is null then null
    when _channel = 'sms' then '***' || right(_dest, 4)
    else left(_dest, 1) || '***@' || split_part(_dest, '@', 2)
  end;
$$;

-- D13 recipient resolution: match the contact the opener typed to a resident of the link's tenant,
-- then pick the channel from what they entered. Email path → any resident of _tenant_id whose
-- profile.email matches (case-insensitive). Phone path → a resident of _tenant_id with a verified
-- sms channel_preference (or app.profile.phone) whose destination matches (digits-only compare, so
-- formatting/'+' differences don't defeat it). No match → matched=false (caller stays silent —
-- enumeration-safe). References notify.* — plpgsql body, resolved at runtime (see header note).
create or replace function app_fn.resolve_tenant_recipient(
    _tenant_id uuid, _identifier text,
    out matched boolean, out profile_id uuid, out channel text, out destination text
  )
  language plpgsql stable security definer set search_path = pg_catalog, public as $$
  declare
    _id text := btrim(coalesce(_identifier, ''));
    _digits text := regexp_replace(_id, '[^0-9]', '', 'g');
  begin
    matched := false;
    if _id = '' then return; end if;

    if position('@' in _id) > 0 then
      -- email path
      select p.id, 'email', p.email
        into profile_id, channel, destination
      from app.resident r
      join app.profile p on p.id = r.profile_id
      where r.tenant_id = _tenant_id and lower(p.email) = lower(_id)
      limit 1;
    else
      -- phone path (verified sms preference first, else the profile phone)
      select p.id, 'sms', coalesce(cp.destination, p.phone)
        into profile_id, channel, destination
      from app.resident r
      join app.profile p on p.id = r.profile_id
      left join notify.channel_preference cp
        on cp.profile_id = p.id and cp.channel = 'sms' and cp.verified_at is not null
      where r.tenant_id = _tenant_id
        and length(_digits) >= 7
        and right(regexp_replace(coalesce(cp.destination, p.phone, ''), '[^0-9]', '', 'g'), 10)
            = right(_digits, 10)
      limit 1;
    end if;

    if profile_id is not null and destination is not null then
      matched := true;
    else
      profile_id := null; channel := null; destination := null;
    end if;
  end;
$$;

-- Pre-claims analog of app_fn.assume_residency (00000000010242_app_fn_definers.sql:77), keyed by
-- (profile_id, tenant_id) instead of (resident_id, email): activate the profile's residency in the
-- URN's tenant (deactivating its other active/supporting residencies), repoint licenses. Raises
-- NO_RESIDENCY_IN_TENANT if the profile holds no enterable residency there (caller → 403).
create or replace function app_fn.activate_profile_residency_in_tenant(_profile_id uuid, _tenant_id uuid)
  returns app.resident language plpgsql volatile security definer
  set search_path = pg_catalog, public as $$
  declare
    _resident app.resident;
  begin
    select * into _resident from app.resident
      where profile_id = _profile_id and tenant_id = _tenant_id
        and status in ('invited', 'active', 'inactive', 'supporting')
      limit 1;
    if _resident.id is null then
      raise exception 'NO_RESIDENCY_IN_TENANT: profile=% tenant=%', _profile_id, _tenant_id;
    end if;

    update app.resident set status = 'inactive', updated_at = current_timestamp
      where profile_id = _profile_id and status in ('active', 'supporting') and id != _resident.id;

    update app.resident set status = 'active', updated_at = current_timestamp
      where id = _resident.id returning * into _resident;

    update app.license set profile_id = _resident.profile_id
      where resident_id in (select id from app.resident where email = _resident.email);

    return _resident;
  end;
$$;

-- ─── Pre-claims root of trust (granted to authenticator; db-access raw pg only) ──

-- Public projection for the landing page. Never returns raw destination / profile id / tenant id.
-- Unknown id → a dead (expired+revoked) row: no enumeration signal beyond "dead".
create or replace function app_fn.get_deep_link(_id uuid)
  returns app_fn.deep_link_public language plpgsql stable security definer
  set search_path = pg_catalog, public as $$
  declare
    _dl auth.deep_link;
    _out app_fn.deep_link_public;
  begin
    select * into _dl from auth.deep_link where id = _id;
    if _dl.id is null then
      _out.expired := true; _out.revoked := true;
      return _out;
    end if;

    _out.id := _dl.id;
    _out.subject_urn := _dl.subject_urn;
    _out.subject_label := _dl.subject_label;
    _out.module := split_part(_dl.subject_urn, ':', 4);
    _out.expired := (_dl.expires_at < now());
    _out.revoked := (_dl.revoked_at is not null);
    return _out;
  end;
$$;

-- Mint + persist a code; return the plaintext to the caller (auth-app server) for delivery. The
-- opener supplies _identifier (their own phone/email); it must match a resident of the link's tenant
-- (D13). No match → matched=false, nothing sent (enumeration-safe — the route responds identically).
-- 60s resend cooldown per (link, profile); invalidates prior unconsumed codes for that profile.
-- Raises only on a dead link (already surfaced as expired/revoked by get_deep_link).
create or replace function app_fn.request_otp_login(_deep_link_id uuid, _identifier text)
  returns app_fn.otp_login_dispatch language plpgsql volatile security definer
  set search_path = pg_catalog, public as $$
  declare
    _dl auth.deep_link;
    _rcpt record;
    _code text := lpad((floor(random() * 1000000))::int::text, 6, '0');
    _recent auth.otp_login;
    _out app_fn.otp_login_dispatch;
  begin
    _out.matched := false;

    select * into _dl from auth.deep_link where id = _deep_link_id;
    if _dl.id is null or _dl.revoked_at is not null or _dl.expires_at < now() then
      raise exception 'DEEP_LINK_UNAVAILABLE' using errcode = 'check_violation';
    end if;

    select * into _rcpt
      from app_fn.resolve_tenant_recipient(_dl.target_tenant_id, _identifier);
    if not _rcpt.matched then
      return _out;  -- matched=false; caller sends nothing
    end if;

    select * into _recent from auth.otp_login
      where deep_link_id = _deep_link_id and profile_id = _rcpt.profile_id and consumed_at is null
      order by created_at desc limit 1;
    if _recent.id is not null and _recent.created_at > now() - interval '60 seconds' then
      raise exception 'RESEND_COOLDOWN' using errcode = 'check_violation';
    end if;

    update auth.otp_login set consumed_at = now()
      where deep_link_id = _deep_link_id and profile_id = _rcpt.profile_id and consumed_at is null;

    insert into auth.otp_login (deep_link_id, profile_id, channel, destination, code_hash, expires_at)
    values (_deep_link_id, _rcpt.profile_id, _rcpt.channel, _rcpt.destination,
            crypt(_code, gen_salt('bf')), now() + interval '10 minutes');

    _out.matched := true;
    _out.code := _code;
    _out.channel := _rcpt.channel;
    _out.destination_raw := _rcpt.destination;
    _out.destination_masked := app_fn.mask_destination(_rcpt.channel, _rcpt.destination);
    return _out;
  end;
$$;

-- Check the newest unconsumed code for the link. On success: consume it, activate the URN's tenant
-- as the workspace, mint an OTP session, and return (sid, profile_id). Bad/expired/attempts-exhausted
-- code → a NULL result (caller → 401). A no-residency raise from activate_* propagates (caller → 403).
create or replace function app_fn.verify_otp_login(_deep_link_id uuid, _code text)
  returns app_fn.otp_login_result language plpgsql volatile security definer
  set search_path = pg_catalog, public as $$
  declare
    _dl auth.deep_link;
    _row auth.otp_login;
    _out app_fn.otp_login_result;
  begin
    select * into _dl from auth.deep_link where id = _deep_link_id;
    if _dl.id is null or _dl.revoked_at is not null or _dl.expires_at < now() then
      return _out;   -- null result
    end if;

    select * into _row from auth.otp_login
      where deep_link_id = _deep_link_id and consumed_at is null
      order by created_at desc limit 1;

    if _row.id is null then return _out; end if;
    if _row.expires_at < now() then return _out; end if;
    if _row.attempts >= 5 then return _out; end if;

    if _row.code_hash <> crypt(_code, _row.code_hash) then
      update auth.otp_login set attempts = attempts + 1 where id = _row.id;
      return _out;
    end if;

    update auth.otp_login set consumed_at = now() where id = _row.id;

    -- Make the item's workspace active before the first claims build (raises → caller 403). The
    -- profile is the one resolved from the opener's contact at request time (_row.profile_id, D13).
    perform app_fn.activate_profile_residency_in_tenant(_row.profile_id, _dl.target_tenant_id);

    _out.sid := app_fn.create_session(_row.profile_id, 'otp');
    _out.profile_id := _row.profile_id;
    return _out;
  end;
$$;

-- Session metadata for the temporary-session banner (the sid lives in the sealed cookie, not claims,
-- so the banner reads via an auth-app route, not GraphQL). expires_at = the sooner of the idle window
-- and the absolute cap for this session's auth_method. Revoked/unknown → null.
create or replace function app_fn.session_info(_session_id uuid)
  returns jsonb language plpgsql stable security definer
  set search_path = pg_catalog, public as $$
  declare
    _s auth.session;
    _idle interval; _absolute interval;
  begin
    select * into _s from auth.session where id = _session_id;
    if _s.id is null or _s.revoked_at is not null then return null; end if;

    if _s.auth_method = 'otp' then
      _idle := interval '1 hour'; _absolute := interval '8 hours';
    else
      _idle := interval '24 hours'; _absolute := interval '7 days';
    end if;

    return jsonb_build_object(
      'auth_method', _s.auth_method,
      'created_at', _s.created_at,
      'last_seen_at', _s.last_seen_at,
      'expires_at', least(_s.last_seen_at + _idle, _s.created_at + _absolute)
    );
  end;
$$;

-- ─── Deep-link creation (post-claims; two-layer per R8) ──────────────────────

-- SECURITY DEFINER worker: tenant-scoped (D13) — no recipient. The tenant comes from the URN
-- (segment 3), cache the label. Any resident of that tenant can later use the link.
create or replace function app_fn.create_deep_link(
    _subject_urn text, _created_by_resident_id uuid,
    _subject_label text default null, _ttl interval default interval '7 days'
  )
  returns uuid language plpgsql volatile security definer
  set search_path = pg_catalog, public as $$
  declare
    _id uuid;
  begin
    insert into auth.deep_link (
      subject_urn, subject_label, target_tenant_id, created_by_resident_id, expires_at
    ) values (
      _subject_urn, _subject_label, (split_part(_subject_urn, ':', 3))::uuid,
      _created_by_resident_id, now() + _ttl
    ) returning id into _id;
    return _id;
  end;
$$;

-- SECURITY INVOKER surface (PostGraphile mutation createDeepLink). Returns the new link's uuid; the
-- client builds ${authAppUrl}/go/<id>. Gate: an app-user of the URN's own tenant.
create or replace function app_api.create_deep_link(
    _subject_urn text, _subject_label text default null
  )
  returns uuid language plpgsql volatile security invoker as $$
  begin
    -- any-of gate (mirrors the game-event trigger): admins hold p:app-admin but NOT the base
    -- p:app-user, yet can obviously share an item they can see. Tenant scoping is enforced below.
    perform jwt.enforce_any_permission(array['p:app-user', 'p:app-admin']::citext[]);
    if (split_part(_subject_urn, ':', 3))::uuid <> jwt.tenant_id() then
      raise exception 'SUBJECT_NOT_IN_CURRENT_TENANT';
    end if;
    return app_fn.create_deep_link(_subject_urn, jwt.resident_id(), _subject_label);
  end;
$$;

-- ─── Targeted send (D14) — recipient resolution for the send-deep-link n8n workflow ──────────
-- The "Send to residents" modal creates the tenant-scoped link (createDeepLink), then triggers the
-- send-deep-link workflow with { deepLinkId, url, subjectLabel, message, residentIds, channels }.
-- The workflow (as n8n_worker) calls this to resolve each selected resident's deliverable contact
-- per requested channel, then loops the send-notification webhook. One row per (resident × channel)
-- that has a deliverable contact; residents with no contact for a channel are simply absent
-- ("skipped"). Scoped to _tenant_id — foreign resident ids yield no rows.
create or replace function app_fn.resolve_send_recipients(
    _tenant_id uuid, _resident_ids uuid[], _channels text[]
  )
  returns table (resident_id uuid, profile_id uuid, channel text, destination text, name text)
  language plpgsql stable security definer set search_path = pg_catalog, public as $$
  begin
    return query
    with picked as (
      -- cast citext (email) → text so the RETURNS TABLE (text) columns type-match under RETURN QUERY
      select r.id as resident_id, p.id as profile_id, p.email::text as email, p.phone,
             coalesce(p.display_name, p.email::text) as name
      from app.resident r
      join app.profile p on p.id = r.profile_id
      where r.tenant_id = _tenant_id and r.id = any(_resident_ids)
    )
    select pk.resident_id, pk.profile_id, 'email'::text, pk.email, pk.name::text
      from picked pk
      where 'email' = any(_channels) and pk.email is not null
    union all
    select pk.resident_id, pk.profile_id, 'sms'::text,
           coalesce(cp.destination, pk.phone)::text, pk.name::text
      from picked pk
      left join notify.channel_preference cp
        on cp.profile_id = pk.profile_id and cp.channel = 'sms' and cp.verified_at is not null
      where 'sms' = any(_channels) and coalesce(cp.destination, pk.phone) is not null;
  end;
$$;

-- ─── Grants ──────────────────────────────────────────────────────────────────
-- Pre-claims root of trust: callable by the login role (db-access raw pg), like create_session.
grant execute on function app_fn.get_deep_link(uuid) to authenticator;
grant execute on function app_fn.request_otp_login(uuid, text) to authenticator;
grant execute on function app_fn.verify_otp_login(uuid, text) to authenticator;
grant execute on function app_fn.session_info(uuid) to authenticator;

-- Post-claims surface: the invoker api + the definer worker it calls (mirrors the notify_fn
-- explicit-grant precedent so the INVOKER→DEFINER hop resolves for authenticated callers).
grant execute on function app_api.create_deep_link(text, text) to anon, authenticated, service_role;
grant execute on function app_fn.create_deep_link(text, uuid, text, interval) to authenticated, service_role;

commit;
