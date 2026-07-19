----------------------------------------------------------------- submit_support_ticket
CREATE OR REPLACE FUNCTION app_api.submit_support_ticket(_title citext, _description text)
  RETURNS uuid
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $$
  DECLARE
    _ticket_id uuid;
  BEGIN
    if jwt.resident_id() is null then
      raise exception '30000: PERMISSION DENIED';
    end if;

    _ticket_id := app_fn.submit_support_ticket(_title, _description, jwt.resident_id());
    return _ticket_id;
  end;
  $$;

CREATE OR REPLACE FUNCTION app_fn.submit_support_ticket(_title citext, _description text, _resident_id uuid)
  RETURNS uuid
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $$
  DECLARE
    _ticket_id uuid;
    _tenant_id uuid;
    _subscription_id uuid;
  BEGIN
    select r.tenant_id, ts.id
    into _tenant_id, _subscription_id
    from app.resident r
    join app.tenant_subscription ts on ts.tenant_id = r.tenant_id and ts.status = 'active'
    where r.id = _resident_id
    limit 1;

    insert into app.support_ticket(tenant_id, tenant_subscription_id, resident_id, title, description)
    values (_tenant_id, _subscription_id, _resident_id, _title, _description)
    returning id into _ticket_id;
    perform res_fn.register_resource(_ticket_id, _tenant_id, 'app', 'support_ticket', _resident_id);

    return _ticket_id;
  end;
  $$;

----------------------------------------------------------------- close_support_ticket
CREATE OR REPLACE FUNCTION app_api.close_support_ticket(_ticket_id uuid)
  RETURNS app.support_ticket
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $$
  DECLARE
    _ticket app.support_ticket;
  BEGIN
    select * into _ticket from app.support_ticket where id = _ticket_id;

    if _ticket.resident_id != jwt.resident_id()
      and jwt.has_permission('p:app-admin', _ticket.tenant_id) != true
      and jwt.has_permission('p:app-admin-support') != true
    then
      raise exception '30000: PERMISSION DENIED';
    end if;

    _ticket := app_fn.close_support_ticket(_ticket_id);
    return _ticket;
  end;
  $$;

CREATE OR REPLACE FUNCTION app_fn.close_support_ticket(_ticket_id uuid)
  RETURNS app.support_ticket
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $$
  DECLARE
    _ticket app.support_ticket;
  BEGIN
    update app.support_ticket
      set status = 'closed', updated_at = current_timestamp
      where id = _ticket_id
      returning * into _ticket;
    return _ticket;
  end;
  $$;

----------------------------------------------------------------- delete_support_ticket
CREATE OR REPLACE FUNCTION app_api.delete_support_ticket(_ticket_id uuid)
  RETURNS app.support_ticket
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $$
  DECLARE
    _ticket app.support_ticket;
  BEGIN
    select * into _ticket from app.support_ticket where id = _ticket_id;

    if _ticket.resident_id != jwt.resident_id()
      and jwt.has_permission('p:app-admin', _ticket.tenant_id) != true
      and jwt.has_permission('p:app-admin-support') != true
    then
      raise exception '30000: PERMISSION DENIED';
    end if;

    _ticket := app_fn.delete_support_ticket(_ticket_id);
    return _ticket;
  end;
  $$;

CREATE OR REPLACE FUNCTION app_fn.delete_support_ticket(_ticket_id uuid)
  RETURNS app.support_ticket
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $$
  DECLARE
    _ticket app.support_ticket;
  BEGIN
    update app.support_ticket
      set status = 'deleted', updated_at = current_timestamp
      where id = _ticket_id
      returning * into _ticket;
    return _ticket;
  end;
  $$;

----------------------------------------------------------------- park_support_ticket
CREATE OR REPLACE FUNCTION app_api.park_support_ticket(_ticket_id uuid)
  RETURNS app.support_ticket
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $$
  DECLARE
    _ticket app.support_ticket;
  BEGIN
    select * into _ticket from app.support_ticket where id = _ticket_id;

    if jwt.has_permission('p:app-admin', _ticket.tenant_id) != true
      and jwt.has_permission('p:app-admin-support') != true
    then
      raise exception '30000: PERMISSION DENIED';
    end if;

    _ticket := app_fn.park_support_ticket(_ticket_id);
    return _ticket;
  end;
  $$;

CREATE OR REPLACE FUNCTION app_fn.park_support_ticket(_ticket_id uuid)
  RETURNS app.support_ticket
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $$
  DECLARE
    _ticket app.support_ticket;
  BEGIN
    update app.support_ticket
      set status = 'parked', updated_at = current_timestamp
      where id = _ticket_id
      returning * into _ticket;
    return _ticket;
  end;
  $$;

----------------------------------------------------------------- mark_duplicate_support_ticket
CREATE OR REPLACE FUNCTION app_api.mark_duplicate_support_ticket(_ticket_id uuid)
  RETURNS app.support_ticket
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $$
  DECLARE
    _ticket app.support_ticket;
  BEGIN
    select * into _ticket from app.support_ticket where id = _ticket_id;

    if jwt.has_permission('p:app-admin', _ticket.tenant_id) != true
      and jwt.has_permission('p:app-admin-support') != true
    then
      raise exception '30000: PERMISSION DENIED';
    end if;

    _ticket := app_fn.mark_duplicate_support_ticket(_ticket_id);
    return _ticket;
  end;
  $$;

CREATE OR REPLACE FUNCTION app_fn.mark_duplicate_support_ticket(_ticket_id uuid)
  RETURNS app.support_ticket
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $$
  DECLARE
    _ticket app.support_ticket;
  BEGIN
    update app.support_ticket
      set status = 'duplicate', updated_at = current_timestamp
      where id = _ticket_id
      returning * into _ticket;
    return _ticket;
  end;
  $$;

----------------------------------------------------------------- reopen_support_ticket
CREATE OR REPLACE FUNCTION app_api.reopen_support_ticket(_ticket_id uuid)
  RETURNS app.support_ticket
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $$
  DECLARE
    _ticket app.support_ticket;
  BEGIN
    select * into _ticket from app.support_ticket where id = _ticket_id;

    if _ticket.resident_id != jwt.resident_id()
      and jwt.has_permission('p:app-admin', _ticket.tenant_id) != true
      and jwt.has_permission('p:app-admin-support') != true
    then
      raise exception '30000: PERMISSION DENIED';
    end if;

    _ticket := app_fn.reopen_support_ticket(_ticket_id);
    return _ticket;
  end;
  $$;

CREATE OR REPLACE FUNCTION app_fn.reopen_support_ticket(_ticket_id uuid)
  RETURNS app.support_ticket
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $$
  DECLARE
    _ticket app.support_ticket;
  BEGIN
    update app.support_ticket
      set status = 'open', updated_at = current_timestamp
      where id = _ticket_id
      returning * into _ticket;
    return _ticket;
  end;
  $$;

----------------------------------------------------------------- submit_support_ticket_comment
CREATE OR REPLACE FUNCTION app_api.submit_support_ticket_comment(_ticket_id uuid, _body text)
  RETURNS app.support_ticket_comment
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $$
  DECLARE
    _comment app.support_ticket_comment;
  BEGIN
    if jwt.resident_id() is null then
      raise exception '30000: PERMISSION DENIED';
    end if;

    _comment := app_fn.submit_support_ticket_comment(_ticket_id, _body, jwt.resident_id());
    return _comment;
  end;
  $$;

CREATE OR REPLACE FUNCTION app_fn.submit_support_ticket_comment(_ticket_id uuid, _body text, _resident_id uuid)
  RETURNS app.support_ticket_comment
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $$
  DECLARE
    _comment app.support_ticket_comment;
  BEGIN
    insert into app.support_ticket_comment(support_ticket_id, resident_id, body)
    values (_ticket_id, _resident_id, _body)
    returning * into _comment;

    return _comment;
  end;
  $$;
