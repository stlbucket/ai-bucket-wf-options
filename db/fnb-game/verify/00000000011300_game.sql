select pg_catalog.has_schema_privilege('game', 'usage');
select pg_catalog.has_schema_privilege('game_fn', 'usage');
select pg_catalog.has_schema_privilege('game_api', 'usage');

select id, name, status, min_player_seats, max_player_seats, supported_player_kinds, default_config
from game.game_type
where false;

select id, tenant_id, game_type_id, status, seat_count, expecting_seats, event_count, urn,
       created_at, updated_at, finished_at
from game.game
where false;

select id, tenant_id, game_id, seat, player_kind, resident_urn, outcome, resigned_at
from game.game_player
where false;

select id, tenant_id, game_id, event_type, seat, event_number, event_data, status,
       rejection_reason, created_at, applied_at
from game.game_event
where false;

select 1/count(*) from pg_trigger where tgname = 'tg__game_state';
select 1/count(*) from res.module_permission where module = 'game';
select 1/(count(*) / 3) from game.game_type;
