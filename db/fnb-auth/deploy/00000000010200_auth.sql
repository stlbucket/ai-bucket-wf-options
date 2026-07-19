----------------------------------------------------------------------------------------------
-- this schema provides helpers, primarily to access jwt->user_metadata->A-VALUE
----------------------------------------------------------------------------------------------
create schema if not exists auth;
----------------------------------------------------------------------------------------------
CREATE TABLE auth.user (
  instance_id            uuid        NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  aud                    text,
  role                   text,
  email                  citext      NOT NULL UNIQUE,
  email_confirmed_at     timestamptz,
  recovery_sent_at       timestamptz,
  last_sign_in_at        timestamptz,
  raw_app_meta_data      jsonb,
  raw_user_meta_data     jsonb,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  confirmation_token     text,
  email_change           text,
  email_change_token_new text,
  recovery_token         text,
  full_name              citext      NOT NULL,
  hashed_password        text        NOT NULL,
  recovery_phone         citext
);
----------------------------------------------------------------------------------------------
CREATE TABLE auth.identities (
  id              uuid        PRIMARY KEY,
  user_id         uuid        NOT NULL REFERENCES auth.user (id) ON DELETE CASCADE,
  provider_id     text        NOT NULL,
  identity_data   jsonb       NOT NULL,
  provider        text        NOT NULL,
  last_sign_in_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_id)
);
CREATE OR REPLACE FUNCTION auth.login_user(_email citext, _password text)
  RETURNS auth.user
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  AS $function$
  DECLARE
    _user auth.user;
  BEGIN
    SELECT * INTO _user
    FROM auth.user
    WHERE email = _email
      AND hashed_password = crypt(_password, hashed_password);

    IF NOT FOUND THEN
      RAISE EXCEPTION 'invalid credentials';
    END IF;

    RETURN _user;
  END;
  $function$
  ;
