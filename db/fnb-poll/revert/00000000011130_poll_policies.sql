drop policy if exists read_others_answer on poll.answer;
drop policy if exists own_answer on poll.answer;
alter table poll.answer disable row level security;

drop policy if exists read_others_response on poll.response;
drop policy if exists own_response on poll.response;
alter table poll.response disable row level security;

drop policy if exists write_option_del on poll.option;
drop policy if exists write_option_upd on poll.option;
drop policy if exists write_option_ins on poll.option;
drop policy if exists read_option on poll.option;
alter table poll.option disable row level security;

drop policy if exists write_question_del on poll.question;
drop policy if exists write_question_upd on poll.question;
drop policy if exists write_question_ins on poll.question;
drop policy if exists read_question on poll.question;
alter table poll.question disable row level security;

drop policy if exists write_poll_del on poll.poll;
drop policy if exists write_poll_upd on poll.poll;
drop policy if exists write_poll_ins on poll.poll;
drop policy if exists read_poll on poll.poll;
alter table poll.poll disable row level security;

revoke usage on schema poll_api from anon, authenticated, service_role;
revoke all on all tables in schema poll_api from anon, authenticated, service_role;
revoke all on all routines in schema poll_api from anon, authenticated, service_role;
revoke all on all sequences in schema poll_api from anon, authenticated, service_role;

revoke usage on schema poll_fn from anon, authenticated, service_role;
revoke all on all tables in schema poll_fn from anon, authenticated, service_role;
revoke all on all routines in schema poll_fn from anon, authenticated, service_role;
revoke all on all sequences in schema poll_fn from anon, authenticated, service_role;

revoke usage on schema poll from anon, authenticated, service_role;
revoke all on all tables in schema poll from anon, authenticated, service_role;
revoke all on all routines in schema poll from anon, authenticated, service_role;
revoke all on all sequences in schema poll from anon, authenticated, service_role;
