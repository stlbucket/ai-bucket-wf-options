-- Deploy fnb-loc:00000000010340_loc_public_locations to pg

alter table loc.location add column is_public boolean not null default false;
alter table loc.location alter column resident_urn drop not null;

CREATE POLICY view_public ON loc.location
  FOR SELECT
  USING (is_public = true)
  ;
