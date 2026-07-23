-- Revert fnb-n8n:00000000011250_n8n_worker_deep_link from pg

begin;

revoke execute on function
  app_fn.resolve_send_recipients(uuid, uuid[], text[])
  from n8n_worker;
-- usage on schema app_fn stays — it is owned by 11240 (n8n_worker_app_invite).

commit;
