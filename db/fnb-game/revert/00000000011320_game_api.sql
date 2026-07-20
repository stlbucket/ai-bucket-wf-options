begin;

drop function if exists game_api.game_view(uuid, int);
drop function if exists game_api.my_games(citext);
drop function if exists game_api.resign_game(uuid);
drop function if exists game_api.submit_event(uuid, jsonb);
drop function if exists game_api.create_game(citext, jsonb);

commit;
