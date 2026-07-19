-------------------------------------- upsert_topic
CREATE OR REPLACE FUNCTION msg_api.upsert_topic(
    _topic_info msg_fn.topic_info
  ) RETURNS msg.topic
    LANGUAGE plpgsql VOLATILE
    AS $$
  DECLARE
    _topic msg.topic;
  BEGIN
    perform jwt.enforce_permission('p:discussions');

    _topic := msg_fn.upsert_topic(
      _topic_info
      ,jwt.resident_id()
    );
    return _topic;
  end;
  $$;

CREATE OR REPLACE FUNCTION msg_fn.upsert_topic(
    _topic_info msg_fn.topic_info
    ,_resident_id uuid
  ) RETURNS msg.topic
    LANGUAGE plpgsql VOLATILE
    AS $$
  DECLARE
    _resident app.resident;
    _topic msg.topic;
    _topic_id uuid;
    _sub msg_fn.subscriber_info;
  BEGIN
    select * into _resident from app.resident where id = _resident_id;
    if _resident.id is null then
      raise exception 'no resident for id: %', _resident_id;
    end if;

    -- subject visibility guard: SECURITY INVOKER, so RLS on res.resource filters what the
    -- caller may see — an invisible/cross-tenant/nonexistent subject reads as not found.
    if _topic_info.subject_urn is not null then
      perform 1 from res.resource where urn = _topic_info.subject_urn;
      if not found then
        raise exception '30000: NOT AUTHORIZED';
      end if;
    end if;

    _topic_id = coalesce(_topic_info.id, gen_random_uuid());
    select *
      into _topic
    from msg.topic
    where (id = _topic_id
           or (_topic_info.identifier is not null and identifier = _topic_info.identifier)
           or (_topic_info.subject_urn is not null and subject_urn = _topic_info.subject_urn))
    and tenant_id = _resident.tenant_id
    ;

    if _topic.id is not null then
      update msg.topic set
        name = _topic_info.name
      where id = _topic.id
      ;
    else
      insert into msg.topic(
        id
        ,tenant_id
        ,subject_urn
        ,name
        ,identifier
        ,status
      )
      select
        _topic_id
        ,_resident.tenant_id
        ,_topic_info.subject_urn
        ,_topic_info.name
        ,_topic_info.identifier
        ,coalesce(_topic_info.status, 'open')
      returning *
      into _topic
      ;
      perform res_fn.register_resource(_topic.id, _topic.tenant_id, 'msg', 'topic', _resident_id);
    end if;

    foreach _sub in array coalesce(_topic_info.subscribers, '{}'::msg_fn.subscriber_info[])
    loop
      _sub.topic_id := _topic.id;
      perform msg_fn.upsert_subscriber(_sub);
    end loop;

    if _topic_info.initial_message is not null then
      perform msg_fn.upsert_message(
        row(null, _topic.id, _topic_info.initial_message, null)::msg_fn.message_info
        ,_resident_id
      );
    end if;

    return _topic;
  end;
  $$;
-------------------------------------- upsert_message
CREATE OR REPLACE FUNCTION msg_api.upsert_message(
    _message_info msg_fn.message_info
  ) RETURNS msg.message
    LANGUAGE plpgsql VOLATILE
    AS $$
  DECLARE
    _message msg.message;
  BEGIN
    perform jwt.enforce_permission('p:discussions');
    _message := msg_fn.upsert_message(
      _message_info
      ,jwt.resident_id()
    );
    return _message;
  end;
  $$;

CREATE OR REPLACE FUNCTION msg_fn.upsert_message(
    _message_info msg_fn.message_info
    ,_resident_id uuid
  ) RETURNS msg.message
    LANGUAGE plpgsql VOLATILE
    AS $$
  DECLARE
    _resident app.resident;
    _topic msg.topic;
    _message msg.message;
    _subscriber msg.subscriber;
  BEGIN
    select * into _resident from app.resident where id = _resident_id;
    if _resident.id is null then
      raise exception 'no resident for id: %', _resident_id;
    end if;

    select *
    into _topic
    from msg.topic
    where _message_info.topic_id is not null
    and id = _message_info.topic_id;

    _subscriber := msg_fn.upsert_subscriber(row(
      _topic.id
      ,_resident.urn
    ));

    if _topic.id is null then
      _topic := msg_fn.upsert_topic(
        row(
          null::uuid
          ,case
            when length(_message_info.content > 100) then substring(_message_info.content from 0 for 100)::citext
            else _message_info.content
          end
          ,null::citext
          ,'open'::msg.topic_status
        )
        ,_resident.id
      );
    end if;

    select * into _message from msg.message where id = _message_info.id;

    if _message.id is not null then
      update msg.message set
        content = _message_info.content
        ,tags = coalesce(_message_info.tags, '{}')
      where id = _message.id
      ;
    else
      insert into msg.message(
        tenant_id
        ,topic_id
        ,posted_by_resident_urn
        ,content
        ,tags
      )
      select
        _topic.tenant_id
        ,_message_info.topic_id
        ,_resident.urn
        ,_message_info.content
        ,coalesce(_message_info.tags, '{}')
      returning *
      into _message
      ;
    end if;

    -- perform pg_notify(
    --   'topic:'||_topic.id||':message',
    --   json_build_object('event', 'create', 'id', _message.id)::text
    -- );

    return _message;
  end;
  $$;
-------------------------------------- upsert_subscriber
CREATE OR REPLACE FUNCTION msg_api.upsert_subscriber(
    _subscriber_info msg_fn.subscriber_info
  ) RETURNS msg.subscriber
    LANGUAGE plpgsql VOLATILE
    AS $$
  DECLARE
    _subscriber msg.subscriber;
  BEGIN
    perform jwt.enforce_permission('p:discussions');

    _subscriber := msg_fn.upsert_subscriber(
      _subscriber_info
    );
    return _subscriber;
  end;
  $$;

CREATE OR REPLACE FUNCTION msg_fn.upsert_subscriber(
    _subscriber_info msg_fn.subscriber_info
  ) RETURNS msg.subscriber
    LANGUAGE plpgsql VOLATILE
    AS $$
  DECLARE
    _topic msg.topic;
    _subscriber msg.subscriber;
  BEGIN
    select *
    into _topic
    from msg.topic
    where id = _subscriber_info.topic_id
    ;
    if _topic.id is null then
      raise exception 'no topic for id: %', _subscriber_info.topic_id;
    end if;

    select * into _subscriber
    from msg.subscriber
    where topic_id = _subscriber_info.topic_id
    and resident_urn = _subscriber_info.resident_urn
    ;

    if _subscriber.id is not null then
      update msg.subscriber set
        status = 'active'
      where id = _subscriber.id
      ;
    else
      insert into msg.subscriber(
        tenant_id
        ,topic_id
        ,resident_urn
      )
      select
        _topic.tenant_id
        ,_topic.id
        ,_subscriber_info.resident_urn
      returning *
      into _subscriber
      ;
    end if;

    return _subscriber;
  end;
  $$;
-------------------------------------- upsert_subscriber
CREATE OR REPLACE FUNCTION msg_api.deactivate_subscriber(
    _subscriber_id uuid
  ) RETURNS msg.subscriber
    LANGUAGE plpgsql VOLATILE
    AS $$
  DECLARE
    _subscriber msg.subscriber;
  BEGIN
    perform jwt.enforce_permission('p:discussions');

    _subscriber := msg_fn.deactivate_subscriber(
      _subscriber_id
    );
    return _subscriber;
  end;
  $$;

CREATE OR REPLACE FUNCTION msg_fn.deactivate_subscriber(
    _subscriber_id uuid
  ) RETURNS msg.subscriber
    LANGUAGE plpgsql VOLATILE
    AS $$
  DECLARE
    _subscriber msg.subscriber;
  BEGIN
    update msg.subscriber set
      status = 'inactive'
    where id = _subscriber_id
    returning *
    into _subscriber
    ;

    return _subscriber;
  end;
  $$;
---------------------------------------------- delete_topic
CREATE OR REPLACE FUNCTION msg_api.delete_topic(_topic_id uuid)
  RETURNS boolean
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $$
  DECLARE
    _retval boolean;
  BEGIN
    _retval := msg_fn.delete_topic(_topic_id);
    return _retval;
  end;
  $$;

CREATE OR REPLACE FUNCTION msg_fn.delete_topic(_topic_id uuid)
  RETURNS boolean
  LANGUAGE plpgsql
  VOLATILE
  SECURITY INVOKER
  AS $$
  DECLARE
  BEGIN
    delete from msg.message where topic_id = _topic_id;
    delete from msg.subscriber where topic_id = _topic_id;
    delete from msg.topic where id = _topic_id;
    perform res_fn.archive_resource(_topic_id);
    return true;
  end;
  $$;
---------------------------------------------- tg__topic_subscription
CREATE OR REPLACE FUNCTION app_fn.tg__topic_subscription() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
declare
  v_process_new bool = (TG_OP = 'INSERT' OR TG_OP = 'UPDATE');
  v_process_old bool = (TG_OP = 'UPDATE' OR TG_OP = 'DELETE');
  v_event text = TG_ARGV[0];
  v_topic_template text = TG_ARGV[1];
  v_attribute text = TG_ARGV[2];
  v_record record;
  v_sub text;
  v_topic text;
  v_i int = 0;
  v_last_topic text;
begin
  for v_i in 0..1 loop
    if (v_i = 0) and v_process_new is true then
      v_record = new;
    elsif (v_i = 1) and v_process_old is true then
      v_record = old;
    else
      continue;
    end if;
     if v_attribute is not null then
      execute 'select $1.' || quote_ident(v_attribute)
        using v_record
        into v_sub;
    end if;
    if v_sub is not null then
      v_topic = replace(v_topic_template, '$1', v_sub);
    else
      v_topic = v_topic_template;
    end if;
    if v_topic is distinct from v_last_topic then
      -- This if statement prevents us from triggering the same notification twice
      v_last_topic = v_topic;

      perform pg_notify(v_topic, json_build_object(
        'event', v_event,
        'subject', v_sub,
        'id', v_record.id
      )::text);
    end if;
  end loop;
  return v_record;
end;
$_$;
---------------------------------------------- _500_topic_msg_insert
CREATE OR REPLACE TRIGGER _500_topic_msg_insert
  AFTER INSERT ON msg.message
  FOR EACH ROW
  EXECUTE FUNCTION app_fn.tg__topic_subscription(
    'create', -- the "event" string, useful for the client to know what happened
    'topic:$1:message', -- the "topic" the event will be published to, as a template
    'topic_id' -- If specified, `$1` above will be replaced with NEW.topic_id or OLD.topic_id from the trigger.
  );
