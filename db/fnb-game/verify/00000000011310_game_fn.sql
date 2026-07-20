select pg_catalog.has_function_privilege('postgres', 'game_fn.engine_context(uuid)', 'execute');
select pg_catalog.has_function_privilege('postgres', 'game_fn.record_referee_result(uuid, jsonb)', 'execute');
select pg_catalog.has_function_privilege('postgres', 'game_fn.create_game(uuid, text, citext, jsonb)', 'execute');
select pg_catalog.has_function_privilege('postgres', 'game_fn.submit_event(uuid, text, jsonb)', 'execute');
select pg_catalog.has_function_privilege('postgres', 'game_fn.resign_game(uuid, text)', 'execute');
select pg_catalog.has_function_privilege('postgres', 'game_fn.player_view(uuid, text, int)', 'execute');
