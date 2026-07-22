-- Verify fnb-n8n:00000000011240_n8n_worker_app_invite on pg

begin;

-- n8n_worker must be able to execute app_fn.invite_user (errors via 1/0 if the grant is missing).
select case
  when has_function_privilege(
    'n8n_worker',
    'app_fn.invite_user(uuid, citext, app.license_type_assignment_scope)',
    'execute'
  ) then 1
  else 1 / 0
end;

rollback;
