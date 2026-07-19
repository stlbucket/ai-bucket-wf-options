---------------------------------------------- create_location
CREATE OR REPLACE FUNCTION loc_api.create_location(
    _location_info loc_fn.location_info
  )
  RETURNS loc.location
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $$
  DECLARE
    _retval loc.location;
  BEGIN
    _retval := loc_fn.create_location(
      _location_info
      ,jwt.resident_id()
    );
    return _retval;
  end;
  $$;

CREATE OR REPLACE FUNCTION loc_fn.create_location(
    _location_info loc_fn.location_info
    ,_resident_id uuid
  )
  RETURNS loc.location
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $$
  DECLARE
    _resident app.resident;
    _retval loc.location;
  BEGIN
    select * into _resident from app.resident where id = _resident_id;
    if _resident.id is null then
      raise exception 'no resident for id: %', _resident_id;
    end if;

    insert into loc.location(
      tenant_id,
      resident_urn,
      name,
      address1,
      address2,
      city,
      state,
      postal_code,
      country,
      -- latlon,
      lat,
      lon
    ) values (
      _resident.tenant_id,
      _resident.urn,
      _location_info.name,
      _location_info.address1,
      _location_info.address2,
      _location_info.city,
      _location_info.state,
      _location_info.postal_code,
      _location_info.country,
      -- st_point(coalesce(_location_info.lat::double precision,0::double precision)::double precision, coalesce(_location_info.lon::double precision, 0::double precision)::double precision),
      _location_info.lat,
      _location_info.lon
    )
    returning * into _retval
    ;
    perform res_fn.register_resource(_retval.id, _retval.tenant_id, 'loc', 'location', _resident_id);

    return _retval;
  end;
  $$;
---------------------------------------------- delete_location
CREATE OR REPLACE FUNCTION loc_api.delete_location(_location_id uuid)
  RETURNS boolean
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $$
  DECLARE
    _retval boolean;
  BEGIN
    _retval := loc_fn.delete_location(_location_id);
    return _retval;
  end;
  $$;

CREATE OR REPLACE FUNCTION loc_fn.delete_location(_location_id uuid)
  RETURNS boolean
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $$
  DECLARE
  BEGIN
    delete from loc.location where id = _location_id;
    perform res_fn.archive_resource(_location_id);
    return true;
  end;
  $$;
---------------------------------------------- update_location
CREATE OR REPLACE FUNCTION loc_api.update_location(
    _location_info loc_fn.location_info
  )
  RETURNS loc.location
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $$
  DECLARE
    _retval loc.location;
  BEGIN
    _retval := loc_fn.update_location(
      _location_info
    );
    return _retval;
  end;
  $$;

CREATE OR REPLACE FUNCTION loc_fn.update_location(
    _location_info loc_fn.location_info
  )
  RETURNS loc.location
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $$
  DECLARE
    _retval loc.location;
  BEGIN
    if _location_info.id is null then
      raise exception '30041: LOCATION ID REQUIRED FOR UPDATE';
    end if;

    update loc.location set
      name = _location_info.name,
      address1 = _location_info.address1,
      address2 = _location_info.address2,
      city = _location_info.city,
      state = _location_info.state,
      postal_code = _location_info.postal_code,
      country = _location_info.country,
      lat = _location_info.lat,
      lon = _location_info.lon
    where id = _location_info.id
    returning * into _retval
    ;

    return _retval;
  end;
  $$;
