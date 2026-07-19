-- Deploy fnb-airports:00000000010810_airports_fn to pg

begin;

----------------------------------------------------------------- types
create type airports_fn.upsert_result as (
  inserted int
  ,updated int
  ,skipped int
);

create type airports_fn.airport_sync_status as (
  last_synced_at timestamptz
  ,airport_count int
  ,runway_count int
  ,frequency_count int
  ,navaid_count int
  ,country_count int
  ,region_count int
  ,in_progress boolean
);

create type airports_fn.search_airports_options as (
  search_text text
  ,airport_type airports.airport_type
  ,continent airports.continent
  ,iso_country citext
  ,iso_region citext
  ,scheduled_service boolean
  ,paging_options app_fn.paging_options
);

create type airports_fn.airport_map_point_options as (
  include_closed boolean
);

create type airports_fn.airport_map_point as (
  id uuid
  ,ident citext
  ,name citext
  ,type airports.airport_type
  ,iata_code citext
  ,lat text
  ,lon text
);

---------------------------------------------- coerce_enum_label
-- The drift armor: upstream vocabularies are open (the data dictionary already disagrees with
-- the live data). Returns the matching enum label (exact, then case-insensitive) or null when
-- unrecognized — callers substitute 'unknown' and record the raw value in notes.
CREATE OR REPLACE FUNCTION airports_fn.coerce_enum_label(_enum_type regtype, _raw text)
  RETURNS text
  LANGUAGE sql
  STABLE
  AS $$
    select enumlabel::text from pg_enum
    where enumtypid = _enum_type
      and (enumlabel = _raw or lower(enumlabel::text) = lower(_raw))
    order by enumlabel = _raw desc
    limit 1
  $$;

---------------------------------------------- upsert_countries -- NO API (worker root-of-trust only)
CREATE OR REPLACE FUNCTION airports_fn.upsert_countries(_rows jsonb)
  RETURNS airports_fn.upsert_result
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $$
  DECLARE
    _r jsonb;
    _existing_id uuid;
    _continent airports.continent;
    _notes text;
    _inserted int := 0;
    _updated int := 0;
  BEGIN
    for _r in select * from jsonb_array_elements(_rows)
    loop
      _continent := coalesce(
        airports_fn.coerce_enum_label('airports.continent'::regtype, _r->>'continent')
        ,'unknown'
      )::airports.continent;
      _notes := case when _continent = 'unknown' and _r->>'continent' is not null
        then 'upstream continent: ' || (_r->>'continent') end;

      select id into _existing_id from airports.country
      where external_id = (_r->>'id')::int;

      if _existing_id is not null then
        update airports.country set
          code = _r->>'code',
          name = _r->>'name',
          continent = _continent,
          wikipedia_link = _r->>'wikipedia_link',
          keywords = _r->>'keywords',
          notes = _notes,
          updated_at = current_timestamp
        where id = _existing_id;
        _updated := _updated + 1;
      else
        insert into airports.country(external_id, code, name, continent, wikipedia_link, keywords, notes)
        values ((_r->>'id')::int, _r->>'code', _r->>'name', _continent,
                _r->>'wikipedia_link', _r->>'keywords', _notes);
        _inserted := _inserted + 1;
      end if;
    end loop;

    return (_inserted, _updated, 0)::airports_fn.upsert_result;
  end;
  $$;

---------------------------------------------- upsert_regions -- NO API (worker root-of-trust only)
CREATE OR REPLACE FUNCTION airports_fn.upsert_regions(_rows jsonb)
  RETURNS airports_fn.upsert_result
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $$
  DECLARE
    _r jsonb;
    _existing_id uuid;
    _continent airports.continent;
    _notes text;
    _inserted int := 0;
    _updated int := 0;
  BEGIN
    for _r in select * from jsonb_array_elements(_rows)
    loop
      _continent := coalesce(
        airports_fn.coerce_enum_label('airports.continent'::regtype, _r->>'continent')
        ,'unknown'
      )::airports.continent;
      _notes := case when _continent = 'unknown' and _r->>'continent' is not null
        then 'upstream continent: ' || (_r->>'continent') end;

      select id into _existing_id from airports.region
      where external_id = (_r->>'id')::int;

      if _existing_id is not null then
        update airports.region set
          code = _r->>'code',
          local_code = _r->>'local_code',
          name = _r->>'name',
          continent = _continent,
          iso_country = _r->>'iso_country',
          wikipedia_link = _r->>'wikipedia_link',
          keywords = _r->>'keywords',
          notes = _notes,
          updated_at = current_timestamp
        where id = _existing_id;
        _updated := _updated + 1;
      else
        insert into airports.region(external_id, code, local_code, name, continent, iso_country,
                                    wikipedia_link, keywords, notes)
        values ((_r->>'id')::int, _r->>'code', _r->>'local_code', _r->>'name', _continent,
                _r->>'iso_country', _r->>'wikipedia_link', _r->>'keywords', _notes);
        _inserted := _inserted + 1;
      end if;
    end loop;

    return (_inserted, _updated, 0)::airports_fn.upsert_result;
  end;
  $$;

---------------------------------------------- upsert_airports -- NO API (worker root-of-trust only)
-- Each airport owns a public loc.location row (anchor tenant, resident_urn null, is_public true):
-- name, city (upstream municipality), state (iso_region code), country (iso_country code), lat/lon.
CREATE OR REPLACE FUNCTION airports_fn.upsert_airports(_rows jsonb)
  RETURNS airports_fn.upsert_result
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $$
  DECLARE
    _anchor_tenant_id uuid;
    _r jsonb;
    _existing airports.airport;
    _location_id uuid;
    _type airports.airport_type;
    _continent airports.continent;
    _notes text;
    _inserted int := 0;
    _updated int := 0;
  BEGIN
    select id into _anchor_tenant_id from app.tenant where type = 'anchor';
    if _anchor_tenant_id is null then
      raise exception '30800: ANCHOR TENANT NOT FOUND';
    end if;

    for _r in select * from jsonb_array_elements(_rows)
    loop
      _type := coalesce(
        airports_fn.coerce_enum_label('airports.airport_type'::regtype, _r->>'type')
        ,'unknown'
      )::airports.airport_type;
      _continent := coalesce(
        airports_fn.coerce_enum_label('airports.continent'::regtype, _r->>'continent')
        ,'unknown'
      )::airports.continent;
      _notes := nullif(concat_ws(' | '
        ,case when _type = 'unknown' and _r->>'type' is not null
          then 'upstream type: ' || (_r->>'type') end
        ,case when _continent = 'unknown' and _r->>'continent' is not null
          then 'upstream continent: ' || (_r->>'continent') end
      ), '');

      select a.* into _existing from airports.airport a
      where a.external_id = (_r->>'id')::int;

      if _existing.id is not null then
        update loc.location set
          name = _r->>'name',
          city = _r->>'municipality',
          state = _r->>'iso_region',
          country = _r->>'iso_country',
          lat = _r->>'latitude_deg',
          lon = _r->>'longitude_deg'
        where id = _existing.location_id;

        update airports.airport set
          ident = _r->>'ident',
          type = _type,
          name = _r->>'name',
          elevation_ft = (_r->>'elevation_ft')::int,
          continent = _continent,
          iso_country = _r->>'iso_country',
          iso_region = _r->>'iso_region',
          scheduled_service = coalesce((_r->>'scheduled_service')::boolean, false),
          icao_code = _r->>'icao_code',
          iata_code = _r->>'iata_code',
          gps_code = _r->>'gps_code',
          local_code = _r->>'local_code',
          home_link = _r->>'home_link',
          wikipedia_link = _r->>'wikipedia_link',
          keywords = _r->>'keywords',
          notes = _notes,
          updated_at = current_timestamp
        where id = _existing.id;

        _updated := _updated + 1;
      else
        insert into loc.location(
          tenant_id, resident_urn, is_public,
          name, city, state, country, lat, lon
        ) values (
          _anchor_tenant_id, null, true,
          _r->>'name', _r->>'municipality', _r->>'iso_region', _r->>'iso_country',
          _r->>'latitude_deg', _r->>'longitude_deg'
        )
        returning id into _location_id;
        perform res_fn.register_resource(_location_id, _anchor_tenant_id, 'loc', 'location');

        insert into airports.airport(
          external_id, ident, type, name, location_id, elevation_ft, continent,
          iso_country, iso_region, scheduled_service, icao_code, iata_code, gps_code,
          local_code, home_link, wikipedia_link, keywords, notes
        ) values (
          (_r->>'id')::int, _r->>'ident', _type, _r->>'name', _location_id,
          (_r->>'elevation_ft')::int, _continent,
          _r->>'iso_country', _r->>'iso_region',
          coalesce((_r->>'scheduled_service')::boolean, false),
          _r->>'icao_code', _r->>'iata_code', _r->>'gps_code',
          _r->>'local_code', _r->>'home_link', _r->>'wikipedia_link', _r->>'keywords', _notes
        );

        _inserted := _inserted + 1;
      end if;
    end loop;

    return (_inserted, _updated, 0)::airports_fn.upsert_result;
  end;
  $$;

---------------------------------------------- upsert_runways -- NO API (worker root-of-trust only)
-- airport_ref resolves via airport.external_id; rows whose airport is missing are skipped
-- (counted) — parents import first, so this self-heals on the next sync.
CREATE OR REPLACE FUNCTION airports_fn.upsert_runways(_rows jsonb)
  RETURNS airports_fn.upsert_result
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $$
  DECLARE
    _r jsonb;
    _existing_id uuid;
    _airport_id uuid;
    _inserted int := 0;
    _updated int := 0;
    _skipped int := 0;
  BEGIN
    for _r in select * from jsonb_array_elements(_rows)
    loop
      select id into _airport_id from airports.airport
      where external_id = (_r->>'airport_ref')::int;

      if _airport_id is null then
        _skipped := _skipped + 1;
        continue;
      end if;

      select id into _existing_id from airports.runway
      where external_id = (_r->>'id')::int;

      if _existing_id is not null then
        update airports.runway set
          airport_id = _airport_id,
          length_ft = (_r->>'length_ft')::int,
          width_ft = (_r->>'width_ft')::int,
          surface = _r->>'surface',
          lighted = coalesce((_r->>'lighted')::boolean, false),
          closed = coalesce((_r->>'closed')::boolean, false),
          le_ident = _r->>'le_ident',
          le_latitude_deg = _r->>'le_latitude_deg',
          le_longitude_deg = _r->>'le_longitude_deg',
          le_elevation_ft = (_r->>'le_elevation_ft')::int,
          le_heading_deg_t = (_r->>'le_heading_deg_t')::numeric,
          le_displaced_threshold_ft = (_r->>'le_displaced_threshold_ft')::int,
          he_ident = _r->>'he_ident',
          he_latitude_deg = _r->>'he_latitude_deg',
          he_longitude_deg = _r->>'he_longitude_deg',
          he_elevation_ft = (_r->>'he_elevation_ft')::int,
          he_heading_deg_t = (_r->>'he_heading_deg_t')::numeric,
          he_displaced_threshold_ft = (_r->>'he_displaced_threshold_ft')::int,
          updated_at = current_timestamp
        where id = _existing_id;
        _updated := _updated + 1;
      else
        insert into airports.runway(
          external_id, airport_id, length_ft, width_ft, surface, lighted, closed,
          le_ident, le_latitude_deg, le_longitude_deg, le_elevation_ft, le_heading_deg_t,
          le_displaced_threshold_ft,
          he_ident, he_latitude_deg, he_longitude_deg, he_elevation_ft, he_heading_deg_t,
          he_displaced_threshold_ft
        ) values (
          (_r->>'id')::int, _airport_id, (_r->>'length_ft')::int, (_r->>'width_ft')::int,
          _r->>'surface',
          coalesce((_r->>'lighted')::boolean, false), coalesce((_r->>'closed')::boolean, false),
          _r->>'le_ident', _r->>'le_latitude_deg', _r->>'le_longitude_deg',
          (_r->>'le_elevation_ft')::int, (_r->>'le_heading_deg_t')::numeric,
          (_r->>'le_displaced_threshold_ft')::int,
          _r->>'he_ident', _r->>'he_latitude_deg', _r->>'he_longitude_deg',
          (_r->>'he_elevation_ft')::int, (_r->>'he_heading_deg_t')::numeric,
          (_r->>'he_displaced_threshold_ft')::int
        );
        _inserted := _inserted + 1;
      end if;
    end loop;

    return (_inserted, _updated, _skipped)::airports_fn.upsert_result;
  end;
  $$;

---------------------------------------------- upsert_airport_frequencies -- NO API (worker root-of-trust only)
CREATE OR REPLACE FUNCTION airports_fn.upsert_airport_frequencies(_rows jsonb)
  RETURNS airports_fn.upsert_result
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $$
  DECLARE
    _r jsonb;
    _existing_id uuid;
    _airport_id uuid;
    _inserted int := 0;
    _updated int := 0;
    _skipped int := 0;
  BEGIN
    for _r in select * from jsonb_array_elements(_rows)
    loop
      select id into _airport_id from airports.airport
      where external_id = (_r->>'airport_ref')::int;

      if _airport_id is null then
        _skipped := _skipped + 1;
        continue;
      end if;

      select id into _existing_id from airports.airport_frequency
      where external_id = (_r->>'id')::int;

      if _existing_id is not null then
        update airports.airport_frequency set
          airport_id = _airport_id,
          type = _r->>'type',
          description = _r->>'description',
          frequency_mhz = (_r->>'frequency_mhz')::numeric,
          updated_at = current_timestamp
        where id = _existing_id;
        _updated := _updated + 1;
      else
        insert into airports.airport_frequency(external_id, airport_id, type, description, frequency_mhz)
        values ((_r->>'id')::int, _airport_id, _r->>'type', _r->>'description',
                (_r->>'frequency_mhz')::numeric);
        _inserted := _inserted + 1;
      end if;
    end loop;

    return (_inserted, _updated, _skipped)::airports_fn.upsert_result;
  end;
  $$;

---------------------------------------------- upsert_navaids -- NO API (worker root-of-trust only)
-- associated_airport references airport.ident (not id) upstream and is often empty;
-- unresolved idents keep the raw value with a null associated_airport_id (soft ref, not a skip).
CREATE OR REPLACE FUNCTION airports_fn.upsert_navaids(_rows jsonb)
  RETURNS airports_fn.upsert_result
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $$
  DECLARE
    _r jsonb;
    _existing_id uuid;
    _airport_id uuid;
    _type airports.navaid_type;
    _usage airports.navaid_usage_type;
    _power airports.navaid_power;
    _notes text;
    _inserted int := 0;
    _updated int := 0;
  BEGIN
    for _r in select * from jsonb_array_elements(_rows)
    loop
      _type := coalesce(
        airports_fn.coerce_enum_label('airports.navaid_type'::regtype, _r->>'type')
        ,'unknown'
      )::airports.navaid_type;
      _usage := coalesce(
        airports_fn.coerce_enum_label('airports.navaid_usage_type'::regtype, _r->>'usage_type')
        ,'unknown'
      )::airports.navaid_usage_type;
      _power := coalesce(
        airports_fn.coerce_enum_label('airports.navaid_power'::regtype, _r->>'power')
        ,'unknown'
      )::airports.navaid_power;
      _notes := nullif(concat_ws(' | '
        ,case when _type = 'unknown' and _r->>'type' is not null
          then 'upstream type: ' || (_r->>'type') end
        ,case when _usage = 'unknown' and _r->>'usage_type' is not null
          then 'upstream usageType: ' || (_r->>'usage_type') end
        ,case when _power = 'unknown' and nullif(_r->>'power', 'UNKNOWN') is not null
          then 'upstream power: ' || (_r->>'power') end
      ), '');

      _airport_id := null;
      if nullif(_r->>'associated_airport', '') is not null then
        select id into _airport_id from airports.airport
        where ident = (_r->>'associated_airport')::citext;
      end if;

      select id into _existing_id from airports.navaid
      where external_id = (_r->>'id')::int;

      if _existing_id is not null then
        update airports.navaid set
          ident = _r->>'ident',
          name = _r->>'name',
          type = _type,
          frequency_khz = (_r->>'frequency_khz')::numeric,
          latitude_deg = _r->>'latitude_deg',
          longitude_deg = _r->>'longitude_deg',
          elevation_ft = (_r->>'elevation_ft')::int,
          iso_country = _r->>'iso_country',
          dme_frequency_khz = (_r->>'dme_frequency_khz')::numeric,
          dme_channel = _r->>'dme_channel',
          dme_latitude_deg = _r->>'dme_latitude_deg',
          dme_longitude_deg = _r->>'dme_longitude_deg',
          dme_elevation_ft = (_r->>'dme_elevation_ft')::int,
          slaved_variation_deg = (_r->>'slaved_variation_deg')::numeric,
          magnetic_variation_deg = (_r->>'magnetic_variation_deg')::numeric,
          usage_type = _usage,
          power = _power,
          associated_airport_ident = nullif(_r->>'associated_airport', ''),
          associated_airport_id = _airport_id,
          notes = _notes,
          updated_at = current_timestamp
        where id = _existing_id;
        _updated := _updated + 1;
      else
        insert into airports.navaid(
          external_id, ident, name, type, frequency_khz, latitude_deg, longitude_deg,
          elevation_ft, iso_country, dme_frequency_khz, dme_channel, dme_latitude_deg,
          dme_longitude_deg, dme_elevation_ft, slaved_variation_deg, magnetic_variation_deg,
          usage_type, power, associated_airport_ident, associated_airport_id, notes
        ) values (
          (_r->>'id')::int, _r->>'ident', _r->>'name', _type,
          (_r->>'frequency_khz')::numeric, _r->>'latitude_deg', _r->>'longitude_deg',
          (_r->>'elevation_ft')::int, _r->>'iso_country',
          (_r->>'dme_frequency_khz')::numeric, _r->>'dme_channel', _r->>'dme_latitude_deg',
          _r->>'dme_longitude_deg', (_r->>'dme_elevation_ft')::int,
          (_r->>'slaved_variation_deg')::numeric, (_r->>'magnetic_variation_deg')::numeric,
          _usage, _power, nullif(_r->>'associated_airport', ''), _airport_id, _notes
        );
        _inserted := _inserted + 1;
      end if;
    end loop;

    return (_inserted, _updated, 0)::airports_fn.upsert_result;
  end;
  $$;

---------------------------------------------- record_sync_source -- NO API (worker root-of-trust only)
CREATE OR REPLACE FUNCTION airports_fn.record_sync_source(
    _file citext
    ,_etag text
    ,_last_modified text
    ,_row_count int
  )
  RETURNS airports.sync_source
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $$
  DECLARE
    _retval airports.sync_source;
  BEGIN
    insert into airports.sync_source(file, etag, last_modified, row_count, synced_at)
    values (_file, _etag, _last_modified, _row_count, current_timestamp)
    on conflict (file) do update set
      etag = excluded.etag,
      last_modified = excluded.last_modified,
      row_count = excluded.row_count,
      synced_at = excluded.synced_at
    returning * into _retval;

    return _retval;
  end;
  $$;

---------------------------------------------- airport_sync_status
CREATE OR REPLACE FUNCTION airports_fn.airport_sync_status()
  RETURNS airports_fn.airport_sync_status
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  AS $$
  DECLARE
    _retval airports_fn.airport_sync_status;
  BEGIN
    select max(synced_at) into _retval.last_synced_at from airports.sync_source;
    select count(*)::int into _retval.airport_count from airports.airport;
    select count(*)::int into _retval.runway_count from airports.runway;
    select count(*)::int into _retval.frequency_count from airports.airport_frequency;
    select count(*)::int into _retval.navaid_count from airports.navaid;
    select count(*)::int into _retval.country_count from airports.country;
    select count(*)::int into _retval.region_count from airports.region;

    -- either engine syncing this dataset counts (n8n-parallel-engine/dataset-sync.workflow.data.md;
    -- the key runs on n8n since the 2026-07-20 engine move, agent side kept for the dormant rollback)
    _retval.in_progress := agent_fn.running_count('sync-airports') > 0
      or n8n_fn.running_count('sync-airports') > 0;

    return _retval;
  end;
  $$;

---------------------------------------------- agent_worker grants (agentic workflow engine)
-- The sync-airports workflow's tool handlers connect as agent_worker: per-file CSV upserts,
-- sync bookkeeping, and the etag conditional-GET read of airports.sync_source.
grant usage on schema airports to agent_worker;
grant usage on schema airports_fn to agent_worker;
grant execute on function airports_fn.upsert_countries(jsonb) to agent_worker;
grant execute on function airports_fn.upsert_regions(jsonb) to agent_worker;
grant execute on function airports_fn.upsert_airports(jsonb) to agent_worker;
grant execute on function airports_fn.upsert_runways(jsonb) to agent_worker;
grant execute on function airports_fn.upsert_airport_frequencies(jsonb) to agent_worker;
grant execute on function airports_fn.upsert_navaids(jsonb) to agent_worker;
grant execute on function airports_fn.record_sync_source(citext, text, text, int) to agent_worker;
grant select on airports.sync_source to agent_worker;

---------------------------------------------- n8n_worker grants (n8n dataset-sync twin)
-- The n8n-sync-airports workflow's Postgres nodes connect as n8n_worker: per-file chunked
-- upserts, sync bookkeeping, and the etag conditional-GET read of airports.sync_source
-- (n8n-parallel-engine/dataset-sync.workflow.data.md).
grant usage on schema airports to n8n_worker;
grant usage on schema airports_fn to n8n_worker;
grant execute on function airports_fn.upsert_countries(jsonb) to n8n_worker;
grant execute on function airports_fn.upsert_regions(jsonb) to n8n_worker;
grant execute on function airports_fn.upsert_airports(jsonb) to n8n_worker;
grant execute on function airports_fn.upsert_runways(jsonb) to n8n_worker;
grant execute on function airports_fn.upsert_airport_frequencies(jsonb) to n8n_worker;
grant execute on function airports_fn.upsert_navaids(jsonb) to n8n_worker;
grant execute on function airports_fn.record_sync_source(citext, text, text, int) to n8n_worker;
grant select on airports.sync_source to n8n_worker;

commit;
