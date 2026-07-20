select pg_catalog.has_function_privilege('postgres', 'game_api.create_game(citext, jsonb)', 'execute');
select pg_catalog.has_function_privilege('postgres', 'game_api.submit_event(uuid, jsonb)', 'execute');
select pg_catalog.has_function_privilege('postgres', 'game_api.resign_game(uuid)', 'execute');
select pg_catalog.has_function_privilege('postgres', 'game_api.my_games(citext)', 'execute');
select pg_catalog.has_function_privilege('postgres', 'game_api.game_view(uuid, int)', 'execute');
