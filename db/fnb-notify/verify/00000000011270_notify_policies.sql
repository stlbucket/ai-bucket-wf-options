select 1/count(*) from pg_policies where schemaname = 'notify' and tablename = 'notification' and policyname = 'view_notifications_super_admin';
select pg_catalog.has_function_privilege('n8n_worker', 'notify_fn.record_send(notify.notification_channel, citext, citext, text, jsonb, uuid, uuid, text, text, text, notify.notification_status, jsonb)', 'execute');
select pg_catalog.has_function_privilege('n8n_worker', 'notify_fn.update_delivery(text, notify.notification_status, jsonb)', 'execute');
