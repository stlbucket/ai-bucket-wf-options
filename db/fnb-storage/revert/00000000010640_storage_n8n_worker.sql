begin;

revoke all on function storage_fn.resolve_asset_scan(uuid, storage.scan_status, text, text) from n8n_worker;
revoke all on function storage_fn.insert_derived_asset(uuid,uuid,text,text,text,bigint,text,citext[]) from n8n_worker;
revoke all on function storage_fn.add_asset_tags(uuid,citext[]) from n8n_worker;
revoke usage on schema storage_fn from n8n_worker;
revoke usage on schema storage from n8n_worker;

drop function if exists storage_fn.stuck_pending_assets(int, int);
drop function if exists storage_fn.asset_for_scan(uuid);

commit;
