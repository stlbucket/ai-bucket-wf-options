-- Revert fnb:00000000010220_app from pg

begin;

drop schema if exists app cascade;
drop schema if exists app_fn cascade;

commit;
