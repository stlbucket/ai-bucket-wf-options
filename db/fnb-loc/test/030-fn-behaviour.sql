-- loc_fn.create_location behaviour: inserts a location owned by the resident's tenant, stamps
-- resident_urn + generated urn, registers a res.resource, and rejects a bad resident.
-- Spec: .claude/specs/db-testing/fn-behaviour-tests.md. Run as owner (resident_id passed explicitly).
\set t_a   '11111111-1111-1111-1111-111111111111'
\set res_a '55555555-5555-5555-5555-555555555555'

begin;
set search_path to tap, public;
select plan(5);

select test._seed_tenant(:'t_a'::uuid, 'tenant-a');
select test._seed_resident(:'res_a'::uuid, :'t_a'::uuid);

select loc_fn.create_location(
  row(null::uuid, 'my place'::text, '123 st'::text, null, null, null, null, null, null, null)
    ::loc_fn.location_info,
  :'res_a'::uuid);

-- (1) location created in the resident's tenant
select is(
  (select count(*)::int from loc.location where name = 'my place' and tenant_id = :'t_a'::uuid), 1,
  'create_location inserted the location for the resident tenant');
-- (2) resident_urn stamped from the resident
select is(
  (select resident_urn from loc.location where name = 'my place'),
  res_fn.build_urn(:'t_a'::uuid, 'app', 'resident', :'res_a'::uuid),
  'location.resident_urn is the creating resident urn');
-- (3) generated urn present
select isnt((select urn from loc.location where name = 'my place'), null,
  'location has a generated urn');
-- (4) registered in res.resource as module loc
select is(
  (select count(*)::int from res.resource r join loc.location l on l.id = r.id
     where l.name = 'my place' and r.module = 'loc'), 1,
  'create_location registered a res.resource (module loc)');
-- (5) bad resident rejected
select throws_ok(
  $$ select loc_fn.create_location(
       row(null::uuid, 'nope'::text, null, null, null, null, null, null, null, null)
         ::loc_fn.location_info, gen_random_uuid()) $$,
  'P0001', null, 'create_location rejects a non-existent resident');

select * from finish();
rollback;
