-- Deploy fnb-n8n:00000000011250_n8n_worker_deep_link to pg
-- requires: 00000000011240_n8n_worker_app_invite
-- requires: fnb-app:00000000010295_otp_login

begin;

-- The send-deep-link n8n workflow (OTP-login spec, D14 "Send to residents") resolves each selected
-- resident's deliverable contact by calling app_fn.resolve_send_recipients as the n8n_worker service
-- role (SECURITY DEFINER; tenant-scoped). Same rationale/location as the invite grant (11240):
-- fnb-app deploys BEFORE fnb-n8n, so the n8n_worker role does not exist when fnb-app runs — the grant
-- lives here. `usage on schema app_fn` is already granted to n8n_worker by 11240 (this change depends
-- on it), so only the per-function execute is needed. Least-privilege: exactly this one function.
grant execute on function
  app_fn.resolve_send_recipients(uuid, uuid[], text[])
  to n8n_worker;

commit;
