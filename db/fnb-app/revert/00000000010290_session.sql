begin;

drop function if exists app_api.revoke_my_sessions();
drop function if exists app_fn.revoke_my_sessions(uuid);
drop function if exists app_fn.revoke_session(uuid);
drop function if exists app_fn.claims_for_session(uuid);
drop function if exists app_fn.create_session(uuid);

drop table if exists auth.session;

commit;
