begin;

-- Login role used by the application — non-superuser, so RLS is enforced
-- NOINHERIT means it does NOT automatically get permissions from anon/authenticated;
-- it must explicitly SET ROLE to use them, which happens inside withClaims transactions.
CREATE ROLE authenticator WITH LOGIN PASSWORD 'authenticator' NOINHERIT;

GRANT anon TO authenticator;
GRANT authenticated TO authenticator;

-- authenticated and anon need to call auth.* functions referenced in RLS policies
GRANT USAGE ON SCHEMA auth TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO authenticated, anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA auth GRANT EXECUTE ON FUNCTIONS TO authenticated, anon;

commit;
