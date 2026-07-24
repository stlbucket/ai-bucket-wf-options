select 1/count(*) from information_schema.tables where table_schema = 'poll' and table_name = 'poll';
select id, urn, created_by_resident_urn, status, results_visibility, allow_change_after_submit from poll.poll where false;
select id, poll_id, question_type, max_selections, allow_other, allow_note, collect_datetime, context_at from poll.question where false;
select id, question_id, poll_id, candidate_at from poll.option where false;
select id, poll_id, respondent_resident_urn, submitted_at from poll.response where false;
select id, response_id, question_id, option_id, yes_no, other_text, note, answer_at from poll.answer where false;
select 1/count(*) from pg_enum e join pg_type t on t.oid = e.enumtypid
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'poll' and t.typname = 'question_type' and e.enumlabel = 'date_yes_no';
