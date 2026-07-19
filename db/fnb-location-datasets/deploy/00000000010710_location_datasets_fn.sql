-- Deploy fnb-location-datasets:00000000010710_location_datasets_fn to pg

begin;

----------------------------------------------------------------- types
create type location_datasets_fn.upsert_result as (
  inserted int
  ,updated int
);

create type location_datasets_fn.brewery_sync_status as (
  last_synced_at timestamptz
  ,brewery_count int
  ,in_progress boolean
);

create type location_datasets_fn.search_breweries_options as (
  search_text text
  ,brewery_type location_datasets.brewery_type
  ,state text
  ,country text
  ,is_geolocated boolean
  ,paging_options app_fn.paging_options
);

create type location_datasets_fn.brewery_map_point as (
  id uuid
  ,name citext
  ,brewery_type location_datasets.brewery_type
  ,lat text
  ,lon text
);

---------------------------------------------- upsert_breweries -- NO API (worker root-of-trust only)
CREATE OR REPLACE FUNCTION location_datasets_fn.upsert_breweries(_breweries jsonb)
  RETURNS location_datasets_fn.upsert_result
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $$
  DECLARE
    _anchor_tenant_id uuid;
    _brewery jsonb;
    _existing location_datasets.brewery;
    _location_id uuid;
    _address2 text;
    _valid_types text[];
    _raw_type text;
    _use_type location_datasets.brewery_type;
    _notes text;
    _inserted int := 0;
    _updated int := 0;
  BEGIN
    select id into _anchor_tenant_id from app.tenant where type = 'anchor';
    if _anchor_tenant_id is null then
      raise exception '30700: ANCHOR TENANT NOT FOUND';
    end if;

    select array_agg(enumlabel) into _valid_types
    from pg_enum where enumtypid = 'location_datasets.brewery_type'::regtype;

    for _brewery in select * from jsonb_array_elements(_breweries)
    loop
      _address2 := nullif(
        concat_ws(', ', _brewery->>'address_2', _brewery->>'address_3')
        ,''
      );

      -- upstream grows its type vocabulary without notice (taproom et al, 2026-07):
      -- coerce unrecognized values to 'unknown' and record the raw value in notes
      _raw_type := _brewery->>'brewery_type';
      if _raw_type is not null and _raw_type = any(_valid_types) then
        _use_type := _raw_type::location_datasets.brewery_type;
        _notes := _brewery->>'notes';
      else
        _use_type := 'unknown';
        _notes := concat_ws(' | '
          ,_brewery->>'notes'
          ,'upstream brewery_type: ' || coalesce(_raw_type, '(null)')
        );
      end if;

      select b.* into _existing
      from location_datasets.brewery b
      where b.external_id = _brewery->>'id';

      if _existing.id is not null then
        update loc.location set
          name = _brewery->>'name',
          address1 = _brewery->>'address_1',
          address2 = _address2,
          city = _brewery->>'city',
          state = _brewery->>'state_province',
          postal_code = _brewery->>'postal_code',
          country = _brewery->>'country',
          lat = _brewery->>'latitude',
          lon = _brewery->>'longitude'
        where id = _existing.location_id;

        update location_datasets.brewery set
          name = _brewery->>'name',
          notes = _notes,
          brewery_type = _use_type,
          phone = _brewery->>'phone',
          website_url = _brewery->>'website_url',
          updated_at = current_timestamp
        where id = _existing.id;

        _updated := _updated + 1;
      else
        insert into loc.location(
          tenant_id,
          resident_urn,
          is_public,
          name,
          address1,
          address2,
          city,
          state,
          postal_code,
          country,
          lat,
          lon
        ) values (
          _anchor_tenant_id,
          null,
          true,
          _brewery->>'name',
          _brewery->>'address_1',
          _address2,
          _brewery->>'city',
          _brewery->>'state_province',
          _brewery->>'postal_code',
          _brewery->>'country',
          _brewery->>'latitude',
          _brewery->>'longitude'
        )
        returning id into _location_id;
        perform res_fn.register_resource(_location_id, _anchor_tenant_id, 'loc', 'location');

        insert into location_datasets.brewery(
          external_id,
          location_id,
          name,
          notes,
          brewery_type,
          phone,
          website_url
        ) values (
          _brewery->>'id',
          _location_id,
          _brewery->>'name',
          _notes,
          _use_type,
          _brewery->>'phone',
          _brewery->>'website_url'
        );

        _inserted := _inserted + 1;
      end if;
    end loop;

    return (_inserted, _updated)::location_datasets_fn.upsert_result;
  end;
  $$;

---------------------------------------------- brewery_sync_status
CREATE OR REPLACE FUNCTION location_datasets_fn.brewery_sync_status()
  RETURNS location_datasets_fn.brewery_sync_status
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  AS $$
  DECLARE
    _retval location_datasets_fn.brewery_sync_status;
  BEGIN
    select max(b.updated_at), count(*)::int
    into _retval.last_synced_at, _retval.brewery_count
    from location_datasets.brewery b;

    -- either engine syncing this dataset counts (n8n-parallel-engine/dataset-sync.workflow.data.md)
    _retval.in_progress := agent_fn.running_count('sync-breweries') > 0
      or n8n_fn.running_count('n8n-sync-breweries') > 0;

    return _retval;
  end;
  $$;

---------------------------------------------- agent_worker grants (agentic workflow engine)
-- The sync-breweries workflow's tool handlers connect as agent_worker and call
-- upsert_breweries per page — same jsonb payload the retired worker handler sent.
grant usage on schema location_datasets to agent_worker;
grant usage on schema location_datasets_fn to agent_worker;
grant execute on function location_datasets_fn.upsert_breweries(jsonb) to agent_worker;

---------------------------------------------- n8n_worker grants (n8n dataset-sync twin)
-- The n8n-sync-breweries workflow's Postgres nodes connect as n8n_worker and call
-- upsert_breweries per page (n8n-parallel-engine/dataset-sync.workflow.data.md).
grant usage on schema location_datasets to n8n_worker;
grant usage on schema location_datasets_fn to n8n_worker;
grant execute on function location_datasets_fn.upsert_breweries(jsonb) to n8n_worker;

commit;
