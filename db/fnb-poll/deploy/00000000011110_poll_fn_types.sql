-----------------------------------------------
-- script  poll_fn composite types
-----------------------------------------------

-- one authored question (id null = new)
create type poll_fn.question_input as (
  id uuid
 ,ordinal integer
 ,question_type poll.question_type
 ,prompt citext
 ,required boolean
 ,max_selections integer
 ,allow_other boolean
 ,allow_note boolean
 ,collect_datetime boolean
 ,context_at timestamptz
);

-- one authored option for a multiple_choice question (id null = new)
create type poll_fn.option_input as (
  id uuid
 ,ordinal integer
 ,label citext
 ,candidate_at timestamptz
);

-- one per-date answer for a date_yes_no question (note gated by question.allow_note)
create type poll_fn.date_answer_input as (
  option_id uuid
 ,yes_no boolean
 ,note citext
);

-- one respondent answer to one question (option_ids for multiple_choice: 1 = single, N = multi;
-- date_answers for date_yes_no only; note for yes_no/multiple_choice when allow_note)
create type poll_fn.answer_input as (
  question_id uuid
 ,option_ids uuid[]
 ,yes_no boolean
 ,other_text citext
 ,note citext
 ,answer_at timestamptz
 ,date_answers poll_fn.date_answer_input[]
);

-- list-page filter
create type poll_fn.search_polls_options as (
  search_term citext
 ,poll_status poll.poll_status
 ,mine_only boolean
);

-- one row of aggregate results (identity-free). For yes_no questions option_id is null and the
-- yes/no counts are populated; for multiple_choice one row per option (+ one synthetic "Other" row
-- where option_id is null and other_count > 0).
create type poll_fn.question_result as (
  question_id uuid
 ,option_id uuid
 ,label citext
 ,candidate_at timestamptz
 ,vote_count integer
 ,yes_count integer
 ,no_count integer
 ,other_count integer
 ,respondent_count integer
);
