select res_fn.uuid_generate_v7();
select pg_catalog.has_function_privilege(
  'res_fn.register_resource(uuid, uuid, citext, citext, uuid)', 'execute');
select pg_catalog.has_function_privilege('res_fn.archive_resource(uuid)', 'execute');
