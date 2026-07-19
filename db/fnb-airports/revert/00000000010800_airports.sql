-- Revert fnb-airports:00000000010800_airports from pg

begin;

drop schema if exists airports_api cascade;
drop schema if exists airports_fn cascade;
drop schema if exists airports cascade;

commit;
