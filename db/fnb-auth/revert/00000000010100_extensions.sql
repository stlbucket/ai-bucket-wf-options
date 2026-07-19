-- Revert fnb:00000000010100_extensions from pg

begin;

drop extension if exists citext;

commit;
