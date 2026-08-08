-- Hot-fix: U10 — invite_user profile fields (first/last/display/phone) on an ALREADY-MIGRATED DB.
--
-- WHY A HOT-FIX FILE (not the sqitch deploy file): the U10 change was made by editing the
-- already-deployed sqitch change `fnb-app:00000000010242_app_fn_definers` in place (dev is
-- rebuild-only). A normal prod deploy runs `sqitch deploy`, which SKIPS an already-deployed change,
-- so the edit never reaches prod that way. And the deploy file can't be replayed wholesale against a
-- fully-migrated DB — it still references `auth.user`, which a LATER change (`00000000010280`)
-- dropped, so a replay fails on `relation "auth.user" does not exist` long before it reaches
-- invite_user. This file carries ONLY the invite_user delta + its n8n_worker grant, references only
-- objects that still exist, and is idempotent (safe to re-run).
--
-- Apply to do-prod (no data loss):  pnpm do-db-exec db/hotfixes/2026-08-07_u10_invite_user_profile_fields.sql
-- Mirrors: fnb-app:00000000010242 (function) + fnb-n8n:00000000011240 (grant). Keep in sync if
-- invite_user's body changes again. Delete once prod has been rebuilt from the sqitch tree.

begin;

-- Drop BOTH the stale 3-arg signature and (for idempotent re-runs) the 7-arg one. Grants on either
-- are removed with the function and re-established below.
drop function if exists app_fn.invite_user(uuid, citext, app.license_type_assignment_scope);
drop function if exists app_fn.invite_user(uuid, citext, app.license_type_assignment_scope, citext, citext, citext, citext);

CREATE OR REPLACE FUNCTION app_fn.invite_user(
    _tenant_id uuid
    ,_email citext
    ,_assignment_scope app.license_type_assignment_scope default 'user'
    -- U10: optional profile details from the Invite-User popup; all default null so every existing
    -- 3-arg caller stays valid.
    ,_first_name citext default null
    ,_last_name citext default null
    ,_display_name_in citext default null
    ,_phone citext default null
  )
  RETURNS app.resident
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
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

    if _profile.id is null then
      -- U10 display_name resolution (display_name is UNIQUE):
      --  * caller supplied one → EXPLICIT input, so a collision is a hard error (31020).
      --  * none supplied → collision-safe auto-derivation (email local part, else null).
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
      -- U10 re-invite: FILL ONLY BLANKS — never overwrite a value the person already has.
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

-- Mirror fnb-n8n:00000000011240 — the invite-user workflow calls this as n8n_worker.
grant usage on schema app_fn to n8n_worker;
grant execute on function
  app_fn.invite_user(uuid, citext, app.license_type_assignment_scope, citext, citext, citext, citext)
  to n8n_worker;

commit;
