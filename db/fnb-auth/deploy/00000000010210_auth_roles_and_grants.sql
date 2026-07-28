begin;

-- Login role used by the application — non-superuser, so RLS is enforced
-- NOINHERIT means it does NOT automatically get permissions from anon/authenticated;
-- it must explicitly SET ROLE to use them, which happens inside withClaims transactions.
-- Guarded: roles are CLUSTER-level and survive a DB drop, so a DB-only rebuild (dev
-- `pnpm db-rebuild` / prod `pnpm do-db-rebuild`) re-deploys into a cluster where
-- authenticator already exists. Same lesson as n8n_worker (fnb-n8n policies); an existing
-- role's password is left as-is (pg-bootstrap ensure_role posture).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator WITH LOGIN PASSWORD 'authenticator' NOINHERIT;
  END IF;
END
$$;

GRANT anon TO authenticator;
GRANT authenticated TO authenticator;

-- authenticated and anon need to call auth.* functions referenced in RLS policies
GRANT USAGE ON SCHEMA auth TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT EXECUTE ON FUNCTIONS TO authenticated, anon;

commit;
