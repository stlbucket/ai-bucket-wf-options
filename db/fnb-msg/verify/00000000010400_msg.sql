select 1/count(*) from information_schema.schemata where schema_name = 'msg';
select id, urn, subject_urn from msg.topic where false;
select 1/count(*) from pg_indexes where schemaname = 'msg' and indexname = 'uq_topic_subject_urn';
-- stacking v2: the context discriminator is gone
select 1/(1 - count(*)) from information_schema.columns
  where table_schema = 'msg' and table_name = 'topic' and column_name = 'context';
select id, posted_by_resident_urn from msg.message where false;
select id, resident_urn from msg.subscriber where false;
