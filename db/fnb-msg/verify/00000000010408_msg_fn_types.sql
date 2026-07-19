select 1/count(*) from information_schema.schemata where schema_name = 'msg_fn';
select 1/count(*) from information_schema.schemata where schema_name = 'msg_api';
select 1/count(*) from pg_type where typname = 'subscriber_info' and typnamespace = 'msg_fn'::regnamespace;
select 1/count(*) from pg_type where typname = 'message_info' and typnamespace = 'msg_fn'::regnamespace;
select 1/count(*) from pg_type where typname = 'topic_info' and typnamespace = 'msg_fn'::regnamespace;
