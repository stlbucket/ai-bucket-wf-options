-- Deploy fnb-notify:00000000011250_notify_fn to pg

begin;

create schema notify_fn;

-- Outbox writes for the notification pipeline. Called over the n8n_worker connection from inside
-- the send-notification + notification-webhook workflows (the n8n analog of the module _fn writers
-- n8n itself uses). n8n is the sole workflow engine (R22): no app path writes these rows.

---------------------------------------------- status_rank -- monotonic ordering for update_delivery
-- Delivery events can arrive out of order / duplicated. A later event may only ADVANCE the status,
-- never regress it. Failures (bounced/failed) rank highest so they stick once set.
CREATE OR REPLACE FUNCTION notify_fn.status_rank(_status notify.notification_status)
  RETURNS int
  LANGUAGE sql
  IMMUTABLE
  AS $$
    select case _status
      when 'queued'    then 0
      when 'sent'      then 1
      when 'delivered' then 2
      when 'opened'    then 3
      when 'bounced'   then 4
      when 'failed'    then 4
    end;
  $$;

---------------------------------------------- record_send -- send-notification's final Postgres node
-- Inserts one row per send attempt. _status is 'sent' on provider success, 'failed' on error
-- (wire the error branch). Supports both the single-insert path and an enqueue-then-update path
-- (a first call with _status='queued', then update_delivery/a second record after the provider call).
CREATE OR REPLACE FUNCTION notify_fn.record_send(
    _channel notify.notification_channel
    ,_template_key citext
    ,_recipient citext
    ,_subject text default null
    ,_payload jsonb default '{}'::jsonb
    ,_tenant_id uuid default null
    ,_profile_id uuid default null
    ,_provider text default null
    ,_provider_message_id text default null
    ,_n8n_execution_id text default null
    ,_status notify.notification_status default 'sent'
    ,_error jsonb default '{}'::jsonb
  )
  RETURNS uuid
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $$
  DECLARE
    _id uuid;
  BEGIN
    insert into notify.notification(
      channel, status, template_key, recipient, subject, payload,
      tenant_id, profile_id, provider, provider_message_id, n8n_execution_id, error,
      sent_at
    ) values (
      _channel, _status, _template_key, _recipient, _subject, coalesce(_payload, '{}'::jsonb),
      _tenant_id, _profile_id, _provider, _provider_message_id, _n8n_execution_id,
      coalesce(_error, '{}'::jsonb),
      case when _status <> 'queued' and _status <> 'failed' then current_timestamp else null end
    )
    returning id into _id;

    return _id;
  end;
  $$;

---------------------------------------------- update_delivery -- notification-webhook's Postgres node
-- Advances a row on a provider delivery event, matched by provider_message_id. Idempotent and
-- monotonic (never regresses a terminal/higher status — see status_rank). An unknown
-- provider_message_id is a no-op (a mail sent outside this pipeline), not an error.
CREATE OR REPLACE FUNCTION notify_fn.update_delivery(
    _provider_message_id text
    ,_status notify.notification_status
    ,_error jsonb default '{}'::jsonb
  )
  RETURNS void
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $$
  BEGIN
    update notify.notification set
      status = _status
      ,error = coalesce(_error, '{}'::jsonb)
      ,updated_at = current_timestamp
    where provider_message_id = _provider_message_id
      and notify_fn.status_rank(_status) > notify_fn.status_rank(status);
  end;
  $$;

commit;
