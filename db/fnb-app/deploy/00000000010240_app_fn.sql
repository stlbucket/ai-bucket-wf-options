----------------------------------- install_application ---  NO API
CREATE OR REPLACE FUNCTION app_fn.install_application(_application_info app_fn.application_info)
  RETURNS app.application
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $function$
  DECLARE
    _application app.application;
    _module_info app_fn.module_info;
    _tool_info app_fn.tool_info;
    _license_pack app.license_pack;
    _license_type_info app_fn.license_type_info;
    _license_pack_license_type_info app_fn.license_pack_license_type_info;
    _license_pack_info app_fn.license_pack_info;
    _permission_key citext;
  BEGIN
    insert into app.application(
        key
        ,name
      ) values (
        _application_info.key::citext
        ,_application_info.name::citext
      )
      on conflict(key)
      do update set
        name = _application_info.name
      returning *
      into _application
      ;

    foreach _module_info in array(coalesce(_application_info.modules,'{}'::app_fn.module_info[]))
    loop
      insert into app.module(
        key
        ,application_key
        ,name
        ,permission_keys
        ,default_icon_key
        ,ordinal
      ) values (
        _module_info.key
        ,_application.key
        ,_module_info.name
        ,coalesce(_module_info.permission_keys, '{}'::citext[])
        ,_module_info.default_icon_key
        ,_module_info.ordinal
      );

      foreach _tool_info in array(coalesce(_module_info.tools,'{}'::app_fn.tool_info[]))
      loop
        insert into app.tool(
          key
          ,module_key
          ,name
          ,permission_keys
          ,default_icon_key
          ,route
          ,ordinal
        ) values (
          _tool_info.key
          ,_module_info.key
          ,_tool_info.name
          ,_tool_info.permission_keys
          ,_tool_info.default_icon_key
          ,_tool_info.route
          ,_tool_info.ordinal
        );
      end loop;
    end loop;

    foreach _license_type_info in array(_application_info.license_type_infos)
    loop
      insert into app.license_type(
          application_key
          ,key
          ,display_name
          ,assignment_scope
        )
        values (
          _application_info.key
          ,_license_type_info.key
          ,_license_type_info.display_name
          ,_license_type_info.assignment_scope
        )
        on conflict(key)
        do nothing
        ;

      foreach _permission_key in array(_license_type_info.permissions)
      loop
        insert into app.permission(key)
          values (_permission_key)
          on conflict(key)
          do nothing
          ;

        insert into app.license_type_permission(license_type_key, permission_key)
          values
            (_license_type_info.key, _permission_key)
          on conflict(license_type_key, permission_key)
          do nothing
          ;
      end loop;
    end loop;

    foreach _license_pack_info in array(_application_info.license_pack_infos)
    loop
      insert into app.license_pack(key, display_name, description, auto_subscribe)
        values 
          (_license_pack_info.key, _license_pack_info.display_name, _license_pack_info.description, _license_pack_info.auto_subscribe)
        on conflict(key)
        do update set display_name = _license_pack_info.display_name
        returning * into _license_pack
        ;

      foreach _license_pack_license_type_info in array(_license_pack_info.license_pack_license_type_infos)
      loop
        insert into app.license_pack_license_type(
            license_pack_key
            ,license_type_key
            ,number_of_licenses
            ,expiration_interval_type
            ,expiration_interval_multiplier
          )
          values
            (
              _license_pack.key
              ,_license_pack_license_type_info.license_type_key
              ,_license_pack_license_type_info.number_of_licenses
              ,_license_pack_license_type_info.expiration_interval_type
              ,_license_pack_license_type_info.expiration_interval_multiplier
            )
          on conflict(license_pack_key, license_type_key)
          do nothing
          ;
      end loop;
    
    end loop;

    return _application;
  end;
  $function$
  ;

CREATE OR REPLACE FUNCTION app_fn.install_basic_application(
    _key citext
    ,_name citext
    ,_description citext
    ,_auto_subscribe boolean
    ,_modules app_fn.module_info[]
  )
  RETURNS app.application
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $function$
  DECLARE
    _application app.application;
  BEGIN
    _application := (
      select app_fn.install_application(
        _application_info => row(
          _key::citext
          ,_name::citext
          ,array[
            row(
              (_key||'-user')::citext
              ,(_name||' User')::citext
              ,('{"p:'||_key||'-user"}')::citext[]
              ,'user'::app.license_type_assignment_scope
            )::app_fn.license_type_info
            ,row(
              (_key||'-admin')::citext
              ,(_name||' Admin')::citext
              ,('{"p:'||_key||'-admin"}')::citext[]
              ,'admin'::app.license_type_assignment_scope
            )::app_fn.license_type_info
          ]::app_fn.license_type_info[]
          ,array[
            row(
              _key::citext
              ,_name::citext
              ,_description::citext
              ,array[
                row(
                  (_key||'-user')::citext
                  ,0::integer
                  ,'none'::app.expiration_interval_type
                  ,0::integer
                )::app_fn.license_pack_license_type_info
                ,row(
                  (_key||'-admin')::citext
                  ,0::integer
                  ,'none'::app.expiration_interval_type
                  ,0::integer
                )::app_fn.license_pack_license_type_info
              ]::app_fn.license_pack_license_type_info[]
              ,_auto_subscribe
            )::app_fn.license_pack_info
          ]::app_fn.license_pack_info[]
          ,_modules::app_fn.module_info[]
        )::app_fn.application_info)
      )
    ;

    return _application;
  end;
  $function$
  ;
----------------------------------- install_anchor_application ---  NO API
CREATE OR REPLACE FUNCTION app_fn.install_anchor_application()
  RETURNS app.application
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $function$
  DECLARE
    _application app.application;
  BEGIN
    _application := app_fn.install_application(
      _application_info => row(
        'base'::citext
        ,'bass'::citext
        ,array[
          row(
            'app-user'::citext
            ,'App User'::citext
            ,'{"p:app-user","p:todo","p:discussions"}'::citext[]
            ,'user'::app.license_type_assignment_scope
          )::app_fn.license_type_info
          ,row(
            'app-admin'::citext
            ,'App Admin'::citext
            ,'{"p:app-admin","p:todo","p:todo-admin","p:discussions","p:discussions-admin"}'::citext[]
            ,'admin'::app.license_type_assignment_scope
          )::app_fn.license_type_info
          ,row(
            'app-admin-super'::citext
            ,'App Super Admin'::citext
            ,'{"p:app-admin-super","p:app-admin","p:app-admin-support","p:todo","p:todo-admin","p:discussions","p:discussions-admin"}'::citext[]
            ,'superadmin'::app.license_type_assignment_scope
          )::app_fn.license_type_info
          ,row(
            'app-admin-support'::citext
            ,'App Support Admin'::citext
            ,'{"p:app-admin-support","p:todo","p:todo-admin","p:discussions","p:discussions-admin","p:exit-support"}'::citext[]
            ,'support'::app.license_type_assignment_scope
          )::app_fn.license_type_info
          ,row(
            'app-address-book'::citext
            ,'Address Book'::citext
            ,'{"p:address-book"}'::citext[]
            ,'all'::app.license_type_assignment_scope
          )::app_fn.license_type_info
          -- ,row(
          --   'app-is-support'::citext
          --   ,'Support'::citext
          --   ,'{"p:exit-support"}'::citext[]
          --   ,'all'::app.license_type_assignment_scope
          -- )::app_fn.license_type_info
        ]::app_fn.license_type_info[]
        ,array[
          row(
            'anchor'::citext
            ,'Anchor'::citext
            ,'Only the anchor tenant is subscribed to this license pack.'
            ,array[
              row(
                'app-admin-super'::citext
                ,0::integer
                ,'none'::app.expiration_interval_type
                ,0::integer
              )::app_fn.license_pack_license_type_info
              ,row(
                'app-admin-support'::citext
                ,0::integer
                ,'none'::app.expiration_interval_type
                ,0::integer
              )::app_fn.license_pack_license_type_info
            ]::app_fn.license_pack_license_type_info[]
            ,false
          )::app_fn.license_pack_info
          ,row(
            'base'::citext
            ,'bass'::citext
            ,'This is the core license pack that every platform tenant will be subscribed to. Alternate versions could be added.'
            ,array[
              row(
                'app-user'::citext
                ,0::integer
                ,'none'::app.expiration_interval_type
                ,0::integer
              )::app_fn.license_pack_license_type_info
              ,row(
                'app-admin'::citext
                ,0::integer
                ,'none'::app.expiration_interval_type
                ,0::integer
              )::app_fn.license_pack_license_type_info
              ,row(
                'app-address-book'::citext
                ,0::integer
                ,'none'::app.expiration_interval_type
                ,0::integer
              )::app_fn.license_pack_license_type_info
            ]::app_fn.license_pack_license_type_info[]
            ,true
          )::app_fn.license_pack_info
          ,row(
            'workspace'::citext
            ,'workspace'::citext
            ,'This is subscription is for nested workspaces.  Any tenant admin can create a nested workspace'
            ,array[
              row(
                'app-user'::citext
                ,0::integer
                ,'none'::app.expiration_interval_type
                ,0::integer
              )::app_fn.license_pack_license_type_info
              ,row(
                'app-admin'::citext
                ,0::integer
                ,'none'::app.expiration_interval_type
                ,0::integer
              )::app_fn.license_pack_license_type_info
            ]::app_fn.license_pack_license_type_info[]
            ,false
          )::app_fn.license_pack_info
        ]::app_fn.license_pack_info[]
        ,array[
          row(
            'admin'::citext
            ,'Administration'::citext
            ,'{"p:app-admin"}'::citext[]
            ,'i-lucide-shield'::citext
            ,10
            ,array[
              row('tenant-admin-users'::citext,'Users'::citext,'{"p:app-admin"}'::citext[],'i-lucide-users'::citext,'/tenant/admin/user',0)::app_fn.tool_info
              ,row('tenant-admin-licenses'::citext,'Licenses'::citext,'{"p:app-admin"}'::citext[],'i-lucide-users'::citext,'/tenant/admin/license',0)::app_fn.tool_info
              ,row('tenant-admin-subscription'::citext,'Subscription'::citext,'{"p:app-admin"}'::citext[],'i-lucide-users'::citext,'/tenant/admin/subscription',0)::app_fn.tool_info
              ,row('tenant-admin-workspaces'::citext,'Workspaces'::citext,'{"p:app-admin"}'::citext[],'i-lucide-network'::citext,'/tenant/admin/workspace',0)::app_fn.tool_info
              ,row('tenant-admin-asset-manager'::citext,'Asset Manager'::citext,'{"p:app-admin"}'::citext[],'i-lucide-grid-3x3'::citext,'/storage/assets',0)::app_fn.tool_info
            ]::app_fn.tool_info[]
          )::app_fn.module_info
          ,row(
            'site-admin'::citext
            ,'Super Admin'::citext
            ,'{"p:app-admin-super"}'::citext[]
            ,'i-lucide-shield-check'::citext
            ,9
            ,array[
              row('tenant-site-admin-tenants'::citext,'Tenants'::citext,'{"p:app-admin-super"}'::citext[],'i-lucide-building-2'::citext,'/tenant/site-admin/tenant',0)::app_fn.tool_info
              ,row('tenant-site-admin-users'::citext,'Users'::citext,'{"p:app-admin-super"}'::citext[],'i-lucide-building-2'::citext,'/tenant/site-admin/user',0)::app_fn.tool_info
              ,row('tenant-site-admin-applications'::citext,'Applications'::citext,'{"p:app-admin-super"}'::citext[],'i-lucide-building-2'::citext,'/tenant/site-admin/application',0)::app_fn.tool_info
              ,row('tenant-site-admin-graphql-dashboard'::citext,'GraphQL Dashboard'::citext,'{"p:app-admin-super"}'::citext[],'i-lucide-building-2'::citext,'/graphql-api/api/graphql',0)::app_fn.tool_info
              ,row('tenant-site-admin-asset-manager'::citext,'Asset Manager'::citext,'{"p:app-admin-super"}'::citext[],'i-lucide-grid-3x3'::citext,'/storage/assets',0)::app_fn.tool_info
              ,row('tenant-site-admin-wf-n8n'::citext,'Workflows'::citext,'{"p:app-admin-super"}'::citext[],'i-lucide-workflow'::citext,'/tenant/site-admin/wf-n8n',0)::app_fn.tool_info
              ,row('tenant-site-admin-send-test'::citext,'Send Test'::citext,'{"p:app-admin-super"}'::citext[],'i-lucide-send'::citext,'/tenant/site-admin/send-test',0)::app_fn.tool_info
              ,row('tenant-site-admin-sms-test'::citext,'SMS Test'::citext,'{"p:app-admin-super"}'::citext[],'i-lucide-message-square-text'::citext,'/tenant/site-admin/sms-test',0)::app_fn.tool_info
            ]::app_fn.tool_info[]
          )::app_fn.module_info
          ,row(
            'support'::citext
            ,'Support'::citext
            ,'{"p:app-user","p:app-admin"}'::citext[]
            ,'i-lucide-headphones'::citext
            ,8
            ,array[
              row('support-tickets'::citext,'Tickets'::citext,'{"p:app-user","p:app-admin"}'::citext[],'i-lucide-ticket'::citext,'/tenant/support/tickets',0)::app_fn.tool_info
            ]::app_fn.tool_info[]
          )::app_fn.module_info
          ,row(
            'tools'::citext
            ,'Tools'::citext
            ,'{"p:app-user","p:app-admin"}'::citext[]
            ,'i-lucide-message-square'::citext
            ,40
            ,array[
              row('disc-topics'::citext,'Discussions'::citext,'{"p:app-user","p:app-admin","p:discussions"}'::citext[],'i-lucide-messages-square'::citext,'/tenant/msg',0)::app_fn.tool_info
              ,row('locations'::citext,'Locations'::citext,'{"p:app-user","p:app-admin"}'::citext[],'i-lucide-map-pin'::citext,'/tenant/loc',0)::app_fn.tool_info
              ,row('todo'::citext,'Todo'::citext,'{"p:app-user","p:app-admin"}'::citext[],'i-lucide-tool-case'::citext,'/tenant/tools/todo',0)::app_fn.tool_info
            ]::app_fn.tool_info[]
          )::app_fn.module_info
          ,row(
            'datasets'::citext
            ,'Datasets'::citext
            ,'{"p:app-user","p:app-admin"}'::citext[]
            ,'i-lucide-database'::citext
            ,30
            ,array[
              row('tenant-datasets-breweries'::citext,'Breweries'::citext,'{"p:app-user","p:app-admin"}'::citext[],'i-lucide-beer'::citext,'/tenant/datasets/breweries',0)::app_fn.tool_info
              ,row('tenant-datasets-airports'::citext,'Airports'::citext,'{"p:app-user","p:app-admin"}'::citext[],'i-lucide-plane'::citext,'/tenant/datasets/airports',1)::app_fn.tool_info
            ]::app_fn.tool_info[]
          )::app_fn.module_info
          ,row(
            'games'::citext
            ,'Games'::citext
            ,'{"p:app-user","p:app-admin"}'::citext[]
            ,'i-lucide-gamepad-2'::citext
            ,35
            ,array[
              row('games-battleship'::citext,'Battleship'::citext,'{"p:app-user","p:app-admin"}'::citext[],'i-lucide-ship'::citext,'/tenant/games/battleship',0)::app_fn.tool_info
              ,row('games-tic-tac-toe'::citext,'Tic-Tac-Toe'::citext,'{"p:app-user","p:app-admin"}'::citext[],'i-lucide-hash'::citext,'/tenant/games/tic-tac-toe',1)::app_fn.tool_info
              ,row('games-checkers'::citext,'Checkers'::citext,'{"p:app-user","p:app-admin"}'::citext[],'i-lucide-circle-dot'::citext,'/tenant/games/checkers',2)::app_fn.tool_info
            ]::app_fn.tool_info[]
          )::app_fn.module_info
        ]::app_fn.module_info[]
      )::app_fn.application_info
    );

    return _application;
  end;
  $function$
  ;

----------------------------------- create_anchor_tenant ---  NO API
CREATE OR REPLACE FUNCTION app_fn.create_anchor_tenant(_name citext, _email citext default null)
  RETURNS app.tenant
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $function$
  DECLARE
    _application app.application;
    _tenant app.tenant;
  BEGIN
    select * into _tenant from app.tenant where type = 'anchor';
    if _tenant.id is null then
      _application := (select app_fn.install_anchor_application());
    --   -- create the app tenant
      insert into app.tenant(
        name
        ,identifier
        ,type
      ) values (
        _name
        ,'anchor'
        ,'anchor'
      ) returning * into _tenant
      ;
      perform res_fn.register_resource(_tenant.id, _tenant.id, 'app', 'tenant');

      perform app_fn.subscribe_tenant_to_license_pack(_tenant.id, 'anchor');
      perform app_fn.subscribe_tenant_to_license_pack(_tenant.id, key) from app.license_pack where auto_subscribe = true;

      perform app_fn.invite_user(_tenant.id, _email, 'superadmin');
    end if;
    
    return _tenant;
  end;
  $function$
  ;

----------------------------------- current_profile_claims
CREATE OR REPLACE FUNCTION app_api.current_profile_claims()
  RETURNS app_fn.profile_claims
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  AS $function$
  DECLARE
    _profile_claims app_fn.profile_claims;
  BEGIN
    _profile_claims = (select app_fn.current_profile_claims(jwt.uid()));
    return _profile_claims;
  end;
  $function$
  ;

CREATE OR REPLACE FUNCTION app_fn.current_profile_claims(_profile_id uuid)
  RETURNS app_fn.profile_claims
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  AS $function$
  DECLARE
    _profile app.profile;
    _resident app.resident;
    _home_resident app.resident;
    _profile_claims app_fn.profile_claims;
  BEGIN
    select * into _profile from app.profile where id = _profile_id;
    select * into _resident from app.resident where profile_id = _profile_id and status = 'active';
    select * into _home_resident from app.resident where profile_id = _profile_id and type = 'home';

    _profile_claims.email = _profile.email;
    _profile_claims.profile_status = (select status from app.profile where id = _profile_id);
    if _resident.id is not null then
      _profile_claims.display_name = _resident.display_name;
      _profile_claims.profile_id = _resident.profile_id;
      _profile_claims.tenant_id = _resident.tenant_id;
      _profile_claims.tenant_name = _resident.tenant_name;
      _profile_claims.resident_id = _resident.id;
      _profile_claims.permissions = (
        select array_agg(distinct ltp.permission_key)
        from app.license_type_permission ltp
        join app.license_type lt on lt.key = ltp.license_type_key
        join app.license l on l.license_type_key = lt.key
        where l.resident_id = _resident.id
        and l.status = 'active'
      );
      _profile_claims.actual_resident_id = _home_resident.id;
      _profile_claims.modules = (
        with module_keys as (
          select distinct m.key, m.ordinal
          from app.module m
          join app.application a on a.key = m.application_key
          join app.license_type lt on lt.application_key = a.key
          join app.license l on l.license_type_key = lt.key
          where l.resident_id = _resident.id
          and _profile_claims.permissions && m.permission_keys
          order by m.ordinal desc
        )
        select array_agg(row(
          m.key
          ,m.name
          ,m.permission_keys
          ,m.default_icon_key
          ,m.ordinal
          ,(
            with tool_keys as (
              select t.key, t.ordinal
              from app.tool t
              where module_key = m.key
              and _profile_claims.permissions && t.permission_keys
              order by t.ordinal desc
            )
            select array_agg(row(
              t.key
              ,t.name
              ,t.permission_keys
              ,t.default_icon_key
              ,t.route
              ,t.ordinal
            )::app_fn.tool_info)
            from tool_keys tk join app.tool t on tk.key = t.key
          )::app_fn.tool_info[]
        ))
        from module_keys mk join app.module m on mk.key = m.key
      );
    else
      _profile_claims.profile_id = _profile_id;
    end if;

    return _profile_claims;
  end;
  $function$
  ;
----------------------------------- available_modules
CREATE OR REPLACE FUNCTION app_api.available_modules()
  RETURNS app_fn.module_info[]
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  AS $function$
  DECLARE
    _modules app_fn.module_info[];
  BEGIN
    _modules = (select app_fn.available_modules(jwt.uid()));
    return _modules;
  end;
  $function$
  ;

CREATE OR REPLACE FUNCTION app_fn.available_modules(_profile_id uuid)
  RETURNS app_fn.module_info[]
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  AS $function$
  DECLARE
    _profile_claims app_fn.profile_claims;
    _modules app_fn.module_info[];
  BEGIN
    _profile_claims := app_fn.current_profile_claims(_profile_id);

    _modules = (
      with module_keys as (
        select distinct m.key, m.ordinal
        from app.module m
        join app.application a on a.key = m.application_key
        join app.license_type lt on lt.application_key = a.key
        join app.license l on l.license_type_key = lt.key
        where l.resident_id = _profile_claims.resident_id
        and _profile_claims.permissions && m.permission_keys
        order by m.ordinal desc
      )
      select array_agg(row(
        m.key
        ,m.name
        ,m.permission_keys
        ,m.default_icon_key
        ,m.ordinal
        ,(
          with tool_keys as (
            select t.key, t.ordinal
            from app.tool t
            where module_key = m.key
            and _profile_claims.permissions && t.permission_keys
            order by t.ordinal desc
          )
          select array_agg(row(
            t.key
            ,t.name
            ,t.permission_keys
            ,t.default_icon_key
            ,t.route
            ,t.ordinal
          )::app_fn.tool_info)
          from tool_keys tk join app.tool t on tk.key = t.key
          -- from app.tool t
          -- where module_key = m.key
          -- and _profile_claims.permissions && t.permission_keys
          -- group by t.ordinal
          -- order by t.ordinal desc
        )::app_fn.tool_info[]
      ))
      from module_keys mk join app.module m on mk.key = m.key
    );
    
    return _modules;
  end;
  $function$
  ;
----------------------------------- decline_invitation
CREATE OR REPLACE FUNCTION app_api.decline_invitation(_resident_id uuid)
  RETURNS app.resident
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $function$
  DECLARE
    _resident app.resident;
  BEGIN
    _resident := app_fn.decline_invitation(_resident_id);
    return _resident;
  end;
  $function$
  ;

CREATE OR REPLACE FUNCTION app_fn.decline_invitation(_resident_id uuid)
  RETURNS app.resident
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $function$
  DECLARE
    _resident app.resident;
  BEGIN
    update app.resident set 
      status = 'declined'
      ,updated_at = current_timestamp 
    where id = _resident_id 
    returning * 
    into _resident;

    return _resident;
  end;
  $function$
  ;

----------------------------------- create_tenant
CREATE OR REPLACE FUNCTION app_api.create_tenant(_name citext, _identifier citext default null, _email citext default null, _type app.tenant_type default 'customer'::app.tenant_type)
  RETURNS app.tenant
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $function$
  DECLARE
    _tenant app.tenant;
  BEGIN
    _tenant := app_fn.create_tenant(_name, _identifier, _email, _type);
    return _tenant;
  end;
  $function$
  ;

CREATE OR REPLACE FUNCTION app_fn.create_tenant(
  _name citext
  ,_identifier citext default null
  ,_email citext default null
  ,_type app.tenant_type default 'customer'::app.tenant_type
  )
  RETURNS app.tenant
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $function$
  DECLARE
    _tenant app.tenant;
  BEGIN
    -- check for an existing tenant by this name (root tenants only — workspace names are sibling-scoped)
    select * into _tenant from app.tenant where (name = _name and parent_tenant_id is null) or (_identifier is not null and identifier = _identifier);
    if _tenant.id is not null then
      raise exception '30002: APP TENANT WITH THIS NAME OR IDENTIFIER ALREADY EXISTS';
    end if;

    -- create the app tenant
    insert into app.tenant(
      name
      ,identifier
      ,type
    ) values (
      _name
      ,_identifier
      ,_type
    ) returning * into _tenant
    ;
    perform res_fn.register_resource(_tenant.id, _tenant.id, 'app', 'tenant');

    perform app_fn.subscribe_tenant_to_license_pack(_tenant.id, key) from app.license_pack where auto_subscribe = true;
    perform app_fn.invite_user(_tenant.id, _email, 'admin');

    return _tenant;
  end;
  $function$
  ;

----------------------------------- create_workspace
CREATE OR REPLACE FUNCTION app_api.create_workspace(_name citext, _identifier citext default null)
  RETURNS app.tenant
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $function$
  DECLARE
    _tenant app.tenant;
  BEGIN
    perform jwt.enforce_permission('p:app-admin');

    _tenant := app_fn.create_workspace(jwt.tenant_id(), _name, jwt.email(), _identifier);
    return _tenant;
  end;
  $function$
  ;

CREATE OR REPLACE FUNCTION app_fn.create_workspace(
  _parent_tenant_id uuid
  ,_name citext
  ,_creator_email citext
  ,_identifier citext default null
  )
  RETURNS app.tenant
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
        -- security definer: parent admins hold no INSERT right on app.tenant;
        -- same precedent as invite_user / subscribe_tenant_to_license_pack
  AS $function$
  DECLARE
    _parent_tenant app.tenant;
    _tenant app.tenant;
  BEGIN
    select * into _parent_tenant from app.tenant where id = _parent_tenant_id and status = 'active';
    if _parent_tenant.id is null then
      raise exception '31001: PARENT TENANT NOT ACTIVE';
    end if;

    -- name is sibling-scoped for workspaces
    select * into _tenant from app.tenant
    where (parent_tenant_id = _parent_tenant_id and name = _name)
       or (_identifier is not null and identifier = _identifier);
    if _tenant.id is not null then
      raise exception '30002: APP TENANT WITH THIS NAME OR IDENTIFIER ALREADY EXISTS';
    end if;

    insert into app.tenant(
      name
      ,identifier
      ,type
      ,parent_tenant_id
    ) values (
      _name
      ,_identifier
      ,'workspace'
      ,_parent_tenant_id
    ) returning * into _tenant
    ;
    perform res_fn.register_resource(_tenant.id, _tenant.id, 'app', 'tenant');

    -- workspaces subscribe to the workspace pack only (no auto_subscribe loop)
    perform app_fn.subscribe_tenant_to_license_pack(_tenant.id, 'workspace');

    -- creator becomes a guest resident with the app-admin license; skip the invitation ceremony
    perform app_fn.invite_user(_tenant.id, _creator_email, 'admin');
    update app.resident set
      status = 'inactive'
      ,updated_at = current_timestamp
    where tenant_id = _tenant.id and email = _creator_email and status = 'invited';

    return _tenant;
  end;
  $function$
  ;

----------------------------------- child_workspaces
CREATE OR REPLACE FUNCTION app_api.child_workspaces()
  RETURNS setof app.tenant
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  AS $function$
  BEGIN
    perform jwt.enforce_permission('p:app-admin');

    return query
    select t.*
    from app.tenant t
    where t.parent_tenant_id = jwt.tenant_id()
    order by t.name
    ;
  end;
  $function$
  ;

----------------------------------- subscribe_tenant_to_license_pack
CREATE OR REPLACE FUNCTION app_api.subscribe_tenant_to_license_pack(_tenant_id uuid, _license_pack_key citext)
  RETURNS app.tenant_subscription
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $function$
  DECLARE
    _tenant_subcription app.tenant_subscription;
  BEGIN
    _tenant_subcription := app_fn.subscribe_tenant_to_license_pack(_tenant_id, _license_pack_key);
    return _tenant_subcription;
  end;
  $function$
  ;

CREATE OR REPLACE FUNCTION app_fn.subscribe_tenant_to_license_pack(_tenant_id uuid, _license_pack_key citext)
  RETURNS app.tenant_subscription
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $function$
  DECLARE
    _tenant_subcription app.tenant_subscription;
    _profile app.profile;
    _resident_id uuid;
    _license_pack_license_type app.license_pack_license_type;
    _license_type_key citext;
  BEGIN
    insert into app.tenant_subscription(
      tenant_id
      ,license_pack_key
    ) values (
      _tenant_id
      ,_license_pack_key
    )
    returning * into _tenant_subcription
    ;

    for _license_type_key in
      select lplt.license_type_key
      from app.license_pack_license_type lplt
      join app.license_type lt on lt.key = lplt.license_type_key
      where lplt.license_pack_key = _license_pack_key
      and lt.assignment_scope = 'admin'
    loop
      for _resident_id in
        select distinct r.id
        from app.resident r
        join app.license l on l.resident_id = r.id
        where r.tenant_id = _tenant_id
        and r.status in ('invited', 'active')
        and r.type in ('home', 'guest')
        and l.license_type_key = 'app-admin'
      loop
        insert into app.license(
          tenant_id
          ,resident_id
          ,tenant_subscription_id
          ,license_type_key
        )
        select
          _tenant_id
          ,_resident_id
          ,_tenant_subcription.id
          ,_license_type_key
        on conflict (resident_id, license_type_key) DO UPDATE SET updated_at = EXCLUDED.updated_at
        ;
      end loop;
    end loop;

    for _license_type_key in
      select lplt.license_type_key
      from app.license_pack_license_type lplt
      join app.license_type lt on lt.key = lplt.license_type_key
      where lplt.license_pack_key = _license_pack_key
      and lt.assignment_scope = 'user'
    loop
      for _resident_id in
        select distinct r.id
        from app.resident r
        join app.license l on l.resident_id = r.id
        where r.tenant_id = _tenant_id
        and r.status in ('invited', 'active', 'inactive')
        and r.type in ('home', 'guest')
        and l.license_type_key = 'app-user'
      loop
        insert into app.license(
          tenant_id
          ,resident_id
          ,tenant_subscription_id
          ,license_type_key
        )
        select
          _tenant_id
          ,_resident_id
          ,_tenant_subcription.id
          ,_license_type_key
        on conflict (resident_id, license_type_key) DO UPDATE SET updated_at = EXCLUDED.updated_at
        ;
      end loop;
    end loop;
      
    return _tenant_subcription;
  end;
  $function$
  ;

----------------------------------- grant_user_license
CREATE OR REPLACE FUNCTION app_api.grant_user_license(_resident_id uuid, _license_type_key citext)
  RETURNS app.license
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $function$
  DECLARE
    _license app.license;
  BEGIN
    if 
      jwt.has_permission('p:app-admin') != true 
      and
      jwt.has_permission('p:app-admin-super') != true
    then raise exception '30000: NOT AUTHORIZED'; end if;

    _license := app_fn.grant_user_license(_resident_id, _license_type_key, jwt.resident_id());
    return _license;
  end;
  $function$
  ;

CREATE OR REPLACE FUNCTION app_fn.grant_user_license(_resident_id uuid, _license_type_key citext, _current_user_appresident_id uuid)
  RETURNS app.license
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $function$
  DECLARE
    _tenant_subcription app.tenant_subscription;
    _resident app.resident;
    _license_pack app.license_pack;
    _license app.license;
    _license_type app.license_type;
  BEGIN
    select aut.* into _resident from app.resident aut where id = _resident_id;

    select ats.* 
    into _tenant_subcription 
    from app.tenant_subscription ats 
    join app.license_pack lp on lp.key = ats.license_pack_key
    join app.license_pack_license_type lplt on lplt.license_pack_key = lp.key
    where ats.tenant_id = _resident.tenant_id
    and lplt.license_type_key = _license_type_key
        -- OPTIONAL TODO: check for license availablity
        -- here would go more filters to enforce license availability
        -- for now we just make a new license
        -- the lplt.number_of_licenses is meant to support this 
        -- (# = number purchased, 0 = unlimited, -1 = implied tenant-level license)
        -- really you can do whatever you would like
        -- even refactory this statement out into a more complex function
    ;
    
    select lp.* into _license_pack from app.license_pack lp where lp.key = _tenant_subcription.license_pack_key;
    select lt.* into _license_type from app.license_type lt where key = _license_type_key;

    -- if license type is scoped as ('superadmin', 'admin', 'support', 'user') then remove any other scoped
    -- licenses for this application
    -- users should only ever have one of these four license scopes per application
    if _license_type.assignment_scope in ('superadmin', 'admin', 'support', 'user') then
      if _current_user_appresident_id = _resident.id then
        raise exception '30025: USERS CANNOT ALTER OWN SCOPE LICENSE STATUS';
      end if;

      delete from app.license l
      where l.resident_id = _resident.id
      and license_type_key in (
        select key from app.license_type where application_key = _license_type.application_key and assignment_scope in ('superadmin', 'admin', 'support', 'user')
      )
      ;
    end if;

    insert into app.license(
      tenant_id
      ,resident_id
      ,tenant_subscription_id
      ,license_type_key
    ) values (
      _resident.tenant_id
      ,_resident.id
      ,_tenant_subcription.id
      ,_license_type_key
    )
    on conflict (resident_id, license_type_key) do update set
      updated_at = current_timestamp
    returning * into _license;

    -- perform app_fn.configure_user_metadata(_resident.profile_id);

    return _license;
  end;
  $function$
  ;
----------------------------------- revoke_user_license
CREATE OR REPLACE FUNCTION app_api.revoke_user_license(_license_id uuid)
  RETURNS boolean
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $function$
  DECLARE
    _retval boolean;
  BEGIN
    if 
      jwt.has_permission('p:app-admin') != true 
      and
      jwt.has_permission('p:app-admin-super') != true
    then raise exception '30000: NOT AUTHORIZED'; end if;

    _retval := app_fn.revoke_user_license(_license_id);
    return _retval;
  end;
  $function$
  ;

CREATE OR REPLACE FUNCTION app_fn.revoke_user_license(_license_id uuid)
  RETURNS boolean
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $function$
  DECLARE
    _license app.license;
  BEGIN
    select * into _license from app.license where id = _license_id;

    delete from app.license where id = _license_id;

    -- raise exception '%', _license.resident_id;
    -- perform app_fn.configure_user_metadata(profile_id) from app.resident where id = _license.resident_id;

    return true;
  end;
  $function$
  ;

----------------------------------- block_resident
CREATE OR REPLACE FUNCTION app_api.block_resident(_resident_id uuid)
  RETURNS app.resident
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $function$
  DECLARE
    _resident app.resident;
  BEGIN
        if 
      jwt.has_permission('p:app-admin') != true 
      and
      jwt.has_permission('p:app-admin-super') != true
    then raise exception '30000: NOT AUTHORIZED'; end if;

    _resident := app_fn.block_resident(_resident_id);
    return _resident;
  end;
  $function$
  ;

CREATE OR REPLACE FUNCTION app_fn.block_resident(_resident_id uuid)
  RETURNS app.resident
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $function$
  DECLARE
    _resident app.resident;
  BEGIN
    update app.resident set status = 'blocked_individual' where id = _resident_id returning * into _resident;

    -- perform app_fn.configure_user_metadata(_resident.profile_id);

    return _resident;
  end;
  $function$
  ;

----------------------------------- unblock_resident
CREATE OR REPLACE FUNCTION app_api.unblock_resident(_resident_id uuid)
  RETURNS app.resident
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $function$
  DECLARE
    _resident app.resident;
  BEGIN
        if 
      jwt.has_permission('p:app-admin') != true 
      and
      jwt.has_permission('p:app-admin-super') != true
    then raise exception '30000: NOT AUTHORIZED'; end if;

    _resident := app_fn.unblock_resident(_resident_id);
    return _resident;
  end;
  $function$
  ;

CREATE OR REPLACE FUNCTION app_fn.unblock_resident(_resident_id uuid)
  RETURNS app.resident
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $function$
  DECLARE
    _resident app.resident;
  BEGIN
    update app.resident set status = 'invited' where id = _resident_id returning * into _resident;

    if (
      select count(id) 
      from app.resident 
      where email = _resident.email 
      and id != _resident.id 
      and status = 'active'
    ) = 0 and _resident.profile_id is not null then
      update app.resident set status = 'active' where id = _resident_id returning * into _resident;
      -- perform app_fn.configure_user_metadata(_resident.profile_id);
    end if;

    return _resident;
  end;
  $function$
  ;
---------------------------------------------------------------------- queries
----------------------------------- my_profile_residencies
CREATE OR REPLACE FUNCTION app_api.my_profile_residencies()
  RETURNS setof app.resident
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  AS $function$
  DECLARE
    
  BEGIN
    return query select * from app_fn.my_profile_residencies(jwt.email());
  end;
  $function$
  ;

CREATE OR REPLACE FUNCTION app_fn.my_profile_residencies(_email text)
  RETURNS setof app.resident
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  AS $function$
  DECLARE

  BEGIN
    -- raise exception '%', jwt.jwt();
    return query
    select aut.*
    from app.resident aut
    where email = _email
    ;
  end;
  $function$
  ;

----------------------------------- my_residency_tree
CREATE OR REPLACE FUNCTION app_api.my_residency_tree()
  RETURNS setof app_fn.residency_tree_node
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  AS $function$
  DECLARE

  BEGIN
    return query select * from app_fn.my_residency_tree(jwt.email());
  end;
  $function$
  ;

CREATE OR REPLACE FUNCTION app_fn.my_residency_tree(_email citext)
  RETURNS setof app_fn.residency_tree_node
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  AS $function$
  DECLARE

  BEGIN
    return query
    with recursive residency_tenants as (
      select t.id, t.name, t.type, t.status, t.parent_tenant_id
      from app.tenant t
      where t.id in (select r.tenant_id from app.resident r where r.email = _email)
      union
      select p.id, p.name, p.type, p.status, p.parent_tenant_id
      from app.tenant p
      join residency_tenants c on p.id = c.parent_tenant_id
    )
    select rt.id, rt.name, rt.type, rt.status, rt.parent_tenant_id,
           r.id, r.status, r.type
    from residency_tenants rt
    left join app.resident r on r.tenant_id = rt.id and r.email = _email
    order by rt.name;
  end;
  $function$
  ;

----------------------------------- tenant_profile_residencies
CREATE OR REPLACE FUNCTION app_api.tenant_profile_residencies()
  RETURNS setof app.resident
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  AS $function$
  DECLARE
    
  BEGIN
    -- raise exception 'blah %', jwt.tenant_id();
    return query select * from app_fn.tenant_profile_residencies(jwt.tenant_id());
  end;
  $function$
  ;

CREATE OR REPLACE FUNCTION app_fn.tenant_profile_residencies(_tenant_id uuid)
  RETURNS setof app.resident
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  AS $function$
  DECLARE
    
  BEGIN
    return query
    select distinct aut.*
    from app.resident aut
    where aut.tenant_id = _tenant_id
    and not exists(
      select l.id from app.license l where resident_id = aut.id and l.license_type_key = 'app-admin-support'
    )
    ;
  end;
  $function$
  ;

----------------------------------- tenant_licenses
CREATE OR REPLACE FUNCTION app_api.tenant_licenses()
  RETURNS setof app.license
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  AS $function$
  DECLARE
    
  BEGIN
    return query select * from app_fn.tenant_licenses(jwt.tenant_id());
  end;
  $function$
  ;

CREATE OR REPLACE FUNCTION app_fn.tenant_licenses(_tenant_id uuid)
  RETURNS setof app.license
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  AS $function$
  DECLARE
    
  BEGIN
    return query
    select l.*
    from app.license l
    where l.license_type_key != 'app-admin-support'
    and tenant_id = _tenant_id
    and not exists (
      select id from app.license where resident_id = l.resident_id and license_type_key = 'app-admin-support'
    )
    ;
  end;
  $function$
  ;

----------------------------------------------------------------- join_address_book
CREATE OR REPLACE FUNCTION app_api.join_address_book()
  RETURNS app.profile
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $$
  DECLARE
    _profile app.profile;
  BEGIN
    _profile := app_fn.join_address_book(jwt.uid());
    return _profile;
  end;
  $$;  

CREATE OR REPLACE FUNCTION app_fn.join_address_book(_profile_id uuid)
  RETURNS app.profile
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $$
  DECLARE
    _profile app.profile;
  BEGIN
    -- raise notice '_profile_id: %', _profile_id;
    -- raise notice 'email: %', (select email from app.profile where id = _profile_id);
    
    update app.profile set
      is_public = true
    where id = _profile_id
    returning *
    into _profile
    ;

    -- raise notice '_profile: %', _profile;

    return _profile;
  end;
  $$;  
----------------------------------------------------------------- get_ab_listings
CREATE OR REPLACE FUNCTION app_api.get_ab_listings(_profile_id uuid)
  RETURNS SETOF app_fn.ab_listing
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  AS $$
  DECLARE
  BEGIN
    return query select * from app_fn.get_ab_listings(jwt.uid(), jwt.tenant_id());
  end;
  $$;  
----------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_fn.get_ab_listings(_profile_id uuid, _user_tenant_id uuid)
  RETURNS SETOF app_fn.ab_listing
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  AS $$
  DECLARE
    _can_invite boolean;
  BEGIN
    _can_invite := jwt.has_permission('p:app-admin');

    return query
      select 
        u.id as profile_id
        ,u.email
        ,u.phone
        ,u.full_name
        ,u.display_name
        ,(
          select _can_invite 
          and (u.id != _profile_id)
          and not exists (select id from app.resident where tenant_id = _user_tenant_id and profile_id = u.id)
        ) as _can_invite
      from app.profile u
      where is_public = true
      and exists(select id from app.profile where id = _profile_id and is_public = true)
      ;
  end;
  $$;  
----------------------------------------------------------------- leave_address_book
CREATE OR REPLACE FUNCTION app_api.leave_address_book()
  RETURNS app.profile
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $$
  DECLARE
    _profile app.profile;
  BEGIN
    _profile := app_fn.leave_address_book(jwt.uid());
    return _profile;
  end;
  $$;  

CREATE OR REPLACE FUNCTION app_fn.leave_address_book(_profile_id uuid)
  RETURNS app.profile
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $$
  DECLARE
    _profile app.profile;
  BEGIN
    update app.profile set
      is_public = false
    where id = _profile_id
    returning *
    into _profile
    ;

    return _profile;
  end;
  $$;  
----------------------------------------------------------------- get_myself ---  API ONLY
CREATE OR REPLACE FUNCTION app_api.get_myself()
  RETURNS app.profile
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  AS $$
  DECLARE
    _profile app.profile;
    _uid uuid;
  BEGIN
    -- this works
    _uid = jwt.uid();
    select * into _profile from app.profile where id = _uid;
    return _profile;

    -- -- this throws a very weird error
    -- -- leaving it here for potential later investigation
    -- -- to reproduce, build new environment, then login and decline invitation
    -- -- jwt.uid() is a supabase function
    -- select * into _profile from app.profile where id = jwt.uid();
    -- return _profile;
  end;
  $$;  
----------------------------------------------------------------- throw_error ---  API ONLY
CREATE OR REPLACE FUNCTION app_api.throw_error(_message citext default 'GENERICERROR')
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  AS $$
  DECLARE
  BEGIN
    raise exception 'ERROR:  %', _message;
  end;
  $$;  
----------------------------------------------------------------- raise_exception ---  API ONLY
CREATE OR REPLACE FUNCTION app_api.raise_exception(_message citext default 'GENERICERROR')
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  AS $$
  DECLARE
  BEGIN
    raise exception 'ERROR:  %', _message;
  end;
  $$;  
----------------------------------------------------------------- update_tenant
CREATE TYPE app_fn.update_tenant_input AS (
    id         uuid,
    name       citext,
    identifier citext,
    type       app.tenant_type
  );

CREATE OR REPLACE FUNCTION app_fn.update_tenant(_input app_fn.update_tenant_input)
    RETURNS app.tenant
    LANGUAGE plpgsql
    VOLATILE
    SECURITY INVOKER
  AS $$
  DECLARE
    _tenant app.tenant;
  BEGIN
    UPDATE app.tenant
    SET
      name       = coalesce(_input.name, name),
      identifier = _input.identifier,
      type       = coalesce(_input.type, type),
      updated_at = now()
    WHERE id = _input.id
    RETURNING * INTO _tenant;

    IF _tenant IS NULL THEN
      RAISE EXCEPTION 'tenant not found: %', _input.id;
    END IF;

    RETURN _tenant;
  END;
  $$;

CREATE OR REPLACE FUNCTION app_api.update_tenant(_input app_fn.update_tenant_input)
    RETURNS app.tenant
    LANGUAGE plpgsql
    VOLATILE
    SECURITY INVOKER
  AS $$
  BEGIN
    PERFORM jwt.enforce_permission('p:app-admin-super');
    RETURN app_fn.update_tenant(_input);
  END;
  $$;
  -- ================================================================
  -- update_profile_status
  -- ================================================================
  CREATE OR REPLACE FUNCTION app_fn.update_profile_status(_profile_id uuid, _status app.profile_status)
    RETURNS app.profile
    LANGUAGE plpgsql VOLATILE SECURITY INVOKER AS $$
  DECLARE
    _profile app.profile;
  BEGIN
    UPDATE app.profile
    SET status = _status, updated_at = now()
    WHERE id = _profile_id
    RETURNING * INTO _profile;

    IF _profile IS NULL THEN
      RAISE EXCEPTION 'profile not found: %', _profile_id;
    END IF;

    RETURN _profile;
  END;
  $$;

  CREATE OR REPLACE FUNCTION app_api.update_profile_status(_profile_id uuid, _status app.profile_status)
    RETURNS app.profile
    LANGUAGE plpgsql VOLATILE SECURITY INVOKER AS $$
  BEGIN
    PERFORM jwt.enforce_permission('p:app-admin-super');
    RETURN app_fn.update_profile_status(_profile_id, _status);
  END;
  $$;
  -- ================================================================
  -- update_user_status  (alias for profile — "user" context)
  -- ================================================================
  CREATE OR REPLACE FUNCTION app_fn.update_user_status(_profile_id uuid, _status app.profile_status)
    RETURNS app.profile
    LANGUAGE plpgsql VOLATILE SECURITY INVOKER AS $$
  BEGIN
    RETURN app_fn.update_profile_status(_profile_id, _status);
  END;
  $$;

  CREATE OR REPLACE FUNCTION app_api.update_user_status(_profile_id uuid, _status app.profile_status)
    RETURNS app.profile
    LANGUAGE plpgsql VOLATILE SECURITY INVOKER AS $$
  BEGIN
    PERFORM jwt.enforce_permission('p:app-admin-super');
    RETURN app_fn.update_profile_status(_profile_id, _status);
  END;
  $$;
  -- ================================================================
  -- update_resident_status
  -- ================================================================
  CREATE OR REPLACE FUNCTION app_fn.update_resident_status(_resident_id uuid, _status app.resident_status)
    RETURNS app.resident
    LANGUAGE plpgsql VOLATILE SECURITY INVOKER AS $$
  DECLARE
    _resident app.resident;
  BEGIN
    UPDATE app.resident
    SET status = _status, updated_at = now()
    WHERE id = _resident_id
    RETURNING * INTO _resident;

    IF _resident IS NULL THEN
      RAISE EXCEPTION 'resident not found: %', _resident_id;
    END IF;

    RETURN _resident;
  END;
  $$;

  CREATE OR REPLACE FUNCTION app_api.update_resident_status(_resident_id uuid, _status app.resident_status)
    RETURNS app.resident
    LANGUAGE plpgsql VOLATILE SECURITY INVOKER AS $$
  BEGIN
    PERFORM jwt.enforce_permission('p:app-admin-super');
    RETURN app_fn.update_resident_status(_resident_id, _status);
  END;
  $$;
  -- ================================================================
  -- update_tenant_status
  -- ================================================================
  CREATE OR REPLACE FUNCTION app_fn.update_tenant_status(_tenant_id uuid, _status app.tenant_status)
    RETURNS app.tenant
    LANGUAGE plpgsql VOLATILE SECURITY INVOKER AS $$
  DECLARE
    _tenant app.tenant;
  BEGIN
    UPDATE app.tenant
    SET status = _status, updated_at = now()
    WHERE id = _tenant_id
    RETURNING * INTO _tenant;

    IF _tenant IS NULL THEN
      RAISE EXCEPTION 'tenant not found: %', _tenant_id;
    END IF;

    RETURN _tenant;
  END;
  $$;

  CREATE OR REPLACE FUNCTION app_api.update_tenant_status(_tenant_id uuid, _status app.tenant_status)
    RETURNS app.tenant
    LANGUAGE plpgsql VOLATILE SECURITY INVOKER AS $$
  BEGIN
    PERFORM jwt.enforce_permission('p:app-admin-super');
    RETURN app_fn.update_tenant_status(_tenant_id, _status);
  END;
  $$;

 CREATE TYPE app_fn.update_user_input AS (
    id         uuid,
    first_name text,
    last_name  text,
    display_name text,
    phone      text,
    identifier citext,
    is_public  boolean
  );

  CREATE OR REPLACE FUNCTION app_fn.update_user(_input app_fn.update_user_input)
    RETURNS app.profile LANGUAGE plpgsql VOLATILE SECURITY INVOKER AS $$
  DECLARE _profile app.profile;
  BEGIN
    UPDATE app.profile SET
      first_name   = coalesce(_input.first_name, first_name),
      last_name    = coalesce(_input.last_name, last_name),
      display_name = coalesce(_input.display_name, display_name),
      phone        = _input.phone,
      identifier   = _input.identifier,
      is_public    = coalesce(_input.is_public, is_public),
      updated_at   = now()
    WHERE id = _input.id RETURNING * INTO _profile;
    IF _profile IS NULL THEN RAISE EXCEPTION 'profile not found: %', _input.id; END IF;
    RETURN _profile;
  END; $$;

  CREATE OR REPLACE FUNCTION app_api.update_user(_input app_fn.update_user_input)
    RETURNS app.profile LANGUAGE plpgsql VOLATILE SECURITY INVOKER AS $$
  BEGIN
    PERFORM jwt.enforce_permission('p:app-admin-super');
    RETURN app_fn.update_user(_input);
  END; $$;