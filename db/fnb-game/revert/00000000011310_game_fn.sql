begin;

drop function if exists game_fn.player_view(uuid, text, int);
drop function if exists game_fn.resign_game(uuid, text);
drop function if exists game_fn.submit_event(uuid, text, jsonb);
drop function if exists game_fn.create_game(uuid, text, citext, jsonb);
drop function if exists game_fn.record_referee_result(uuid, jsonb);
drop function if exists game_fn.engine_context(uuid);

commit;
