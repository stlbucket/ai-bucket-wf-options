----------------------------------------------------------------------------------------------
-- this schema provides helpers, primarily to access jwt->user_metadata->A-VALUE
----------------------------------------------------------------------------------------------
create schema if not exists jwt;
----------------------------------------------------------------------------------------------
CREATE TYPE jwt.jwt_definition AS (
  iss         text,
  sub         text,
  aud         text,
  exp         bigint,
  iat         bigint,
  email       text,
  role        text,
  user_metadata jsonb
);
----------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION jwt.jwt()
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY INVOKER
  AS $$
    select coalesce(
      nullif(current_setting('request.jwt.claims', true), ''),
      '{}'
    )::jsonb
  $$;
----------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION jwt.uid()
  RETURNS uuid
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  AS $function$
  DECLARE
  BEGIN
    return ((jwt.jwt()->'user_metadata')->>'profile_id')::uuid;
  end;
  $function$
  ;
----------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION jwt.user_permissions()
  RETURNS citext[]
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  AS $function$
  DECLARE
    _user_metadata jsonb;
    _permissions_text text;
    _permissions citext[];
  BEGIN
    _user_metadata = jwt.jwt()->'user_metadata';
    _permissions_text = _user_metadata->>'permissions';

    if _permissions_text is null then
      _permissions = '{}'::citext[];
    else
      _permissions := array(select jsonb_array_elements_text((_user_metadata->'permissions')))::citext[];
    end if;

    return _permissions;
  end;
  $function$
  ;
----------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION jwt.tenant_id()
  RETURNS uuid
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  AS $function$
  DECLARE
    _tenant_id uuid;
  BEGIN
    _tenant_id := ((jwt.jwt()->'user_metadata')->>'tenant_id')::uuid;
    return _tenant_id;
  end;
  $function$
  ;
----------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION jwt.resident_id()
  RETURNS uuid
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  AS $function$
  DECLARE
    _resident_id uuid;
  BEGIN
    _resident_id := ((jwt.jwt()->'user_metadata')->>'resident_id')::uuid;
    return _resident_id;
  end;
  $function$
  ;
----------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION jwt.profile_id()
  RETURNS uuid
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  AS $function$
  DECLARE
    _profile_id uuid;
  BEGIN
    _profile_id := ((jwt.jwt()->'user_metadata')->>'profile_id')::uuid;
    return _profile_id;
  end;
  $function$
  ;
----------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION jwt.actual_resident_id()
  RETURNS uuid
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  AS $function$
  DECLARE
    _resident_id uuid;
  BEGIN
    _resident_id := ((jwt.jwt()->'user_metadata')->>'actual_resident_id')::uuid;
    return _resident_id;
  end;
  $function$
  ;
----------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION jwt.email()
  RETURNS citext
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  AS $function$
  DECLARE
    _email citext;
  BEGIN
    _email := (jwt.jwt()->>'email')::citext;
    return _email;
  end;
  $function$
  ;
----------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION jwt.display_name()
  RETURNS citext
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  AS $function$
  DECLARE
    _display_name citext;
  BEGIN
    _display_name := (jwt.jwt()->>'display_name')::citext;
    return _display_name;
  end;
  $function$
  ;
  
----------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION jwt.enforce_permission(_permission_key citext, _tenant_id uuid default null)
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  AS $function$
  DECLARE
    _has_permission boolean;
  BEGIN
    _has_permission := jwt.has_permission(_permission_key, _tenant_id);
    
    if _has_permission = false then raise exception '30000: NOT AUTHORIZED'; end if;

    return _has_permission;
  end;
  $function$
  ;
----------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION jwt.enforce_any_permission(_permission_keys citext[], _tenant_id uuid default null)
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  AS $function$
  DECLARE
    _has_permission boolean := false;
    _permission_key citext;
  BEGIN
    foreach _permission_key in array _permission_keys
    loop
      if jwt.has_permission(_permission_key, _tenant_id) then
        _has_permission := true;
        exit;  -- first match is enough
      end if;
    end loop;

    if _has_permission = false then raise exception '30000: NOT AUTHORIZED'; end if;

    return _has_permission;
  end;
  $function$
;
----------------------------------- auth
CREATE OR REPLACE FUNCTION jwt.has_permission(_permission_key citext, _tenant_id uuid default null)
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  AS $function$
  DECLARE
    _retval boolean;
    _permissions citext[];
  BEGIN
    _retval := (
      SELECT _permission_key = any(jwt.user_permissions())
    );
    if _tenant_id is not null then
      _retval := (select _retval and jwt.tenant_id() = _tenant_id);
    end if;
    return _retval;
  end;
  $function$
  ;
--------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION jwt.has_all_permissions(_permission_keys citext[], _tenant_id uuid default null)
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  AS $function$
  DECLARE
    _retval boolean;
  BEGIN
    -- every requested key must be present in the caller's permissions (exact match, mirroring
    -- jwt.has_permission). `<@` = "is contained by"; empty input → true (vacuously all-held).
    _retval := (_permission_keys <@ jwt.user_permissions());
    if _tenant_id is not null then
      _retval := (_retval and jwt.tenant_id() = _tenant_id);
    end if;
    return _retval;
  end;
  $function$
  ;

 --- jwt policies
 grant usage on schema jwt to anon, authenticated, service_role;
 grant all on all routines in schema jwt to anon, authenticated, service_role;
 alter default privileges for role postgres in schema jwt grant all on routines to anon, authenticated, service_role;