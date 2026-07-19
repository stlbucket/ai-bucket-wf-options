--- auth policies
grant usage on schema auth to anon, authenticated, service_role;
grant all on all tables in schema auth to anon, authenticated, service_role;
grant all on all routines in schema auth to anon, authenticated, service_role;
grant all on all sequences in schema auth to anon, authenticated, service_role;
alter default privileges for role postgres in schema auth grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema auth grant all on routines to anon, authenticated, service_role;
alter default privileges for role postgres in schema auth grant all on sequences to anon, authenticated, service_role;

alter table auth.user enable row level security;
    CREATE POLICY view_self ON auth.user
      FOR SELECT
      USING (jwt.uid() = id);
    CREATE POLICY update_self ON auth.user
      FOR UPDATE
      USING (jwt.uid() = id)
      WITH CHECK (jwt.uid() = id)
      ;
    CREATE POLICY manage_all_super_admin ON auth.user
      FOR ALL
      USING (jwt.has_permission('p:app-admin-super'));

alter table auth.identities enable row level security;
    -- CREATE POLICY view_self ON auth.identities
    --   FOR SELECT
    --   USING (jwt.uid() = id);
    -- CREATE POLICY update_self ON auth.identities
    --   FOR UPDATE
    --   USING (jwt.uid() = id)
    --   WITH CHECK (jwt.uid() = id)
    --   ;
    -- CREATE POLICY manage_all_super_admin ON auth.identities
    --   FOR ALL
    --   USING (jwt.has_permission('p:app-admin-super'));
