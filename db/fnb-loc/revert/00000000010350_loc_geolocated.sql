-- Revert fnb-loc:00000000010350_loc_geolocated from pg

alter table loc.location drop column if exists is_geolocated;
