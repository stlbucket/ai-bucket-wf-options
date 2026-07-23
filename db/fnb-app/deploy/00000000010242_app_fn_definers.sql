----------------------------------------------------------------- configure_user_metadata ---  NO API
CREATE OR REPLACE FUNCTION app_fn.configure_user_metadata(_profile_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $$
  DECLARE
    _profile_claims app_fn.profile_claims;
  BEGIN
    -- _profile_claims := app_fn.current_profile_claims(_profile_id);

    -- here and app_fn.handle_new_user should be the only places where auth.users are updated
    -- update auth.users set
    --   raw_user_meta_data = (select to_jsonb(_profile_claims))
    -- where id = _profile_id
    -- ;
  end;
  $$;  
----------------------------------- handle_new_user ---  NO API
create or replace function app_fn.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  as $$
  DECLARE
    _resident app.resident;
    _claims jsonb;
  begin
    -- raise notice 'creating new user: %', new.email;

    insert into app.profile (id, email, display_name)
    values (new.id, new.email, split_part(new.email, '@', 1));

    update app.resident set
      profile_id = new.id
    where email = new.email
    and status != 'blocked_individual'
    and status != 'blocked_tenant'
    ;

    -- select * into _resident from app.resident where profile_id = new.id and status = 'active' limit 1;
    select * into _resident from app.resident where profile_id = new.id limit 1;

    -- if _resident.id is not null then
    --   _claims := to_jsonb(app_fn.current_profile_claims(_resident.profile_id));
    --   update auth.users set
    --     raw_user_meta_data = _claims
    --   where id = _resident.profile_id
    --   ;
    -- end if;

    -- raise notice 'created new user: %, %', new.email, jsonb_pretty(_claims);
    return new;
  end;
  $$;
  -- trigger the function every time a user is created
create or replace trigger on_auth_user_created
  after insert on auth.user
  for each row execute procedure app_fn.handle_new_user();
----------------------------------- assume_residency
CREATE OR REPLACE FUNCTION app_api.assume_residency(_resident_id uuid)
  RETURNS app.resident
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $function$
  DECLARE
    _resident app.resident;
  BEGIN
    _resident := app_fn.assume_residency(_resident_id, jwt.email());
    return _resident;
  end;
  $function$
  ;

CREATE OR REPLACE FUNCTION app_fn.assume_residency(_resident_id uuid, _email citext)
  RETURNS app.resident
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $function$
  DECLARE
    _resident app.resident;
  BEGIN
    -- raise notice 'heyo: %', _email;
    select * into _resident from app.resident where id = _resident_id and email = _email;
    if _resident.id is null then
      raise exception 'NO RESIDENT FOR EMAIL: %, %, %', _resident_id, _email, _resident;
    end if;

    if _resident.id is not null then
      update app.resident set 
        status = 'inactive' 
        ,updated_at = current_timestamp 
      where profile_id = _resident.profile_id
      and status in ('active', 'supporting')
      and id != _resident_id 
      ;

      update app.resident set 
        status = 'active' 
        ,updated_at = current_timestamp 
      where id = _resident_id
      returning * 
      into _resident;

      update app.license set
        profile_id = _resident.profile_id
      where resident_id in (select id from app.resident where email = _resident.email)
      ;

      -- perform app_fn.configure_user_metadata(_resident.profile_id);
    end if;

    -- raise notice 'heyo: %', _resident;
    return _resident;
  end;
  $function$
  ;

----------------------------------- decline_residency
CREATE OR REPLACE FUNCTION app_api.decline_residency(_resident_id uuid)
  RETURNS app.resident
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $function$
  DECLARE
    _resident app.resident;
  BEGIN
    _resident := app_fn.decline_residency(_resident_id, jwt.email());
    return _resident;
  end;
  $function$
  ;

CREATE OR REPLACE FUNCTION app_fn.decline_residency(_resident_id uuid, _email citext)
  RETURNS app.resident
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $function$
  DECLARE
    _resident app.resident;
  BEGIN
    select * into _resident from app.resident where id = _resident_id and email = _email;
    if _resident.id is null then
      raise exception '%, %, %', _resident_id, _email, _resident;
    end if;

    if _resident.id is not null then
      update app.resident set 
        status = 'declined' 
        ,updated_at = current_timestamp 
      where id = _resident_id
      returning * 
      into _resident;
    end if;

    return _resident;
  end;
  $function$
  ;

----------------------------------- update_profile
CREATE OR REPLACE FUNCTION app_api.update_profile(
    _display_name citext
    ,_first_name citext
    ,_last_name citext
    ,_phone citext default null
  )
  RETURNS app.profile
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $function$
  DECLARE
    _profile app.profile;
  BEGIN
    _profile := app_fn.update_profile(
      jwt.uid()
      ,_display_name
      ,_first_name
      ,_last_name
      ,_phone
    );
    return _profile;
  end;
  $function$
  ;

CREATE OR REPLACE FUNCTION app_fn.update_profile(
    _profile_id uuid
    ,_display_name citext
    ,_first_name citext
    ,_last_name citext
    ,_phone citext default null
  )
  RETURNS app.profile
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $function$
  DECLARE
    _profile app.profile;
  BEGIN
    update app.resident set 
      display_name = _display_name
      ,updated_at = current_timestamp 
    where profile_id = _profile_id
    ;

    update app.profile set
      display_name = _display_name
      ,first_name = _first_name
      ,last_name = _last_name
      ,phone = _phone
      ,updated_at = current_timestamp 
    where id = _profile_id
    returning * 
    into _profile;

    -- perform app_fn.configure_user_metadata(_profile.id);

    return _profile;
  end;
  $function$
  ;

----------------------------------- invite_user
-- for now this is being held out of the api
-- instead, it is implemented as a nuxt endpoint at api/invite-user
-- this is because we want to call supabaseClient.auth.admin.inviteUserByEmail
-- folding the supabase client into the graphql context is a bit clunky
-- also, isolating into the api endpoint (perhaps along with other uses of supabase client)
-- will make for easier refactoring later if changing auth providers
-- as the instantiation model could be different
-- 
-- CREATE OR REPLACE FUNCTION app_api.invite_user(_email citext)
--   RETURNS app.resident
--   LANGUAGE plpgsql
--   VOLATILE
--   SECURITY DEFINER
--   AS $function$
--   DECLARE
--     _profile app.profile;
--     _resident app.resident;
--   BEGIN
--     -- this function invites a user to the same tenant as the current user
--     -- can only be called by user with app-admin license or better.
--     if jwt.has_permission('p:app-admin') = false then
--       raise exception '30000: UNAUTHORIZED';
--     end if;

--     select * into _resident 
--     from app.resident 
--     where profile_id = jwt.uid() 
--     and status = 'active'
--     ;

--     _resident = (select app_fn.invite_user(_resident.tenant_id, _email));

--     return _resident;
--   end;
--   $function$
--   ;

CREATE OR REPLACE FUNCTION app_fn.invite_user(
    _tenant_id uuid
    ,_email citext
    ,_assignment_scope app.license_type_assignment_scope default 'user'
  )
  RETURNS app.resident
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
          -- security definer to allow for select of app.profile from other tenants
          -- this would allow for one tenant to know if a user at an email were on
          -- the platform - though the other would know that they know.  so it would
          -- all be known knowns and no unknown unknowns.  -- donny r
  AS $function$
  DECLARE
    _profile app.profile;
    _resident app.resident;
    _tenant app.tenant;
    _license_pack_license_type app.license_pack_license_type;
    _license_type_key citext;
    _tenant_subscription_id uuid;
  BEGIN
    -- find existing records for profile and resident
    select * into _profile from app.profile where email = _email;
    select * into _resident from app.resident where email = _email and tenant_id = _tenant_id;
    select * into _tenant from app.tenant where id = _tenant_id;

    if _resident.id is null then
      --create a new resident
      insert into app.resident(
        tenant_id
        ,tenant_name
        ,email
        ,display_name
        ,type
      ) values (
        _tenant.id
        ,_tenant.name
        ,_email
        ,coalesce(_profile.display_name, split_part(_email,'@',1))
        ,case
          when (select count(*) from app.resident where email = _email) > 0 then 'guest'::app.resident_type
          else 'home'::app.resident_type
        end
      )
      returning * into _resident;
      perform res_fn.register_resource(_resident.id, _tenant.id, 'app', 'resident');

      -- grant all licenses at the specified assignment scope
      for _license_type_key, _tenant_subscription_id in
        select lplt.license_type_key, ats.id
          from app.license_pack_license_type lplt
          join app.license_type lt on lt.key = lplt.license_type_key
          join app.license_pack lp on lp.key = lplt.license_pack_key
          join app.tenant_subscription ats on ats.license_pack_key = lp.key
          where ats.tenant_id = _tenant_id
          and (
            lt.assignment_scope = _assignment_scope or lt.assignment_scope = 'all' 
            or (lt.assignment_scope = 'admin' and _assignment_scope = 'superadmin')
          )
      loop
        insert into app.license(
          tenant_id
          ,resident_id
          ,tenant_subscription_id
          ,license_type_key
        )
        values (
          _tenant_id
          ,_resident.id
          ,_tenant_subscription_id
          ,_license_type_key
        )
        on conflict (resident_id, license_type_key) DO UPDATE SET updated_at = EXCLUDED.updated_at
        ;
      end loop;
    end if;
    
    -- attach resident to any existing user
    if _profile.id is not null then
      update app.resident set profile_id = _profile.id where id = _resident.id returning * into _resident;
    end if;

    return _resident;
  end;
  $function$
  ;

----------------------------------- demo_profile_residencies
CREATE OR REPLACE FUNCTION app_api.demo_profile_residencies()
  RETURNS setof app.resident
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  AS $function$
  DECLARE
  BEGIN
    return query select * from app_fn.demo_profile_residencies();
  end;
  $function$
  ;

CREATE OR REPLACE FUNCTION app_fn.demo_profile_residencies()
  RETURNS setof app.resident
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  AS $function$
  DECLARE
  BEGIN
    return query
    select distinct
      aut.*
    from app.resident aut
    join app.tenant t on t.id = aut.tenant_id
    where (t.type = 'demo' or t.type = 'anchor')
    and aut.display_name != 'Site Support'
    ;
  end;
  $function$
  ;
----------------------------------------------------------------- get_ab_listings --- API ONLY
CREATE OR REPLACE FUNCTION app_api.get_ab_listings(_profile_id uuid)
  RETURNS SETOF app_fn.ab_listing
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  AS $$
  DECLARE
  BEGIN
    return query select * from app_fn.get_ab_listings(jwt.uid(), jwt.tenant_id());
  end;
  $$;

----------------------------------------------------------------- tenant tree helpers
-- DEFINER: parent/ancestor tenant rows are not visible to a workspace member under RLS
-- (only own tenant + direct children); walking the whole tree needs to bypass RLS.
CREATE OR REPLACE FUNCTION app_fn.tenant_tree_root(_tenant_id uuid)
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  AS $function$
    with recursive up as (
        select id, parent_tenant_id from app.tenant where id = _tenant_id
      union all
        select t.id, t.parent_tenant_id
        from app.tenant t join up on t.id = up.parent_tenant_id
    )
    select id from up where parent_tenant_id is null limit 1;
  $function$
  ;

CREATE OR REPLACE FUNCTION app_fn.tenant_tree_ids(_root_id uuid)
  RETURNS setof uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  AS $function$
    with recursive down as (
        select id from app.tenant where id = _root_id
      union all
        select t.id from app.tenant t join down on t.parent_tenant_id = down.id
    )
    select id from down;
  $function$
  ;

----------------------------------------------------------------- tenant_spine_ids
-- The "vertical spine" through a node: ancestors + self + own subtree. Used by the Manage-Residents
-- pool so the candidate set spans the lineage up to the root PLUS the node's own descendants,
-- excluding sibling branches. DEFINER: ancestor rows are not visible to a member under RLS.
CREATE OR REPLACE FUNCTION app_fn.tenant_spine_ids(_tenant_id uuid)
  RETURNS setof uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  AS $function$
    with recursive up as (          -- self + ancestors (walk to root)
        select id, parent_tenant_id from app.tenant where id = _tenant_id
      union all
        select t.id, t.parent_tenant_id
        from app.tenant t join up on t.id = up.parent_tenant_id
    ),
    down as (                        -- self + descendants (walk the subtree)
        select id from app.tenant where id = _tenant_id
      union all
        select t.id from app.tenant t join down on t.parent_tenant_id = down.id
    )
    select id from up
    union
    select id from down;             -- union dedupes the shared self row
  $function$
  ;

----------------------------------------------------------------- workspace_resident_pool
-- The "Manage Residents" candidate pool: every distinct person (real profile) holding a resident
-- anywhere on the current node's SPINE (ancestor lineage up to the root + the node's own subtree;
-- sibling branches excluded), annotated with whether they are a member of THIS node. Serves all
-- nestable node types (workspace/client/organization) identically.
CREATE OR REPLACE FUNCTION app_fn.workspace_resident_pool(_workspace_tenant_id uuid)
  RETURNS setof app_fn.workspace_resident_candidate
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  AS $function$
  BEGIN
    return query
    with pool as (
      select distinct r.profile_id
      from app.resident r
      where r.tenant_id in (select app_fn.tenant_spine_ids(_workspace_tenant_id))
        and r.profile_id is not null       -- real people only (skip pending, profile-less invites)
        and r.type <> 'support'            -- exclude support residents
    )
    select
      p.id
      ,p.email
      ,coalesce(p.display_name, split_part(p.email,'@',1))::citext
      ,p.full_name
      ,home_t.name
      ,wr.id
      ,wr.status
      ,(wr.id is not null and wr.status <> 'removed')
    from pool
    join app.profile p        on p.id = pool.profile_id
    left join app.resident home_r on home_r.profile_id = p.id and home_r.type = 'home'
    left join app.tenant   home_t on home_t.id = home_r.tenant_id
    left join app.resident wr on wr.profile_id = p.id
                             and wr.tenant_id = _workspace_tenant_id
                             and wr.type in ('home','guest')
    order by 3;
  end;
  $function$
  ;

CREATE OR REPLACE FUNCTION app_api.workspace_resident_pool()
  RETURNS setof app_fn.workspace_resident_candidate
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  AS $function$
  BEGIN
    perform jwt.enforce_permission('p:app-admin');
    return query select * from app_fn.workspace_resident_pool(jwt.tenant_id());
  end;
  $function$
  ;

----------------------------------------------------------------- remove_profile_from_tree_workspaces
-- Deactivation cascade: soft-remove a person from EVERY workspace in a tenant's tree.
-- Called from app_fn.block_resident (00000000010240_app_fn.sql).
CREATE OR REPLACE FUNCTION app_fn.remove_profile_from_tree_workspaces(_profile_id uuid, _from_tenant_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $function$
  DECLARE
    _root uuid;
  BEGIN
    _root := app_fn.tenant_tree_root(_from_tenant_id);

    update app.resident r
      set status = 'removed', updated_at = current_timestamp
      where r.profile_id = _profile_id
        and r.status not in ('blocked_individual','blocked_tenant','removed')
        and r.tenant_id in (
          select id from app.tenant
          where type in ('workspace','client','organization')
            and id in (select app_fn.tenant_tree_ids(_root))
        );

    update app.license l
      set status = 'inactive', updated_at = current_timestamp
      from app.resident r
      where l.resident_id = r.id
        and r.profile_id = _profile_id
        and r.status = 'removed'
        and l.status = 'active'
        and r.tenant_id in (select app_fn.tenant_tree_ids(_root));
  end;
  $function$
  ;

----------------------------------------------------------------- set_workspace_membership
CREATE OR REPLACE FUNCTION app_fn.set_workspace_membership(
    _workspace_tenant_id uuid
    ,_profile_id uuid
    ,_member boolean
    ,_actor_profile_id uuid
  )
  RETURNS app.resident
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $function$
  DECLARE
    _ws app.tenant;
    _wr app.resident;
    _email citext;
  BEGIN
    select * into _ws from app.tenant where id = _workspace_tenant_id;
    if _ws.parent_tenant_id is null then
      raise exception '30000: NOT AUTHORIZED';   -- current tenant is not a workspace
    end if;

    -- target must already belong to the same tenant tree
    if not exists (
      select 1 from app.resident r
      where r.profile_id = _profile_id
        and r.tenant_id in (select app_fn.tenant_tree_ids(app_fn.tenant_tree_root(_workspace_tenant_id)))
    ) then
      raise exception '30000: NOT AUTHORIZED';
    end if;

    if not _member and _profile_id = _actor_profile_id then
      raise exception '31010: CANNOT REMOVE SELF FROM WORKSPACE';
    end if;

    _email := (select email from app.profile where id = _profile_id);
    select * into _wr from app.resident
      where profile_id = _profile_id and tenant_id = _workspace_tenant_id and type in ('home','guest');

    if _member then                                       -- ADD / re-activate
      if _wr.id is null then
        _wr := app_fn.invite_user(_workspace_tenant_id, _email, 'user');  -- guest + app-user license
      end if;
      -- dormant membership (entered later via assume_residency — matches create_workspace creator)
      update app.resident set status = 'inactive', updated_at = current_timestamp
        where id = _wr.id returning * into _wr;
      update app.license set status = 'active', updated_at = current_timestamp
        where resident_id = _wr.id and status = 'inactive';
    else                                                  -- REMOVE (soft)
      update app.resident set status = 'removed', updated_at = current_timestamp
        where id = _wr.id returning * into _wr;
      update app.license set status = 'inactive', updated_at = current_timestamp
        where resident_id = _wr.id and status = 'active';
    end if;

    return _wr;
  end;
  $function$
  ;

CREATE OR REPLACE FUNCTION app_api.set_workspace_membership(_profile_id uuid, _member boolean)
  RETURNS app.resident
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $function$
  DECLARE
    _resident app.resident;
  BEGIN
    perform jwt.enforce_permission('p:app-admin');
    _resident := app_fn.set_workspace_membership(jwt.tenant_id(), _profile_id, _member, jwt.profile_id());
    return _resident;
  end;
  $function$
  ;
