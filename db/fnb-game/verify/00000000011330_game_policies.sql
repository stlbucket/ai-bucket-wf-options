-- RLS enabled everywhere
select 1/(count(*) / 5) from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'game' and c.relrowsecurity = true
  and c.relname in ('game_type', 'game', 'game_player', 'game_event', 'game_event_state');

-- deny-all: authenticated must NOT read snapshots
select 1/(1 - pg_catalog.has_table_privilege('authenticated', 'game.game_event_state', 'select')::int);

-- closed game_fn surface: authenticated must NOT execute the referee fns
select 1/(1 - pg_catalog.has_function_privilege('authenticated', 'game_fn.record_referee_result(uuid, jsonb)', 'execute')::int);
select 1/(1 - pg_catalog.has_function_privilege('authenticated', 'game_fn.engine_context(uuid)', 'execute')::int);

-- n8n_worker holds exactly its two-function surface
select 1/pg_catalog.has_function_privilege('n8n_worker', 'game_fn.engine_context(uuid)', 'execute')::int;
select 1/pg_catalog.has_function_privilege('n8n_worker', 'game_fn.record_referee_result(uuid, jsonb)', 'execute')::int;
select 1/(1 - pg_catalog.has_function_privilege('n8n_worker', 'game_fn.create_game(uuid, text, citext, jsonb)', 'execute')::int);
select 1/(1 - pg_catalog.has_table_privilege('n8n_worker', 'game.game', 'select')::int);
