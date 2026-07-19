-- Deploy fnb-location-datasets:00000000010715_location_datasets_api to pg

begin;

---------------------------------------------- search_breweries
CREATE OR REPLACE FUNCTION location_datasets_api.search_breweries(
    _options location_datasets_fn.search_breweries_options
  )
  RETURNS setof location_datasets.brewery
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
    select b.*
    from location_datasets.brewery b
    join loc.location l on l.id = b.location_id
    where (_options.search_text is null or b.name ilike '%'||_options.search_text||'%')
      and (_options.brewery_type is null or b.brewery_type = _options.brewery_type)
      and (_options.state is null or l.state ilike _options.state)
      and (_options.country is null or l.country ilike _options.country)
      and (_options.is_geolocated is null or l.is_geolocated = _options.is_geolocated)
    order by b.name, b.id
    limit _limit
    offset _offset
    ;
  end;
  $$;

---------------------------------------------- brewery_map_points
CREATE OR REPLACE FUNCTION location_datasets_api.brewery_map_points()
  RETURNS setof location_datasets_fn.brewery_map_point
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  AS $$
  BEGIN
    PERFORM jwt.enforce_any_permission(array['p:app-user','p:app-admin']::citext[]);

    return query
    select b.id, b.name, b.brewery_type, l.lat, l.lon
    from location_datasets.brewery b
    join loc.location l on l.id = b.location_id
    where l.is_geolocated
    ;
  end;
  $$;

---------------------------------------------- brewery_sync_status
CREATE OR REPLACE FUNCTION location_datasets_api.brewery_sync_status()
  RETURNS location_datasets_fn.brewery_sync_status
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  AS $$
  BEGIN
    PERFORM jwt.enforce_any_permission(array['p:app-user','p:app-admin']::citext[]);

    return location_datasets_fn.brewery_sync_status();
  end;
  $$;

commit;
