select has_function_privilege('poll_api.create_poll(citext, citext)', 'execute');
select has_function_privilege('poll_api.submit_response(uuid, poll_fn.answer_input[])', 'execute');
select has_function_privilege('poll_api.search_polls(poll_fn.search_polls_options)', 'execute');
select has_function_privilege('poll_api.get_poll_results(uuid)', 'execute');
