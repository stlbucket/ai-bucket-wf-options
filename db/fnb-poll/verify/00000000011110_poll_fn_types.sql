select 1/count(*) from pg_type t
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'poll_fn' and t.typname = 'answer_input';
select 1/count(*) from pg_type t
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'poll_fn' and t.typname = 'question_result';
select 1/count(*) from pg_type t
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'poll_fn' and t.typname = 'date_answer_input';
