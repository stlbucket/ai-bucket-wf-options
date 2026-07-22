select 1/count(*) from pg_proc where proname = 'notifications' and pronamespace = 'notify_api'::regnamespace;
