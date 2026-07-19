begin;

-- Stage-5 cutover of .claude/specs/future-auth/zitadel-login-pattern.md: ZITADEL owns
-- authentication (passwords, verification, recovery, MFA). The local password/identity
-- machinery is removed. The `session` cookie now always carries an app.profile id minted
-- by the OIDC callback (app_fn.provision_idp_user); nothing joins auth.user anymore.
-- On a fresh database this change replays AFTER fnb-auth creates auth.user and after
-- fnb-app's 00000000010242 creates the trigger — so the drops below always resolve.

-- 1. profile_claims_for_user was keyed by auth.user.id and joined to app.profile by email.
--    Session ids ARE profile ids now — resolve directly. Same signature/grants; still
--    returns null (→ unauthenticated) when the profile does not exist.
CREATE OR REPLACE FUNCTION app_fn.profile_claims_for_user(_user_id uuid)
  RETURNS app_fn.profile_claims
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  AS $$
    SELECT app_fn.current_profile_claims(p.id)
    FROM app.profile p
    WHERE p.id = _user_id
  $$;

-- 2. site_user_by_id sourced its authUser payload from auth.user — now from app.profile.
--    Auth-only fields (role, email_confirmed_at, last_sign_in_at) disappear from the JSON;
--    the site-admin user page renders those as '—'.
CREATE OR REPLACE FUNCTION app_fn.site_user_by_id(_id uuid)
    RETURNS jsonb
    LANGUAGE plpgsql
    stable
    SECURITY DEFINER
    AS $$
    DECLARE
      _result jsonb;
      _auth_user jsonb;
      _residency_info jsonb[];
      _resident app.resident;
    BEGIN
      select to_jsonb(p.*) into _auth_user from app.profile p where p.id = _id;

      _residency_info = '{}'::jsonb[];
      for _resident in
        select * from app.resident where profile_id = _id
      loop
        _residency_info := array_append(_residency_info, to_jsonb(_resident));
      end loop;

      _result = jsonb_build_object(
        'authUser', _auth_user,
        'residencies', _residency_info
      );
      return _result;
    end;
    $$;

-- 3. drop the password/identity machinery
drop trigger if exists on_auth_user_created on auth.user;
drop function if exists app_fn.handle_new_user();
drop function if exists auth.login_user(citext, text);
drop table if exists auth.identities;
drop table if exists auth.user;

commit;
