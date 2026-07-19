begin;

-- ZITADEL `sub` (numeric-string snowflake — NOT a uuid) ↔ app.profile mapping.
-- Spec: .claude/specs/future-auth/zitadel-login-pattern.md → Identity mapping.
alter table app.profile add column idp_user_id text unique;

-- Pre-claims root of trust (global-rules R5 carve-out): called by auth-app's OIDC
-- callback through db-access raw pg BEFORE any claims exist, so there is
-- deliberately NO app_api wrapper and no jwt.* gate. The callback trusts only a
-- verified id_token (email_verified enforced there).
--
-- search_path is pinned to pg_catalog,public rather than '' because the citext
-- operators live in public (db/fnb-auth extensions) — an empty search_path breaks
-- citext '=' resolution at runtime. All object references are schema-qualified.
--
-- 1. profile already linked by idp_user_id  → return it
-- 2. profile exists by email                → adopt: set idp_user_id (first OIDC
--    login of every pre-existing/seeded user)
-- 3. brand-new                              → create profile + link pending
--    invitations (mirrors app_fn.handle_new_user)
create or replace function app_fn.provision_idp_user(
    _idp_user_id text
    ,_email citext
    ,_display_name citext default null
  )
  returns app.profile
  language plpgsql
  volatile
  security definer
  set search_path = pg_catalog, public
  as $$
  declare
    _profile app.profile;
  begin
    if _idp_user_id is null or _email is null then
      raise exception 'provision_idp_user: _idp_user_id and _email are required';
    end if;

    select * into _profile from app.profile where idp_user_id = _idp_user_id;
    if _profile.id is not null then
      return _profile;
    end if;

    update app.profile set
      idp_user_id = _idp_user_id
      ,updated_at = current_timestamp
    where email = _email
    returning * into _profile;
    if _profile.id is not null then
      return _profile;
    end if;

    insert into app.profile (email, display_name, idp_user_id)
    values (_email, coalesce(_display_name, split_part(_email, '@', 1)::citext), _idp_user_id)
    returning * into _profile;

    -- same pending-invitation linking as app_fn.handle_new_user
    update app.resident set
      profile_id = _profile.id
    where email = _email
    and status != 'blocked_individual'
    and status != 'blocked_tenant'
    ;

    return _profile;
  end;
  $$;

-- Same grant shape as app_fn.profile_claims_for_user (00000000010260_app_bootstrap):
-- callable by the login role pre-claims; USAGE on app_fn is already granted there.
grant execute on function app_fn.provision_idp_user(text, citext, citext) to authenticator;

commit;
