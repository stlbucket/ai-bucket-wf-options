begin;

drop policy if exists view_notifications_super_admin on notify.notification;
alter table notify.notification disable row level security;

revoke all on all functions in schema notify_fn from n8n_worker;
revoke usage on schema notify_fn from n8n_worker;
revoke usage on schema notify from n8n_worker;

commit;
