begin;

delete from res.module_permission where module = 'game';

drop schema if exists game_api cascade;
drop schema if exists game_fn cascade;
drop schema if exists game cascade;

commit;
