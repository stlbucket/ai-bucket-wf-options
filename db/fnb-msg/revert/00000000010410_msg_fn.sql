-- TODO: verify this is correct
-- Note: app_fn.tg__graphql_subscription was created with CREATE OR REPLACE — its prior definition
-- is not known, so it cannot be restored here. Drop only if it was not pre-existing.
drop trigger if exists _500_gql_insert on msg.message;

drop function if exists msg_fn.delete_topic(uuid);
drop function if exists msg_api.delete_topic(uuid);
drop function if exists msg_fn.deactivate_subscriber(uuid);
drop function if exists msg_api.deactivate_subscriber(uuid);
drop function if exists msg_fn.upsert_subscriber(msg_fn.subscriber_info);
drop function if exists msg_api.upsert_subscriber(msg_fn.subscriber_info);
drop function if exists msg_fn.upsert_message(msg_fn.message_info, uuid);
drop function if exists msg_api.upsert_message(msg_fn.message_info);
drop function if exists msg_fn.upsert_topic(msg_fn.topic_info, uuid);
drop function if exists msg_api.upsert_topic(msg_fn.topic_info);
