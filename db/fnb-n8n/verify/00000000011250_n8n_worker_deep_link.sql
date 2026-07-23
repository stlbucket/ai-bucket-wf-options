-- Verify fnb-n8n:00000000011250_n8n_worker_deep_link on pg

begin;

-- n8n_worker must be able to execute app_fn.resolve_send_recipients (errors via 1/0 if missing).
select case
  when has_function_privilege(
    'n8n_worker',
    'app_fn.resolve_send_recipients(uuid, uuid[], text[])',
    'execute'
  ) then 1
  else 1 / 0
end;

rollback;
