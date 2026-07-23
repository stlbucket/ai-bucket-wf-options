-- Deploy fnb-notify:00000000011290_notify_prefs_fn to pg

begin;

-- ─── notify_fn (SECURITY DEFINER) ────────────────────────────────────────────
-- The user-facing writers derive the profile from jwt.profile_id() INTERNALLY (never a param), so
-- they are safe to grant to `authenticated` even though notify.channel_preference has no client
-- write policy — a caller can only ever touch their own row. Contrast request_phone_verification,
-- which runs over the n8n_worker connection (no jwt claims) and so takes a trusted _profile_id
-- (the phone-verification workflow got it from the caller's claims, injected by the trigger plugin).

---------------------------------------------- set_channel_preference (D12)
-- Upsert the caller's (profile, channel) preference. Enabling 'sms' requires a prior verified phone
-- (D13); email is implicitly verified on first write.
CREATE OR REPLACE FUNCTION notify_fn.set_channel_preference(
    _channel notify.notification_channel
    ,_enabled boolean
  )
  RETURNS notify.channel_preference
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $$
  DECLARE
    _profile_id uuid := jwt.profile_id();
    _row notify.channel_preference;
  BEGIN
    if _profile_id is null then
      raise exception 'not authenticated' using errcode = '28000';
    end if;

    if _enabled and _channel = 'sms'
       and not exists (
         select 1 from notify.channel_preference
         where profile_id = _profile_id and channel = 'sms' and verified_at is not null
       ) then
      raise exception 'sms channel requires a verified phone' using errcode = 'check_violation';
    end if;

    insert into notify.channel_preference (profile_id, channel, enabled, verified_at)
    values (
      _profile_id, _channel, _enabled,
      case when _channel = 'email' then current_timestamp else null end
    )
    on conflict (profile_id, channel) do update
      set enabled = excluded.enabled, updated_at = current_timestamp
    returning * into _row;

    return _row;
  end;
  $$;

---------------------------------------------- request_phone_verification (D13)
-- Generate + persist an OTP for _profile_id/_phone and return the PLAINTEXT code to the caller
-- (n8n_worker only — the phone-verification workflow, which then sends it via send-notification).
-- Invalidates any prior unconsumed code for that (profile, phone). Code stored bcrypt-hashed.
CREATE OR REPLACE FUNCTION notify_fn.request_phone_verification(
    _profile_id uuid
    ,_phone citext
  )
  RETURNS text
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $$
  DECLARE
    _code text := lpad((floor(random() * 1000000))::int::text, 6, '0');
  BEGIN
    update notify.phone_verification
      set consumed_at = current_timestamp
      where profile_id = _profile_id and phone = _phone and consumed_at is null;

    insert into notify.phone_verification (profile_id, phone, code_hash, expires_at)
    values (_profile_id, _phone, crypt(_code, gen_salt('bf')), current_timestamp + interval '10 minutes');

    return _code;
  end;
  $$;

---------------------------------------------- verify_phone_code (D13)
-- Check the caller's newest unconsumed code for _phone; on success consume it, mark the sms
-- preference verified (+ set destination) and mirror the number onto app.profile.phone (F6).
-- Returns { verified: bool, reason? }. Attempt-limited (5) + expiry (10m). Wrong codes increment
-- attempts; the code_hash is never returned or compared client-side.
CREATE OR REPLACE FUNCTION notify_fn.verify_phone_code(
    _phone citext
    ,_code text
  )
  RETURNS jsonb
  LANGUAGE plpgsql
  VOLATILE
  SECURITY DEFINER
  AS $$
  DECLARE
    _profile_id uuid := jwt.profile_id();
    _row notify.phone_verification;
  BEGIN
    if _profile_id is null then
      raise exception 'not authenticated' using errcode = '28000';
    end if;

    select * into _row
    from notify.phone_verification
    where profile_id = _profile_id and phone = _phone and consumed_at is null
    order by created_at desc
    limit 1;

    if _row.id is null then
      return jsonb_build_object('verified', false, 'reason', 'no_pending_code');
    end if;
    if _row.expires_at < current_timestamp then
      return jsonb_build_object('verified', false, 'reason', 'expired');
    end if;
    if _row.attempts >= 5 then
      return jsonb_build_object('verified', false, 'reason', 'too_many_attempts');
    end if;

    if _row.code_hash <> crypt(_code, _row.code_hash) then
      update notify.phone_verification set attempts = attempts + 1 where id = _row.id;
      return jsonb_build_object('verified', false, 'reason', 'invalid_code');
    end if;

    update notify.phone_verification set consumed_at = current_timestamp where id = _row.id;

    insert into notify.channel_preference (profile_id, channel, destination, verified_at)
    values (_profile_id, 'sms', _phone, current_timestamp)
    on conflict (profile_id, channel) do update
      set destination = excluded.destination
         ,verified_at = current_timestamp
         ,updated_at  = current_timestamp;

    update app.profile set phone = _phone, updated_at = current_timestamp where id = _profile_id;

    return jsonb_build_object('verified', true);
  end;
  $$;

-- ─── notify_api (SECURITY INVOKER — the PostGraphile mutation surface) ────────
-- No license permission gates these — any authenticated user manages their OWN preferences (the
-- guard is a non-null jwt.profile_id()); the _fn self-binds to that same profile.
CREATE OR REPLACE FUNCTION notify_api.set_channel_preference(
    _channel notify.notification_channel
    ,_enabled boolean
  )
  RETURNS notify.channel_preference
  LANGUAGE plpgsql
  VOLATILE
  AS $$
  BEGIN
    if jwt.profile_id() is null then
      raise exception 'not authenticated' using errcode = '28000';
    end if;
    return notify_fn.set_channel_preference(_channel, _enabled);
  end;
  $$;

CREATE OR REPLACE FUNCTION notify_api.verify_phone_code(
    _phone citext
    ,_code text
  )
  RETURNS jsonb
  LANGUAGE plpgsql
  VOLATILE
  AS $$
  BEGIN
    if jwt.profile_id() is null then
      raise exception 'not authenticated' using errcode = '28000';
    end if;
    return notify_fn.verify_phone_code(_phone, _code);
  end;
  $$;

-- authenticated reaches the two user-facing notify_fn writers through the notify_api wrappers
-- (INVOKER → DEFINER). The notify package restricts notify_fn to n8n_worker by default (011270), so
-- grant these two explicitly. request_phone_verification stays n8n_worker-only (default privileges).
grant execute on function notify_fn.set_channel_preference(notify.notification_channel, boolean) to authenticated;
grant execute on function notify_fn.verify_phone_code(citext, text) to authenticated;

commit;
