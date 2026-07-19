-- Revert fnb-loc:00000000010340_loc_public_locations from pg

begin;

drop policy if exists view_public on loc.location;

-- public dataset rows are the only ones with a null resident_urn; remove them
-- so the not-null constraint can be restored
delete from loc.location where resident_urn is null;
alter table loc.location alter column resident_urn set not null;

alter table loc.location drop column if exists is_public;

commit;
