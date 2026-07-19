create schema msg;

create type msg.topic_status as enum (
  'open'
  ,'closed'
  ,'locked'
);

create type msg.message_status as enum (
  'draft',
  'sent',
  'deleted'
);

create type msg.subscriber_status as enum (
  'active',
  'inactive',
  'blocked'
);

create table msg.topic (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid not null references app.tenant(id),
  subject_urn text null references res.resource(urn),  -- stacking: the business object this discussion is about
  created_at timestamptz not null default current_timestamp,
  name citext not null,
  identifier text,
  tags citext[] not null default '{}'::citext[],
  status msg.topic_status not null default 'open',
  urn text not null
    generated always as (res_fn.build_urn(tenant_id, 'msg', 'topic', id)) stored,
  constraint uq_topic_urn unique (urn),
  constraint fk_topic_resource foreign key (id) references res.resource(id)
    deferrable initially deferred
);
ALTER TABLE ONLY msg.topic
  ADD CONSTRAINT pk_topic PRIMARY KEY (id);
create index idx_topic_tenant_id on msg.topic(tenant_id);
create unique index idx_topic_tenant_identifier on msg.topic (tenant_id, identifier);
create unique index uq_topic_subject_urn on msg.topic (subject_urn)
  where subject_urn is not null;   -- one discussion per subject (relaxable later)

create table msg.message (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid not null references app.tenant(id),
  created_at timestamptz not null default current_timestamp,
  status msg.message_status not null default 'sent',
  topic_id uuid not null references msg.topic(id),
  content citext not null,
  posted_by_resident_urn text not null references res.resource(urn),
  tags text[] not null default '{}'::text[]
);
ALTER TABLE ONLY msg.message
    ADD CONSTRAINT pk_message PRIMARY KEY (id);
create index idx_message_tenant_id on msg.message(tenant_id);
create index idx_message_posted_by_resident_urn on msg.message(posted_by_resident_urn);

create table msg.subscriber (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid not null references app.tenant(id),
  created_at timestamptz not null default current_timestamp,
  status msg.subscriber_status not null default 'active',
  topic_id uuid not null references msg.topic(id),
  resident_urn text not null references res.resource(urn),
  last_read timestamptz not null default current_timestamp
);
ALTER TABLE ONLY msg.subscriber
    ADD CONSTRAINT pk_subscriber PRIMARY KEY (id);
ALTER TABLE ONLY msg.subscriber
    ADD CONSTRAINT uq_subscriber unique (topic_id, resident_urn);
create index idx_subscriber_tenant_id on msg.subscriber(tenant_id);
create index idx_subscriber_resident_urn on msg.subscriber(resident_urn);
