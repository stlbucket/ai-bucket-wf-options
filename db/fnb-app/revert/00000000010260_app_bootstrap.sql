begin;

REVOKE EXECUTE ON FUNCTION app_fn.profile_claims_for_user(uuid) FROM authenticator;
REVOKE USAGE ON SCHEMA app_fn FROM authenticator;
DROP FUNCTION IF EXISTS app_fn.profile_claims_for_user(uuid);

commit;
