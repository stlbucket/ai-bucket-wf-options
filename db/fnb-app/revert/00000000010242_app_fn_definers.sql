-- Revert fnb:00000000010242_app_fn_definers from pg

begin;

drop function if exists app_api.get_ab_listings(uuid) cascade;
drop function if exists app_fn.demo_profile_residencies() cascade;
drop function if exists app_api.demo_profile_residencies() cascade;
drop function if exists app_fn.invite_user(uuid, citext, app.license_type_assignment_scope) cascade;
drop function if exists app_fn.update_profile(uuid, citext, citext, citext, citext) cascade;
drop function if exists app_api.update_profile(citext, citext, citext, citext) cascade;
drop function if exists app_fn.decline_residency(uuid, citext) cascade;
drop function if exists app_api.decline_residency(uuid) cascade;
drop function if exists app_fn.assume_residency(uuid, citext) cascade;
drop function if exists app_api.assume_residency(uuid) cascade;
drop function if exists app_fn.handle_new_user() cascade;
drop function if exists app_fn.configure_user_metadata(uuid) cascade;

commit;
