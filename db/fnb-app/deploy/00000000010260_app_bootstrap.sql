begin;

-- SECURITY DEFINER so it can be called by the authenticator login role before any
-- claims are set. Internally calls current_profile_claims which also runs as postgres.
CREATE OR REPLACE FUNCTION app_fn.profile_claims_for_user(_user_id uuid)
  RETURNS app_fn.profile_claims
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  AS $$
    SELECT app_fn.current_profile_claims(p.id)
    FROM app.profile p
    JOIN auth.user u ON u.email = p.email
    WHERE u.id = _user_id
  $$;

-- authenticator needs USAGE on app_fn schema and EXECUTE on this specific function.
-- The rest of app_fn is already granted to authenticated (used post-SET ROLE in withClaims).
GRANT USAGE ON SCHEMA app_fn TO authenticator;
GRANT EXECUTE ON FUNCTION app_fn.profile_claims_for_user(uuid) TO authenticator;

commit;
