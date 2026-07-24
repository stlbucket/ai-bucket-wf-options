-----------------------------------------------
-- script  poll_fn / poll_api functions  (two-layer, R8)
-- poll_api: SECURITY INVOKER, jwt gate, delegates. poll_fn: explicit params, never calls jwt.*.
-----------------------------------------------
create schema if not exists poll_api;

-------------------------------------------------------------------------------- helpers
---------------------------------------------- assert_can_admin
-- Raises unless the caller administers this poll (creator, or holds p:poll-admin — evaluated by
-- the _api layer and passed in as _is_admin).
CREATE OR REPLACE FUNCTION poll_fn.assert_can_admin(_poll_id uuid, _resident_id uuid, _is_admin boolean)
  RETURNS void LANGUAGE plpgsql STABLE SECURITY INVOKER AS $$
  DECLARE _poll poll.poll;
  BEGIN
    select * into _poll from poll.poll where id = _poll_id;
    if _poll.id is null then raise exception '30031: NO POLL FOR ID'; end if;
    if _is_admin then return; end if;
    if _poll.created_by_resident_urn = (select urn from app.resident where id = _resident_id) then return; end if;
    raise exception '30000: NOT AUTHORIZED';
  END; $$;

---------------------------------------------- assert_draft
CREATE OR REPLACE FUNCTION poll_fn.assert_draft(_poll_id uuid)
  RETURNS void LANGUAGE plpgsql STABLE SECURITY INVOKER AS $$
  BEGIN
    if (select status from poll.poll where id = _poll_id) != 'draft' then
      raise exception '30035: POLL STRUCTURE LOCKED (poll is not a draft)';
    end if;
  END; $$;

-------------------------------------------------------------------------------- create_poll
CREATE OR REPLACE FUNCTION poll_api.create_poll(_title citext, _description citext default null)
  RETURNS poll.poll LANGUAGE plpgsql VOLATILE SECURITY INVOKER AS $$
  BEGIN
    perform jwt.enforce_permission('p:poll');
    return poll_fn.create_poll(_title, _description, jwt.resident_id());
  END; $$;

CREATE OR REPLACE FUNCTION poll_fn.create_poll(_title citext, _description citext, _resident_id uuid)
  RETURNS poll.poll LANGUAGE plpgsql VOLATILE SECURITY INVOKER AS $$
  DECLARE _resident app.resident; _id uuid; _retval poll.poll;
  BEGIN
    if _title is null or length(_title) < 3 then
      raise exception '30034: Poll title must be at least 3 characters';
    end if;
    select * into _resident from app.resident where id = _resident_id;
    if _resident.id is null then raise exception 'no resident for id: %', _resident_id; end if;

    _id := res_fn.uuid_generate_v7();
    insert into poll.poll(id, tenant_id, created_by_resident_urn, title, description)
    values(_id, _resident.tenant_id, _resident.urn, _title, _description)
    returning * into _retval;
    perform res_fn.register_resource(_id, _resident.tenant_id, 'poll', 'poll', _resident_id);
    return _retval;
  END; $$;

-------------------------------------------------------------------------------- update_poll
CREATE OR REPLACE FUNCTION poll_api.update_poll(
    _poll_id uuid, _title citext, _description citext default null, _closes_at timestamptz default null)
  RETURNS poll.poll LANGUAGE plpgsql VOLATILE SECURITY INVOKER AS $$
  BEGIN
    perform jwt.enforce_permission('p:poll');
    return poll_fn.update_poll(_poll_id, _title, _description, _closes_at,
                               jwt.resident_id(), jwt.has_permission('p:poll-admin'));
  END; $$;

CREATE OR REPLACE FUNCTION poll_fn.update_poll(
    _poll_id uuid, _title citext, _description citext, _closes_at timestamptz,
    _resident_id uuid, _is_admin boolean)
  RETURNS poll.poll LANGUAGE plpgsql VOLATILE SECURITY INVOKER AS $$
  DECLARE _retval poll.poll;
  BEGIN
    perform poll_fn.assert_can_admin(_poll_id, _resident_id, _is_admin);
    update poll.poll set
      title = coalesce(_title, title)
      ,description = _description
      ,closes_at = _closes_at
      ,updated_at = current_timestamp
    where id = _poll_id returning * into _retval;
    return _retval;
  END; $$;

-------------------------------------------------------------------------------- set_poll_options
CREATE OR REPLACE FUNCTION poll_api.set_poll_options(
    _poll_id uuid, _allow_change_after_submit boolean, _results_visibility poll.results_visibility)
  RETURNS poll.poll LANGUAGE plpgsql VOLATILE SECURITY INVOKER AS $$
  BEGIN
    perform jwt.enforce_permission('p:poll');
    return poll_fn.set_poll_options(_poll_id, _allow_change_after_submit, _results_visibility,
                                    jwt.resident_id(), jwt.has_permission('p:poll-admin'));
  END; $$;

CREATE OR REPLACE FUNCTION poll_fn.set_poll_options(
    _poll_id uuid, _allow_change_after_submit boolean, _results_visibility poll.results_visibility,
    _resident_id uuid, _is_admin boolean)
  RETURNS poll.poll LANGUAGE plpgsql VOLATILE SECURITY INVOKER AS $$
  DECLARE _retval poll.poll;
  BEGIN
    perform poll_fn.assert_can_admin(_poll_id, _resident_id, _is_admin);
    update poll.poll set
      allow_change_after_submit = coalesce(_allow_change_after_submit, allow_change_after_submit)
      ,results_visibility = coalesce(_results_visibility, results_visibility)
      ,updated_at = current_timestamp
    where id = _poll_id returning * into _retval;
    return _retval;
  END; $$;

-------------------------------------------------------------------------------- set_poll_status
CREATE OR REPLACE FUNCTION poll_api.set_poll_status(_poll_id uuid, _status poll.poll_status)
  RETURNS poll.poll LANGUAGE plpgsql VOLATILE SECURITY INVOKER AS $$
  BEGIN
    perform jwt.enforce_permission('p:poll');
    return poll_fn.set_poll_status(_poll_id, _status, jwt.resident_id(), jwt.has_permission('p:poll-admin'));
  END; $$;

CREATE OR REPLACE FUNCTION poll_fn.set_poll_status(
    _poll_id uuid, _status poll.poll_status, _resident_id uuid, _is_admin boolean)
  RETURNS poll.poll LANGUAGE plpgsql VOLATILE SECURITY INVOKER AS $$
  DECLARE _retval poll.poll;
  BEGIN
    perform poll_fn.assert_can_admin(_poll_id, _resident_id, _is_admin);
    if _status = 'open' and (select count(*) from poll.question where poll_id = _poll_id) = 0 then
      raise exception '30037: CANNOT OPEN A POLL WITH NO QUESTIONS';
    end if;
    update poll.poll set status = _status, updated_at = current_timestamp
    where id = _poll_id returning * into _retval;
    return _retval;
  END; $$;

-------------------------------------------------------------------------------- delete_poll
CREATE OR REPLACE FUNCTION poll_api.delete_poll(_poll_id uuid)
  RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY INVOKER AS $$
  BEGIN
    perform jwt.enforce_permission('p:poll');
    return poll_fn.delete_poll(_poll_id, jwt.resident_id(), jwt.has_permission('p:poll-admin'));
  END; $$;

CREATE OR REPLACE FUNCTION poll_fn.delete_poll(_poll_id uuid, _resident_id uuid, _is_admin boolean)
  RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY INVOKER AS $$
  BEGIN
    perform poll_fn.assert_can_admin(_poll_id, _resident_id, _is_admin);
    delete from poll.poll where id = _poll_id;   -- cascades to questions/options/responses/answers
    perform res_fn.archive_resource(_poll_id);
    return true;
  END; $$;

-------------------------------------------------------------------------------- upsert_question
CREATE OR REPLACE FUNCTION poll_api.upsert_question(_poll_id uuid, _q poll_fn.question_input)
  RETURNS poll.question LANGUAGE plpgsql VOLATILE SECURITY INVOKER AS $$
  BEGIN
    perform jwt.enforce_permission('p:poll');
    return poll_fn.upsert_question(_poll_id, _q, jwt.resident_id(), jwt.has_permission('p:poll-admin'));
  END; $$;

CREATE OR REPLACE FUNCTION poll_fn.upsert_question(
    _poll_id uuid, _q poll_fn.question_input, _resident_id uuid, _is_admin boolean)
  RETURNS poll.question LANGUAGE plpgsql VOLATILE SECURITY INVOKER AS $$
  DECLARE _poll poll.poll; _retval poll.question;
  BEGIN
    perform poll_fn.assert_can_admin(_poll_id, _resident_id, _is_admin);
    perform poll_fn.assert_draft(_poll_id);
    select * into _poll from poll.poll where id = _poll_id;

    -- date_yes_no: the mc/yes_no-only knobs do not apply (spec §6.2 structure-edit guards)
    if _q.question_type = 'date_yes_no' then
      _q.max_selections := null;
      _q.context_at := null;
      _q.allow_other := false;
      _q.collect_datetime := false;
    end if;

    if _q.id is null then
      insert into poll.question(
        poll_id, tenant_id, ordinal, question_type, prompt, required,
        max_selections, allow_other, allow_note, collect_datetime, context_at)
      values(
        _poll_id, _poll.tenant_id,
        coalesce(_q.ordinal, (select coalesce(max(ordinal),0)+1 from poll.question where poll_id = _poll_id)),
        _q.question_type, _q.prompt, coalesce(_q.required, true),
        _q.max_selections, coalesce(_q.allow_other, false), coalesce(_q.allow_note, false),
        coalesce(_q.collect_datetime, false), _q.context_at)
      returning * into _retval;
    else
      update poll.question set
        ordinal = coalesce(_q.ordinal, ordinal)
        ,question_type = coalesce(_q.question_type, question_type)
        ,prompt = coalesce(_q.prompt, prompt)
        ,required = coalesce(_q.required, required)
        ,max_selections = _q.max_selections
        ,allow_other = coalesce(_q.allow_other, false)
        ,allow_note = coalesce(_q.allow_note, false)
        ,collect_datetime = coalesce(_q.collect_datetime, false)
        ,context_at = _q.context_at
      where id = _q.id and poll_id = _poll_id
      returning * into _retval;
    end if;
    return _retval;
  END; $$;

-------------------------------------------------------------------------------- delete_question
CREATE OR REPLACE FUNCTION poll_api.delete_question(_question_id uuid)
  RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY INVOKER AS $$
  BEGIN
    perform jwt.enforce_permission('p:poll');
    return poll_fn.delete_question(_question_id, jwt.resident_id(), jwt.has_permission('p:poll-admin'));
  END; $$;

CREATE OR REPLACE FUNCTION poll_fn.delete_question(_question_id uuid, _resident_id uuid, _is_admin boolean)
  RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY INVOKER AS $$
  DECLARE _question poll.question;
  BEGIN
    select * into _question from poll.question where id = _question_id;
    if _question.id is null then raise exception '30036: NO QUESTION FOR ID'; end if;
    perform poll_fn.assert_can_admin(_question.poll_id, _resident_id, _is_admin);
    perform poll_fn.assert_draft(_question.poll_id);
    delete from poll.question where id = _question_id;
    return true;
  END; $$;

-------------------------------------------------------------------------------- upsert_option
CREATE OR REPLACE FUNCTION poll_api.upsert_option(_question_id uuid, _o poll_fn.option_input)
  RETURNS poll.option LANGUAGE plpgsql VOLATILE SECURITY INVOKER AS $$
  BEGIN
    perform jwt.enforce_permission('p:poll');
    return poll_fn.upsert_option(_question_id, _o, jwt.resident_id(), jwt.has_permission('p:poll-admin'));
  END; $$;

CREATE OR REPLACE FUNCTION poll_fn.upsert_option(
    _question_id uuid, _o poll_fn.option_input, _resident_id uuid, _is_admin boolean)
  RETURNS poll.option LANGUAGE plpgsql VOLATILE SECURITY INVOKER AS $$
  DECLARE _question poll.question; _retval poll.option;
  BEGIN
    select * into _question from poll.question where id = _question_id;
    if _question.id is null then raise exception '30036: NO QUESTION FOR ID'; end if;
    perform poll_fn.assert_can_admin(_question.poll_id, _resident_id, _is_admin);
    perform poll_fn.assert_draft(_question.poll_id);

    -- date_yes_no rows ARE dates: candidate_at required, label is an optional display override.
    -- multiple_choice keeps requiring a label.
    if _question.question_type = 'date_yes_no' and _o.candidate_at is null then
      raise exception '30041: A DATE OPTION REQUIRES candidate_at';
    end if;
    if _question.question_type = 'multiple_choice' and _o.id is null and _o.label is null then
      raise exception '30042: A CHOICE OPTION REQUIRES A LABEL';
    end if;

    if _o.id is null then
      insert into poll.option(question_id, poll_id, tenant_id, ordinal, label, candidate_at)
      values(
        _question_id, _question.poll_id, _question.tenant_id,
        coalesce(_o.ordinal, (select coalesce(max(ordinal),0)+1 from poll.option where question_id = _question_id)),
        _o.label, _o.candidate_at)
      returning * into _retval;
    else
      update poll.option set
        ordinal = coalesce(_o.ordinal, ordinal)
        ,label = case when _question.question_type = 'date_yes_no' then _o.label
                      else coalesce(_o.label, label) end
        ,candidate_at = _o.candidate_at
      where id = _o.id and question_id = _question_id
      returning * into _retval;
    end if;
    return _retval;
  END; $$;

-------------------------------------------------------------------------------- delete_option
CREATE OR REPLACE FUNCTION poll_api.delete_option(_option_id uuid)
  RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY INVOKER AS $$
  BEGIN
    perform jwt.enforce_permission('p:poll');
    return poll_fn.delete_option(_option_id, jwt.resident_id(), jwt.has_permission('p:poll-admin'));
  END; $$;

CREATE OR REPLACE FUNCTION poll_fn.delete_option(_option_id uuid, _resident_id uuid, _is_admin boolean)
  RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY INVOKER AS $$
  DECLARE _option poll.option;
  BEGIN
    select * into _option from poll.option where id = _option_id;
    if _option.id is null then raise exception '30038: NO OPTION FOR ID'; end if;
    perform poll_fn.assert_can_admin(_option.poll_id, _resident_id, _is_admin);
    perform poll_fn.assert_draft(_option.poll_id);
    delete from poll.option where id = _option_id;
    return true;
  END; $$;

-------------------------------------------------------------------------------- save / submit response
CREATE OR REPLACE FUNCTION poll_api.save_response(_poll_id uuid, _answers poll_fn.answer_input[])
  RETURNS poll.response LANGUAGE plpgsql VOLATILE SECURITY INVOKER AS $$
  BEGIN
    perform jwt.enforce_permission('p:poll');
    return poll_fn.save_response(_poll_id, _answers, jwt.resident_id(), false);
  END; $$;

CREATE OR REPLACE FUNCTION poll_api.submit_response(_poll_id uuid, _answers poll_fn.answer_input[])
  RETURNS poll.response LANGUAGE plpgsql VOLATILE SECURITY INVOKER AS $$
  BEGIN
    perform jwt.enforce_permission('p:poll');
    return poll_fn.save_response(_poll_id, _answers, jwt.resident_id(), true);
  END; $$;

CREATE OR REPLACE FUNCTION poll_fn.save_response(
    _poll_id uuid, _answers poll_fn.answer_input[], _resident_id uuid, _submit boolean)
  RETURNS poll.response LANGUAGE plpgsql VOLATILE SECURITY INVOKER AS $$
  DECLARE
    _poll poll.poll;
    _resident app.resident;
    _existing poll.response;
    _response poll.response;
    _a poll_fn.answer_input;
    _question poll.question;
    _opt uuid;
    _sel_count integer;
    _da poll_fn.date_answer_input;
    _seen_options uuid[];
    _note citext;
  BEGIN
    select * into _poll from poll.poll where id = _poll_id;
    if _poll.id is null then raise exception '30031: NO POLL FOR ID'; end if;
    if _poll.status != 'open' then raise exception '30032: POLL IS NOT OPEN'; end if;

    select * into _resident from app.resident where id = _resident_id;
    if _resident.id is null then raise exception 'no resident for id: %', _resident_id; end if;

    select * into _existing from poll.response
      where poll_id = _poll_id and respondent_resident_urn = _resident.urn;
    if _existing.id is not null and _existing.submitted_at is not null
       and _poll.allow_change_after_submit = false then
      raise exception '30033: ANSWERS ARE LOCKED (poll does not allow changes after submission)';
    end if;

    -- upsert the response envelope (one per member per poll)
    insert into poll.response(poll_id, tenant_id, respondent_resident_urn)
    values(_poll_id, _poll.tenant_id, _resident.urn)
    on conflict (poll_id, respondent_resident_urn)
      do update set updated_at = current_timestamp
    returning * into _response;

    -- full replace of this member's answers
    delete from poll.answer where response_id = _response.id;

    if _answers is not null then
      foreach _a in array _answers loop
        select * into _question from poll.question where id = _a.question_id and poll_id = _poll_id;
        if _question.id is null then
          raise exception '30036: NO QUESTION % FOR THIS POLL', _a.question_id;
        end if;

        if _a.date_answers is not null and _question.question_type != 'date_yes_no' then
          raise exception '30043: date_answers ONLY APPLY TO A date_yes_no QUESTION (%)', _question.id;
        end if;
        -- notes only when the question allows them (never silently persist)
        _note := case when _question.allow_note then _a.note else null end;

        if _question.question_type = 'yes_no' then
          if _a.yes_no is not null then
            insert into poll.answer(response_id, question_id, poll_id, tenant_id, respondent_resident_urn, yes_no, note, answer_at)
            values(_response.id, _question.id, _poll_id, _poll.tenant_id, _resident.urn, _a.yes_no, _note,
                   case when _question.collect_datetime then _a.answer_at else null end);
          end if;

        elsif _question.question_type = 'date_yes_no' then
          _seen_options := '{}';
          if _a.date_answers is not null then
            foreach _da in array _a.date_answers loop
              if not exists (select 1 from poll.option where id = _da.option_id and question_id = _question.id) then
                raise exception '30040: OPTION % DOES NOT BELONG TO QUESTION %', _da.option_id, _question.id;
              end if;
              if _da.option_id = any(_seen_options) then
                raise exception '30044: DUPLICATE DATE ANSWER FOR OPTION %', _da.option_id;
              end if;
              if _da.yes_no is null then
                raise exception '30045: A DATE ANSWER REQUIRES yes_no (option %)', _da.option_id;
              end if;
              _seen_options := _seen_options || _da.option_id;
              insert into poll.answer(response_id, question_id, poll_id, tenant_id, respondent_resident_urn, option_id, yes_no, note)
              values(_response.id, _question.id, _poll_id, _poll.tenant_id, _resident.urn, _da.option_id, _da.yes_no,
                     case when _question.allow_note then _da.note else null end);
            end loop;
          end if;

        else  -- multiple_choice
          _sel_count := coalesce(array_length(_a.option_ids, 1), 0);
          if _question.max_selections is not null and _sel_count > _question.max_selections then
            raise exception '30039: TOO MANY SELECTIONS FOR QUESTION % (max %)', _question.id, _question.max_selections;
          end if;
          if _a.option_ids is not null then
            foreach _opt in array _a.option_ids loop
              if not exists (select 1 from poll.option where id = _opt and question_id = _question.id) then
                raise exception '30040: OPTION % DOES NOT BELONG TO QUESTION %', _opt, _question.id;
              end if;
              insert into poll.answer(response_id, question_id, poll_id, tenant_id, respondent_resident_urn, option_id, answer_at)
              values(_response.id, _question.id, _poll_id, _poll.tenant_id, _resident.urn, _opt,
                     case when _question.collect_datetime then _a.answer_at else null end);
            end loop;
          end if;
          if _a.other_text is not null and _question.allow_other then
            insert into poll.answer(response_id, question_id, poll_id, tenant_id, respondent_resident_urn, other_text, answer_at)
            values(_response.id, _question.id, _poll_id, _poll.tenant_id, _resident.urn, _a.other_text,
                   case when _question.collect_datetime then _a.answer_at else null end);
          end if;
          -- one note per multiple_choice question: ride the first written answer row
          if _note is not null then
            update poll.answer set note = _note
            where id = (select id from poll.answer
                        where response_id = _response.id and question_id = _question.id
                        order by created_at, id limit 1);
          end if;
        end if;
      end loop;
    end if;

    update poll.response set
      submitted_at = case when _submit then current_timestamp else submitted_at end
      ,updated_at = current_timestamp
    where id = _response.id returning * into _response;

    return _response;
  END; $$;

-------------------------------------------------------------------------------- search_polls
CREATE OR REPLACE FUNCTION poll_api.search_polls(_options poll_fn.search_polls_options)
  RETURNS setof poll.poll LANGUAGE plpgsql STABLE SECURITY INVOKER AS $$
  BEGIN
    perform jwt.enforce_permission('p:poll');
    return query select * from poll_fn.search_polls(_options, jwt.resident_id());
  END; $$;

-- SECURITY INVOKER: RLS already hides other members' drafts (read_poll policy), so no re-filter here.
CREATE OR REPLACE FUNCTION poll_fn.search_polls(_options poll_fn.search_polls_options, _resident_id uuid)
  RETURNS setof poll.poll LANGUAGE plpgsql STABLE SECURITY INVOKER AS $$
  BEGIN
    return query
    select p.* from poll.poll p
    where (_options.search_term is null
           or p.title like '%'||_options.search_term||'%'
           or p.description like '%'||_options.search_term||'%')
      and (_options.poll_status is null or p.status = _options.poll_status)
      and (coalesce(_options.mine_only, false) = false
           or p.created_by_resident_urn = (select urn from app.resident where id = _resident_id))
    order by p.updated_at desc;
  END; $$;

-------------------------------------------------------------------------------- get_poll_results
-- SECURITY DEFINER: must count answers RLS would hide from a member so `aggregate` yields correct
-- totals without exposing individual rows. Visibility is enforced in-function; tenant is asserted.
CREATE OR REPLACE FUNCTION poll_api.get_poll_results(_poll_id uuid)
  RETURNS setof poll_fn.question_result LANGUAGE plpgsql STABLE SECURITY INVOKER AS $$
  BEGIN
    perform jwt.enforce_permission('p:poll');
    return query select * from poll_fn.get_poll_results(
      _poll_id, jwt.tenant_id()::uuid, jwt.resident_id(), jwt.has_permission('p:poll-admin'));
  END; $$;

CREATE OR REPLACE FUNCTION poll_fn.get_poll_results(
    _poll_id uuid, _tenant_id uuid, _resident_id uuid, _is_admin boolean)
  RETURNS setof poll_fn.question_result
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  DECLARE _poll poll.poll; _allowed boolean; _respondent_count integer;
  BEGIN
    select * into _poll from poll.poll where id = _poll_id;
    if _poll.id is null then return; end if;
    if _poll.tenant_id != _tenant_id then return; end if;   -- cross-tenant: nothing

    _allowed := _is_admin
      or _poll.results_visibility in ('aggregate', 'attributed')
      or _poll.created_by_resident_urn = (select urn from app.resident where id = _resident_id);
    if not _allowed then return; end if;   -- hidden + non-owner: results not shared

    select count(*) into _respondent_count
      from poll.response where poll_id = _poll_id and submitted_at is not null;

    return query
    -- yes/no tallies (one row per yes_no question)
    select q.id, null::uuid, null::citext, null::timestamptz,
           0,
           count(*) filter (where a.yes_no is true)::int,
           count(*) filter (where a.yes_no is false)::int,
           0,
           _respondent_count
    from poll.question q
    left join poll.answer a on a.question_id = q.id
    where q.poll_id = _poll_id and q.question_type = 'yes_no'
    group by q.id
    union all
    -- per-option vote counts (multiple_choice only — date options are tallied below)
    select o.question_id, o.id, o.label, o.candidate_at,
           count(a.id)::int, 0, 0, 0, _respondent_count
    from poll.option o
    join poll.question q on q.id = o.question_id
    left join poll.answer a on a.option_id = o.id
    where o.poll_id = _poll_id and q.question_type = 'multiple_choice'
    group by o.question_id, o.id, o.label, o.candidate_at
    union all
    -- per-date yes/no tallies (date_yes_no: one row per date option; notes are NEVER returned)
    select o.question_id, o.id, o.label, o.candidate_at,
           (count(*) filter (where a.yes_no is not null))::int,
           count(*) filter (where a.yes_no is true)::int,
           count(*) filter (where a.yes_no is false)::int,
           0,
           _respondent_count
    from poll.option o
    join poll.question q on q.id = o.question_id
    left join poll.answer a on a.option_id = o.id
    where o.poll_id = _poll_id and q.question_type = 'date_yes_no'
    group by o.question_id, o.id, o.label, o.candidate_at
    union all
    -- "Other" bucket (one row per multiple_choice question that allows it)
    select q.id, null::uuid, 'Other'::citext, null::timestamptz,
           0, 0, 0,
           count(*) filter (where a.other_text is not null)::int,
           _respondent_count
    from poll.question q
    left join poll.answer a on a.question_id = q.id
    where q.poll_id = _poll_id and q.question_type = 'multiple_choice' and q.allow_other = true
    group by q.id;
  END; $$;
