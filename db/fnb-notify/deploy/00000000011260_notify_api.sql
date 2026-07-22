-- Deploy fnb-notify:00000000011260_notify_api to pg

begin;

create schema notify_api;

---------------------------------------------- notifications
-- Recent sends for the site-admin send-test page (recent-sends table). Diagnostic surface — gated
-- p:app-admin-super. Mirrors n8n_api.workflow_runs exactly (SECURITY INVOKER; the permission gate
-- + RLS on notify.notification are the enforcement). Exposed to PostGraphile with a smart-tag
-- rename (notify_notifications) so the function field cannot collide with the table's auto-generated
-- notificationsList — see apps/graphql-api-app/postgraphile.tags.json5.
CREATE OR REPLACE FUNCTION notify_api.notifications(
    _channel notify.notification_channel default null
    ,_paging_options app_fn.paging_options default null
  )
  RETURNS setof notify.notification
  LANGUAGE plpgsql
  STABLE
  SECURITY INVOKER
  AS $$
  DECLARE
    _limit int := coalesce((_paging_options).item_limit, 25);
    _offset int;
  BEGIN
    PERFORM jwt.enforce_permission('p:app-admin-super');

    _offset := coalesce(
      (_paging_options).item_offset
      ,coalesce((_paging_options).page_offset, 0) * _limit
    );

    return query
    select n.*
    from notify.notification n
    where (_channel is null or n.channel = _channel)
    order by n.created_at desc, n.id
    limit _limit
    offset _offset
    ;
  end;
  $$;

commit;
