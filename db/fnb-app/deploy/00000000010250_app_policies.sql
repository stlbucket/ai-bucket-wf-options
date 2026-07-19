-- app_api policies
grant usage on schema app_api to anon, authenticated, service_role;
grant all on all tables in schema app_api to anon, authenticated, service_role;
grant all on all routines in schema app_api to anon, authenticated, service_role;
grant all on all sequences in schema app_api to anon, authenticated, service_role;
alter default privileges for role postgres in schema app_api grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema app_api grant all on routines to anon, authenticated, service_role;
alter default privileges for role postgres in schema app_api grant all on sequences to anon, authenticated, service_role;

--- app_fn policies
grant usage on schema app_fn to anon, authenticated, service_role;
grant all on all tables in schema app_fn to anon, authenticated, service_role;
grant all on all routines in schema app_fn to anon, authenticated, service_role;
grant all on all sequences in schema app_fn to anon, authenticated, service_role;
alter default privileges for role postgres in schema app_fn grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema app_fn grant all on routines to anon, authenticated, service_role;
alter default privileges for role postgres in schema app_fn grant all on sequences to anon, authenticated, service_role;

--- app policies
grant usage on schema app to anon, authenticated, service_role;
grant all on all tables in schema app to anon, authenticated, service_role;
grant all on all routines in schema app to anon, authenticated, service_role;
grant all on all sequences in schema app to anon, authenticated, service_role;
alter default privileges for role postgres in schema app grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema app grant all on routines to anon, authenticated, service_role;
alter default privileges for role postgres in schema app grant all on sequences to anon, authenticated, service_role;

------------------------------------------------------------------------ profile
alter table app.profile enable row level security;
    CREATE POLICY view_self ON app.profile
      FOR SELECT
      USING (jwt.uid() = id);
    CREATE POLICY update_self ON app.profile
      FOR UPDATE
      USING (jwt.uid() = id)
      WITH CHECK (jwt.uid() = id)
      ;
    CREATE POLICY manage_all_super_admin ON app.profile
      FOR ALL
      USING (jwt.has_permission('p:app-admin-super'));
------------------------------------------------------------------------ resident
alter table app.resident enable row level security;
    CREATE POLICY view_own_resident_email ON app.resident
      FOR SELECT
      USING (jwt.jwt()->>'email' = email and jwt.tenant_id() = tenant_id);
    CREATE POLICY view_own_resident ON app.resident
      FOR SELECT
      USING (jwt.uid() = profile_id and type != 'support' and jwt.tenant_id() = tenant_id);
    CREATE POLICY update_own_resident ON app.resident
      FOR UPDATE
      USING (jwt.uid() = profile_id)
      WITH CHECK (jwt.uid() = profile_id);
    CREATE POLICY manage_own_tenant_residencies ON app.resident
      FOR ALL
      USING (jwt.has_permission('p:app-admin', tenant_id) and type != 'support');
    CREATE POLICY manage_all_super_admin ON app.resident
      FOR ALL
      USING (jwt.has_permission('p:app-admin-super'));
    CREATE POLICY view_all_for_tenant ON app.resident
      FOR SELECT
      USING (jwt.tenant_id() = tenant_id)
      ;
    -- parent admins see residents of direct-child workspaces (select only)
    CREATE POLICY view_child_workspace_residents ON app.resident
      FOR SELECT
      USING (jwt.has_permission('p:app-admin') and tenant_id in
        (select id from app.tenant t where t.parent_tenant_id = jwt.tenant_id()));
------------------------------------------------------------------------ tenant
alter table app.tenant enable row level security;
    CREATE POLICY view_own_tenant_user ON app.tenant
      FOR SELECT
      USING (jwt.has_permission('p:app-user', id));
    CREATE POLICY manage_own_tenant_admin ON app.tenant
      FOR ALL
      USING (jwt.has_permission('p:app-admin', id));
    CREATE POLICY manage_tenant ON app.tenant
      FOR ALL
      USING (jwt.has_permission('p:app-admin-super'));
    -- parent admins see direct-child workspaces (select only; writes go through app_api.*_workspace)
    CREATE POLICY view_child_workspaces ON app.tenant
      FOR SELECT
      USING (jwt.has_permission('p:app-admin') and parent_tenant_id = jwt.tenant_id());
------------------------------------------------------------------------ tenant_subscription
alter table app.tenant_subscription enable row level security;
    CREATE POLICY view_own_tenant_subscriptions ON app.tenant_subscription
      FOR SELECT
      USING (jwt.has_permission('p:app-admin', tenant_id));
    CREATE POLICY manage_tenant_subscription ON app.tenant_subscription
      FOR ALL
      USING (jwt.has_permission('p:app-admin-super'));
    -- parent admins see subscriptions of direct-child workspaces (select only)
    CREATE POLICY view_child_workspace_subscriptions ON app.tenant_subscription
      FOR SELECT
      USING (jwt.has_permission('p:app-admin') and tenant_id in
        (select id from app.tenant t where t.parent_tenant_id = jwt.tenant_id()));
------------------------------------------------------------------------ license
alter table app.license enable row level security;
    CREATE POLICY view_own_profile_licenses ON app.license
      FOR ALL
      USING (jwt.profile_id() = profile_id);
    CREATE POLICY view_own_tenant_licenses ON app.license
      FOR ALL
      USING (jwt.has_permission('p:app-admin', tenant_id));
    CREATE POLICY manage_license ON app.license
      FOR ALL
      USING (jwt.has_permission('p:app-admin-super'));
    -- parent admins see licenses of direct-child workspaces (select only)
    CREATE POLICY view_child_workspace_licenses ON app.license
      FOR SELECT
      USING (jwt.has_permission('p:app-admin') and tenant_id in
        (select id from app.tenant t where t.parent_tenant_id = jwt.tenant_id()));
------------------------------------------------------------------------ application
alter table app.application enable row level security;
    CREATE POLICY view_all_users ON app.application
      FOR SELECT
      USING (1=1);
------------------------------------------------------------------------ license_pack
alter table app.license_pack enable row level security;
    CREATE POLICY view_all_users ON app.license_pack
      FOR SELECT
      USING (1=1);
------------------------------------------------------------------------ license_pack_license_type
alter table app.license_pack_license_type enable row level security;
    CREATE POLICY view_all_users ON app.license_pack_license_type
      FOR SELECT
      USING (1=1);
------------------------------------------------------------------------ license_type
alter table app.license_type enable row level security;
    CREATE POLICY view_all_users ON app.license_type
      FOR SELECT
      USING (1=1);
------------------------------------------------------------------------ license_type_permission
alter table app.license_type_permission enable row level security;
    CREATE POLICY view_all_users ON app.license_type_permission
      FOR SELECT
      USING (1=1);
------------------------------------------------------------------------ permission
alter table app.permission enable row level security;
    CREATE POLICY view_all_users ON app.permission
      FOR SELECT
      USING (1=1);
------------------------------------------------------------------------ support_ticket
alter table app.support_ticket enable row level security;
    CREATE POLICY view_own_tickets ON app.support_ticket
      FOR SELECT
      USING (jwt.resident_id() = resident_id);
    CREATE POLICY manage_own_tickets ON app.support_ticket
      FOR ALL
      USING (jwt.resident_id() = resident_id);
    CREATE POLICY view_tenant_tickets ON app.support_ticket
      FOR SELECT
      USING (jwt.has_permission('p:app-admin', tenant_id));
    CREATE POLICY manage_tenant_tickets ON app.support_ticket
      FOR ALL
      USING (jwt.has_permission('p:app-admin', tenant_id));
    CREATE POLICY manage_all_support ON app.support_ticket
      FOR ALL
      USING (jwt.has_permission('p:app-admin-support'));
------------------------------------------------------------------------ support_ticket_comment
alter table app.support_ticket_comment enable row level security;
    CREATE POLICY manage_own_comments ON app.support_ticket_comment
      FOR ALL
      USING (jwt.resident_id() = resident_id);
    CREATE POLICY view_ticket_comments ON app.support_ticket_comment
      FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM app.support_ticket st
        WHERE st.id = support_ticket_id
        AND (
          st.resident_id = jwt.resident_id()
          OR jwt.has_permission('p:app-admin', st.tenant_id)
          OR jwt.has_permission('p:app-admin-support')
        )
      ));
    CREATE POLICY manage_all_support_comments ON app.support_ticket_comment
      FOR ALL
      USING (jwt.has_permission('p:app-admin-support'));
