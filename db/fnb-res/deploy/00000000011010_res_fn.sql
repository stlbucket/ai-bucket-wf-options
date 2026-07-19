-- res_fn functions (.claude/specs/urn-registry/_shared.data.md §4.3).
-- build_urn ships with 00000000011000_res (res.resource.urn is generated from it).

------------------------------------------------------------------------ uuid_generate_v7
-- RFC 9562 UUIDv7: 48-bit unix-ms timestamp + random. Convention (forward-only): NEW
-- business tables default their PK to this instead of gen_random_uuid(); existing tables
-- keep v4. Swap the body to native uuidv7() when the postgres image reaches PG18.
create function res_fn.uuid_generate_v7()
returns uuid
language plpgsql
volatile parallel safe
as $$
declare
  _buf bytea;
begin
  _buf := substring(int8send((extract(epoch from clock_timestamp()) * 1000)::bigint) from 3 for 6)
          || gen_random_bytes(10);
  _buf := set_byte(_buf, 6, (b'0111' || get_byte(_buf, 6)::bit(4))::bit(8)::int);  -- version 7
  _buf := set_byte(_buf, 8, (b'10'   || get_byte(_buf, 8)::bit(6))::bit(8)::int);  -- variant 10
  return encode(_buf, 'hex')::uuid;
end;
$$;

------------------------------------------------------------------------ register_resource
-- Idempotent (ON CONFLICT DO NOTHING) so upsert-shaped flows (dataset syncs) are safe.
-- SECURITY DEFINER: res.resource is deny-all for direct DML; only these functions write it.
-- Receives explicit args — never calls jwt.* (house rule: that is the _api layer's job).
create function res_fn.register_resource(
  _id uuid
  ,_tenant_id uuid
  ,_module citext
  ,_resource_type citext
  ,_resident_id uuid default null
)
returns uuid
language sql
security definer
set search_path = pg_catalog, public
as $$
  insert into res.resource (id, tenant_id, module, resource_type, created_by_resident_id)
  values (_id, _tenant_id, _module, _resource_type, _resident_id)
  on conflict (id) do nothing
  returning id;
$$;

------------------------------------------------------------------------ archive_resource
create function res_fn.archive_resource(_id uuid)
returns void
language sql
security definer
set search_path = pg_catalog, public
as $$
  update res.resource set archived_at = current_timestamp
  where id = _id and archived_at is null;
$$;
