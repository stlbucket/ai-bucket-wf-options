begin;

SELECT 1 FROM pg_proc
WHERE proname = 'profile_claims_for_user'
  AND pronamespace = 'app_fn'::regnamespace;

rollback;
