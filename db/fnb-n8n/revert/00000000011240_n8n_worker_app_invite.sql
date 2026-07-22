-- Revert fnb-n8n:00000000011240_n8n_worker_app_invite from pg

begin;

revoke execute on function
  app_fn.invite_user(uuid, citext, app.license_type_assignment_scope)
  from n8n_worker;
revoke usage on schema app_fn from n8n_worker;

commit;
