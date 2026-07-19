begin;

SELECT 1 FROM pg_roles WHERE rolname = 'authenticator' AND NOT rolsuper AND NOT rolinherit;

rollback;
