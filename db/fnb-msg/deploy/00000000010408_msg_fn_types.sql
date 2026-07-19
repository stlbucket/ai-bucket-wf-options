create schema if not exists msg_api;
create schema if not exists msg_fn;

create type msg_fn.subscriber_info as (
  topic_id uuid
  ,resident_urn text
);

create type msg_fn.message_info as (
  id uuid
  ,topic_id uuid
  ,content citext
  ,tags citext[]
);

create type msg_fn.topic_info as (
  id uuid
  ,name citext
  ,identifier citext
  ,status msg.topic_status
  ,subscribers msg_fn.subscriber_info[]
  ,initial_message citext
  ,subject_urn text   -- TRAILING position (composite-append convention)
);
