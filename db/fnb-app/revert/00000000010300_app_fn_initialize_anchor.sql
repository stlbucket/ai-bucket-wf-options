-- Revert fnb-app:00000000010300_app_fn_initialize_anchor from pg

begin;

drop function if exists app_fn.initialize_anchor(citext, citext, citext, citext, citext, citext);

drop function if exists app_fn.anchor_exists();

commit;
