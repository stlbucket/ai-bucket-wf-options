-- Verify fnb:00000000010100_extensions on pg

begin;

select 1 from pg_extension where extname = 'citext';

rollback;
