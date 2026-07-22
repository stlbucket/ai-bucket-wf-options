select 1/count(*) from pg_proc where proname = 'record_send'     and pronamespace = 'notify_fn'::regnamespace;
select 1/count(*) from pg_proc where proname = 'update_delivery' and pronamespace = 'notify_fn'::regnamespace;
select 1/count(*) from pg_proc where proname = 'status_rank'     and pronamespace = 'notify_fn'::regnamespace;
