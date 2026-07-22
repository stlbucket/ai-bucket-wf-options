-- Deploy fnb-app:00000000010300_app_fn_initialize_anchor to pg
-- requires: 00000000010290_session

-- First-run setup (spec: .claude/specs/first-run-setup/). Two pre-claims functions
-- that let a human bootstrap a VIRGIN environment (schema deployed, no anchor tenant,
-- no profiles, no ZITADEL roster) from /auth/setup. Same posture as
-- app_fn.provision_idp_user (00000000010270): SECURITY DEFINER, granted to the login
-- role, NO app_api wrapper, called only through db-access raw pg BEFORE any claims
-- exist. The ONLY gate is "no anchor tenant yet" — enforced hard in the DB here and
-- pre-checked (soft) + SETUP_TOKEN-gated in the auth-app Nitro endpoint.

begin;

-- Read helper: "does setup still need to run?" A single source of truth — an anchor
-- tenant exists. Pre-claims safe, no side effects, callable by the login role.
create or replace function app_fn.anchor_exists()
  returns boolean
  language sql
  stable
  security definer
  as $$ select exists(select 1 from app.tenant where type = 'anchor') $$;

grant execute on function app_fn.anchor_exists() to authenticator;

-- The initializer — the setup-time analog of what db/seed.sql does by hand for the
-- anchor super admin: create_anchor_tenant -> insert profile -> link resident ->
-- assume_residency. search_path is pinned to pg_catalog,public (NOT '') because the
-- citext operators live in public — an empty search_path breaks citext '=' resolution.
create or replace function app_fn.initialize_anchor(
    _tenant_name citext
    ,_email citext
    ,_display_name citext default null
    ,_first_name citext default null
    ,_last_name citext default null
    ,_phone citext default null
  )
  returns app.profile
  language plpgsql
  volatile
  security definer
  set search_path = pg_catalog, public
  as $function$
  declare
    _profile app.profile;
    _resident app.resident;
  begin
    -- HARD GATE: this is an unauthenticated entry point. It may ONLY ever run on a
    -- virgin environment. Once an anchor tenant exists it is inert forever.
    if exists (select 1 from app.tenant where type = 'anchor') then
      raise exception 'SETUP_ALREADY_COMPLETE' using errcode = '42501';
    end if;

    if _tenant_name is null or _email is null then
      raise exception 'initialize_anchor: _tenant_name and _email are required';
    end if;

    -- 1. Installs the base application idempotently, creates the anchor tenant,
    --    subscribes it to the anchor + auto-subscribe (base) packs, and invites
    --    _email at superadmin scope (creates the superadmin resident + license).
    perform app_fn.create_anchor_tenant(_tenant_name, _email);

    -- 2. Create the profile directly in app.profile (no auth.user; ZITADEL owns
    --    credentials). idp_user_id stays null — it links on first OIDC login via
    --    app_fn.provision_idp_user's email match.
    insert into app.profile (email, display_name, first_name, last_name, phone)
    values (
      _email
      ,coalesce(_display_name, split_part(_email, '@', 1)::citext)
      ,_first_name
      ,_last_name
      ,_phone
    )
    returning * into _profile;

    -- 3. Link the just-created superadmin resident to the profile (what the retired
    --    handle_new_user trigger / provision_idp_user step 3 does).
    update app.resident set
      profile_id = _profile.id
    where email = _email
      and status != 'blocked_individual'
      and status != 'blocked_tenant'
    ;

    -- 4. Activate residency so the first login lands straight in (seed.sql does this too).
    select * into _resident
    from app.resident
    where email = _email and profile_id = _profile.id
    limit 1;
    perform app_fn.assume_residency(_resident.id, _email);

    return _profile;
  end;
  $function$;

grant execute on function app_fn.initialize_anchor(citext, citext, citext, citext, citext, citext)
  to authenticator;

commit;
