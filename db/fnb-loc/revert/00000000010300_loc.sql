-- Revert fnb-loc:00000000010300_loc from pg

begin;

drop schema if exists loc cascade;
drop schema if exists loc_api cascade;
drop schema if exists loc_fn cascade;

commit;
