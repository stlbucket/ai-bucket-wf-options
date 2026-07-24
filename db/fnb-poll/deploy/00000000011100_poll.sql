-----------------------------------------------
-- script  poll schema
-- Tenant polls — URN-registered entity (spec .claude/specs/tenant-app/tools/poll/).
-- Only poll.poll is registered in res.resource; questions/options/response/answer are child
-- rows. Every child table denormalizes poll_id + tenant_id so RLS is a simple join to poll.
-----------------------------------------------
create schema if not exists poll;
create schema if not exists poll_fn;
-----------------------------------------------
create type poll.poll_status as enum (
  'draft'      -- author is building it; not answerable; hidden from non-owners
  ,'open'      -- accepting responses
  ,'closed'    -- read-only; no more writes
);
-----------------------------------------------
create type poll.question_type as enum (
  'yes_no'
  ,'multiple_choice'
  ,'date_yes_no'   -- a list of dates (option rows, candidate_at required); yes/no per date,
                   -- optional per-date note. context_at/collect_datetime/max_selections/
                   -- allow_other do NOT apply to this type.
);
-----------------------------------------------
create type poll.results_visibility as enum (
  'hidden'      -- a member sees only their own answers
  ,'aggregate'  -- members see counts/percentages, never who voted for what
  ,'attributed' -- members see who answered what
);
------------------------------------------------------------------------ poll
create table if not exists poll.poll (
  id uuid not null default res_fn.uuid_generate_v7() primary key
  ,tenant_id uuid not null references app.tenant(id)
  ,created_by_resident_urn text not null references res.resource(urn)
  ,created_at timestamptz not null default current_timestamp
  ,updated_at timestamptz not null default current_timestamp
  ,title citext not null
  ,description citext
  ,status poll.poll_status not null default 'draft'
  ,closes_at timestamptz null
  ,allow_change_after_submit boolean not null default true
  ,results_visibility poll.results_visibility not null default 'hidden'
  ,check (char_length(title) >= 3)
  ,urn text not null
    generated always as (res_fn.build_urn(tenant_id, 'poll', 'poll', id)) stored
  ,constraint uq_poll_urn unique (urn)
  ,constraint fk_poll_resource foreign key (id) references res.resource(id)
    deferrable initially deferred
);
create index idx_poll_poll_tenant_id on poll.poll(tenant_id);
create index idx_poll_poll_created_by on poll.poll(created_by_resident_urn);
create index idx_poll_poll_status on poll.poll(status);
------------------------------------------------------------------------ question
create table if not exists poll.question (
  id uuid not null default res_fn.uuid_generate_v7() primary key
  ,poll_id uuid not null references poll.poll(id) on delete cascade
  ,tenant_id uuid not null references app.tenant(id)
  ,ordinal integer not null
  ,question_type poll.question_type not null
  ,prompt citext not null
  ,required boolean not null default true
  ,max_selections integer null   -- multiple_choice: 1 = single, N = up to N, null = unlimited
  ,allow_other boolean not null default false
  ,allow_note boolean not null default false        -- respondent may attach a note to their answer
  ,collect_datetime boolean not null default false  -- ask respondent for a date/time
  ,context_at timestamptz null                       -- authored, whole-question date/time
  ,check (char_length(prompt) >= 1)
  ,check (max_selections is null or max_selections >= 1)
);
create index idx_poll_question_poll_id on poll.question(poll_id);
create unique index uq_poll_question_ordinal on poll.question(poll_id, ordinal);
------------------------------------------------------------------------ option
create table if not exists poll.option (
  id uuid not null default res_fn.uuid_generate_v7() primary key
  ,question_id uuid not null references poll.question(id) on delete cascade
  ,poll_id uuid not null references poll.poll(id) on delete cascade
  ,tenant_id uuid not null references app.tenant(id)
  ,ordinal integer not null
  ,label citext null               -- optional for date_yes_no rows (candidate_at is the display)
  ,candidate_at timestamptz null   -- authored candidate date/time (scheduling poll / the DATE
                                   -- of a date_yes_no row — fn-enforced required for that type)
  ,check (label is not null or candidate_at is not null)
  ,check (label is null or char_length(label) >= 1)
);
create index idx_poll_option_question_id on poll.option(question_id);
create index idx_poll_option_poll_id on poll.option(poll_id);
create unique index uq_poll_option_ordinal on poll.option(question_id, ordinal);
------------------------------------------------------------------------ response
create table if not exists poll.response (
  id uuid not null default res_fn.uuid_generate_v7() primary key
  ,poll_id uuid not null references poll.poll(id) on delete cascade
  ,tenant_id uuid not null references app.tenant(id)
  ,respondent_resident_urn text not null references res.resource(urn)
  ,created_at timestamptz not null default current_timestamp
  ,updated_at timestamptz not null default current_timestamp
  ,submitted_at timestamptz null   -- null = in progress; set on submit (lock point)
  ,constraint uq_response_poll_respondent unique (poll_id, respondent_resident_urn)
);
create index idx_poll_response_poll_id on poll.response(poll_id);
create index idx_poll_response_respondent on poll.response(respondent_resident_urn);
------------------------------------------------------------------------ answer
create table if not exists poll.answer (
  id uuid not null default res_fn.uuid_generate_v7() primary key
  ,response_id uuid not null references poll.response(id) on delete cascade
  ,question_id uuid not null references poll.question(id) on delete cascade
  ,poll_id uuid not null references poll.poll(id) on delete cascade
  ,tenant_id uuid not null references app.tenant(id)
  ,respondent_resident_urn text not null references res.resource(urn)
  ,option_id uuid null references poll.option(id) on delete cascade  -- multiple_choice selection
                                                                     -- OR the date_yes_no date row
  ,yes_no boolean null                                               -- yes_no / per-date answer
  ,other_text citext null                                            -- the "Other" free text
  ,note citext null                                                  -- respondent note (allow_note);
                                                                     -- attributed-only, never in
                                                                     -- aggregate results
  ,answer_at timestamptz null                                        -- respondent-supplied date/time
  ,created_at timestamptz not null default current_timestamp
);
create index idx_poll_answer_response_id on poll.answer(response_id);
create index idx_poll_answer_question_id on poll.answer(question_id);
create index idx_poll_answer_poll_id on poll.answer(poll_id);
create index idx_poll_answer_option_id on poll.answer(option_id);
