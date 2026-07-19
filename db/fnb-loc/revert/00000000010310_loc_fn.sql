-- Revert fnb-loc:00000000010310_loc_fn from pg

begin;

drop function if exists loc_api.create_location(loc_fn.location_info) cascade;
drop function if exists loc_fn.create_location(loc_fn.location_info, uuid) cascade;
drop function if exists loc_api.delete_location(uuid) cascade;
drop function if exists loc_fn.delete_location(uuid) cascade;
drop function if exists loc_api.update_location(loc_fn.location_info) cascade;
drop function if exists loc_fn.update_location(loc_fn.location_info) cascade;

commit;
