begin;

drop function if exists app_fn.provision_idp_user(text, citext, citext);

alter table app.profile drop column if exists idp_user_id;

commit;
