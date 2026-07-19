-- Deploy fnb-airports:00000000010815_airports_api to pg

begin;

---------------------------------------------- search_airports
CREATE OR REPLACE FUNCTION airports_api.search_airports(
    _options airports_fn.search_airports_options
  )
  RETURNS setof airports.airport
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  AS $$
  DECLARE
    _limit int := coalesce((_options.paging_options).item_limit, 25);
    _offset int;
  BEGIN
    PERFORM jwt.enforce_any_permission(array['p:app-user','p:app-admin']::citext[]);

    _offset := coalesce(
      (_options.paging_options).item_offset
      ,coalesce((_options.paging_options).page_offset, 0) * _limit
    );

    return query
    select a.*
    from airports.airport a
    where (_options.search_text is null
            or a.name ilike '%'||_options.search_text||'%'
            or a.ident = _options.search_text::citext
            or a.icao_code = _options.search_text::citext
            or a.iata_code = _options.search_text::citext
            or a.gps_code = _options.search_text::citext)
      and (_options.airport_type is null or a.type = _options.airport_type)
      and (_options.continent is null or a.continent = _options.continent)
      and (_options.iso_country is null or a.iso_country = _options.iso_country)
      and (_options.iso_region is null or a.iso_region = _options.iso_region)
      and (_options.scheduled_service is null or a.scheduled_service = _options.scheduled_service)
    order by a.name, a.id
    limit _limit
    offset _offset
    ;
  end;
  $$;

---------------------------------------------- airport_map_points
-- Excludes type='closed' (13k+ rows) unless include_closed — payload discipline for the map;
-- airports are 100% geocoded upstream, so no is_geolocated filter is needed.
CREATE OR REPLACE FUNCTION airports_api.airport_map_points(
    _options airports_fn.airport_map_point_options
  )
  RETURNS setof airports_fn.airport_map_point
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  AS $$
  BEGIN
    PERFORM jwt.enforce_any_permission(array['p:app-user','p:app-admin']::citext[]);

    return query
    select a.id, a.ident, a.name, a.type, a.iata_code, l.lat, l.lon
    from airports.airport a
    join loc.location l on l.id = a.location_id
    where l.lat is not null and l.lon is not null
      and (coalesce(_options.include_closed, false) or a.type != 'closed')
    ;
  end;
  $$;

---------------------------------------------- airport_sync_status
CREATE OR REPLACE FUNCTION airports_api.airport_sync_status()
  RETURNS airports_fn.airport_sync_status
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  AS $$
  BEGIN
    PERFORM jwt.enforce_any_permission(array['p:app-user','p:app-admin']::citext[]);

    return airports_fn.airport_sync_status();
  end;
  $$;

commit;
