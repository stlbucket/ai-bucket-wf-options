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

-- U10 changed invite_user's SIGNATURE (added _first_name/_last_name/_display_name_in/_phone).
-- `CREATE OR REPLACE` only replaces a same-signature function, so on a live DB that already has the
-- old 3-arg version (a prod hot-fix replay via `pnpm do-db-exec`) the CREATE below would ADD a 7-arg
-- overload alongside it → every 3-arg call raises "function ... is not unique". Drop the stale
-- signature first. On a fresh rebuild this is a harmless no-op (the function doesn't exist yet).
drop function if exists app_fn.invite_user(uuid, citext, app.license_type_assignment_scope);

CREATE OR REPLACE FUNCTION app_fn.invite_user(
    _tenant_id uuid
    ,_email citext
    ,_assignment_scope app.license_type_assignment_scope default 'user'
    -- U10 (user-invitation spec): the Invite-User popup collects these optional profile details;
    -- all default null so every existing 3-arg caller stays valid. Appended, not reordered.
    ,_first_name citext default null
    ,_last_name citext default null
    ,_display_name_in citext default null
    ,_phone citext default null
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
    _display_name citext;
  BEGIN
    -- U10: normalize blank optional inputs to null (the popup / workflow may send empty strings).
    _first_name     := nullif(trim(_first_name), '')::citext;
    _last_name      := nullif(trim(_last_name), '')::citext;
    _display_name_in := nullif(trim(_display_name_in), '')::citext;
    _phone          := nullif(trim(_phone), '')::citext;

    -- find existing records for profile and resident
    select * into _profile from app.profile where email = _email;
    select * into _resident from app.resident where email = _email and tenant_id = _tenant_id;
    select * into _tenant from app.tenant where id = _tenant_id;

    -- Invited users are first-class people from the moment they are invited: ensure an app.profile
    -- exists for this email up front rather than lazily on first OIDC login. Without a profile a
    -- resident is invisible to the Manage-Residents pool (app_fn.workspace_resident_pool filters
    -- `profile_id is not null`) so a not-yet-logged-in invitee cannot be added to a child workspace,
    -- and the subtree roll-up (useSubtreeResidents) keys grouping on profile_id, so the same person
    -- invited into multiple tenants shows as several rows. idp_user_id stays null until the first
    -- OIDC login, where app_fn.provision_idp_user adopts THIS profile by email (email-match branch).
    -- Mirrors the pre-create-before-invite precedent in app_fn.create_app_tenant / initialize_anchor
    -- (create_app_tenant/create_workspace pre-create the admin's profile so _profile.id is already
    -- set here and this branch is skipped).
    if _profile.id is null then
      -- U10 display_name resolution (display_name is UNIQUE):
      --  * caller supplied one → it is EXPLICIT input, so a collision is a hard error (31020) rather
      --    than a silent fallback — the admin picked it and deserves to know.
      --  * none supplied → keep the collision-safe auto-derivation (email local part, else null);
      --    an unattended invite must never fail on a display-name clash.
      if _display_name_in is not null then
        if exists (select 1 from app.profile where display_name = _display_name_in) then
          raise exception '31020: DISPLAY NAME ALREADY TAKEN';
        end if;
        _display_name := _display_name_in;
      else
        _display_name := lower(split_part(_email, '@', 1))::citext;
        if _display_name is null or exists (select 1 from app.profile where display_name = _display_name) then
          _display_name := null;
        end if;
      end if;
      insert into app.profile (email, display_name, first_name, last_name, phone)
      values (_email, _display_name, _first_name, _last_name, _phone)
      returning * into _profile;
    else
      -- U10 re-invite: FILL ONLY BLANKS on the existing profile — never overwrite a value the
      -- person already has. display_name is set only when currently null AND supplied, with the
      -- same explicit-collision guard as the new-profile path.
      if _display_name_in is not null and _profile.display_name is null then
        if exists (select 1 from app.profile where display_name = _display_name_in) then
          raise exception '31020: DISPLAY NAME ALREADY TAKEN';
        end if;
        update app.profile set display_name = _display_name_in where id = _profile.id;
      end if;
      update app.profile
        set first_name = coalesce(first_name, _first_name)
           ,last_name  = coalesce(last_name, _last_name)
           ,phone      = coalesce(phone, _phone)
           ,updated_at = current_timestamp
        where id = _profile.id
        returning * into _profile;
    end if;

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
    
    -- link the resident to the profile (always present now — created above if it was missing)
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

----------------------------------------------------------------- tenant_subtree_residents
-- The admin/user roll-up: every residency in the current tenant's child subtree (self + all
-- descendants — NOT ancestors, NOT siblings), one row per residency; the client groups into one
-- row per person. Excludes support residencies and soft-removed roster rows. DEFINER: descendant
-- tenants beyond direct children are not visible to the caller under RLS.
CREATE OR REPLACE FUNCTION app_fn.tenant_subtree_residents(_tenant_id uuid)
  RETURNS setof app_fn.subtree_resident_row
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  AS $function$
  BEGIN
    return query
    select
      r.id
      ,r.profile_id
      ,coalesce(p.email, r.email::citext)
      ,coalesce(p.display_name, r.display_name, split_part(coalesce(p.email, r.email::citext),'@',1))::citext
      ,p.full_name
      ,t.id
      ,t.name
      ,t.type
      ,r.type
      ,r.status
    from app.resident r
    join app.tenant t     on t.id = r.tenant_id
    left join app.profile p on p.id = r.profile_id
    where r.tenant_id in (select app_fn.tenant_tree_ids(_tenant_id))
      and r.type <> 'support'          -- support staff hidden from tenant views
      and r.status <> 'removed'        -- soft-removed roster rows are not members
    order by 4, 7;                     -- display_name, tenant_name
  end;
  $function$
  ;

CREATE OR REPLACE FUNCTION app_api.tenant_subtree_residents()
  RETURNS setof app_fn.subtree_resident_row
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  AS $function$
  BEGIN
    perform jwt.enforce_permission('p:app-admin');
    return query select * from app_fn.tenant_subtree_residents(jwt.tenant_id());
  end;
  $function$
  ;

----------------------------------------------------------------- subtree_resident_detail
-- Read-only cross-tenant detail for the roll-up: the target resident + the person's residencies
-- (with licenses) within the caller's subtree, as jsonb (siteUserById precedent — raw pg values,
-- lowercase enums). Raises 30000 if the target is absent or outside the caller's subtree.
CREATE OR REPLACE FUNCTION app_fn.subtree_resident_detail(_tenant_id uuid, _resident_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  AS $function$
  DECLARE
    _r app.resident;
  BEGIN
    select * into _r from app.resident where id = _resident_id;
    if _r.id is null
      or _r.tenant_id not in (select app_fn.tenant_tree_ids(_tenant_id))
    then
      raise exception '30000: NOT AUTHORIZED';
    end if;

    return jsonb_build_object(
      'profile', (select to_jsonb(p) from app.profile p where p.id = _r.profile_id)
      ,'resident', to_jsonb(_r)
      ,'residencies', (
        select coalesce(jsonb_agg(x order by x->>'tenantName'), '[]'::jsonb)
        from (
          select jsonb_build_object(
            'residentId', r2.id
            ,'tenantId', t2.id
            ,'tenantName', t2.name
            ,'tenantType', t2.type
            ,'residentType', r2.type
            ,'status', r2.status
            ,'licenses', (
              select coalesce(jsonb_agg(jsonb_build_object(
                'id', l.id
                ,'licenseTypeKey', l.license_type_key
                ,'status', l.status
              )), '[]'::jsonb)
              from app.license l
              where l.resident_id = r2.id
            )
          ) as x
          from app.resident r2
          join app.tenant t2 on t2.id = r2.tenant_id
          where r2.profile_id = _r.profile_id
            and _r.profile_id is not null
            and r2.tenant_id in (select app_fn.tenant_tree_ids(_tenant_id))
            and r2.type <> 'support'
            and r2.status <> 'removed'
        ) s
      )
    );
  end;
  $function$
  ;

CREATE OR REPLACE FUNCTION app_api.subtree_resident_detail(_resident_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  AS $function$
  BEGIN
    perform jwt.enforce_permission('p:app-admin');
    return app_fn.subtree_resident_detail(jwt.tenant_id(), _resident_id);
  end;
  $function$
  ;
