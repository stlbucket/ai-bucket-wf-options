begin;

revoke all on function game_fn.record_referee_result(uuid, jsonb) from n8n_worker;
revoke all on function game_fn.engine_context(uuid) from n8n_worker;
revoke usage on schema game_fn from n8n_worker;
revoke usage on schema game from n8n_worker;

drop policy if exists view_for_tenant on game.game_event;
alter table game.game_event disable row level security;
alter table game.game_event_state disable row level security;
drop policy if exists view_all_for_tenant on game.game_player;
alter table game.game_player disable row level security;
drop policy if exists view_all_for_tenant on game.game;
alter table game.game disable row level security;
drop policy if exists view_all on game.game_type;
alter table game.game_type disable row level security;

revoke all on all functions in schema game_fn from authenticated, service_role;
revoke usage on schema game_fn from authenticated, service_role;
revoke all on all tables in schema game from anon, authenticated, service_role;
revoke usage on schema game from anon, authenticated, service_role;
revoke all on all routines in schema game_api from anon, authenticated, service_role;
revoke usage on schema game_api from anon, authenticated, service_role;

commit;
