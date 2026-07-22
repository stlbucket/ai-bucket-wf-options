select pg_catalog.has_schema_privilege('notify', 'usage');
select id, channel, status, template_key, recipient, subject, payload, tenant_id, profile_id,
       provider, provider_message_id, n8n_execution_id, error, created_at, sent_at, updated_at
from notify.notification
where false;
