begin;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA auth REVOKE EXECUTE ON FUNCTIONS FROM authenticated, anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA auth FROM authenticated, anon;
REVOKE USAGE ON SCHEMA auth FROM authenticated, anon;

REVOKE anon FROM authenticator;
REVOKE authenticated FROM authenticator;
DROP ROLE IF EXISTS authenticator;

commit;
