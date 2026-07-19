begin;

-- Restore the pre-cutover password/identity machinery (tables come back empty; the seed
-- would need its old auth.user inserts back too — see git history of db/seed.sql).

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

create or replace function app_fn.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  as $$
  DECLARE
    _resident app.resident;
    _claims jsonb;
  begin
    insert into app.profile (id, email, display_name)
    values (new.id, new.email, split_part(new.email, '@', 1));

    update app.resident set
      profile_id = new.id
    where email = new.email
    and status != 'blocked_individual'
    and status != 'blocked_tenant'
    ;

    select * into _resident from app.resident where profile_id = new.id limit 1;
    return new;
  end;
  $$;

create or replace trigger on_auth_user_created
  after insert on auth.user
  for each row execute procedure app_fn.handle_new_user();

-- policies originally applied by fnb-auth 00000000010500_auth_policies
grant all on all tables in schema auth to anon, authenticated, service_role;
alter table auth.user enable row level security;
CREATE POLICY view_self ON auth.user
  FOR SELECT
  USING (jwt.uid() = id);
CREATE POLICY update_self ON auth.user
  FOR UPDATE
  USING (jwt.uid() = id)
  WITH CHECK (jwt.uid() = id)
  ;
CREATE POLICY manage_all_super_admin ON auth.user
  FOR ALL
  USING (jwt.has_permission('p:app-admin-super'));
alter table auth.identities enable row level security;

-- old function bodies (fnb-app 00000000010260_app_bootstrap / 00000000010243_app_fn_support)
CREATE OR REPLACE FUNCTION app_fn.profile_claims_for_user(_user_id uuid)
  RETURNS app_fn.profile_claims
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  AS $$
    SELECT app_fn.current_profile_claims(p.id)
    FROM app.profile p
    JOIN auth.user u ON u.email = p.email
    WHERE u.id = _user_id
  $$;

CREATE OR REPLACE FUNCTION app_fn.site_user_by_id(_id uuid)
    RETURNS jsonb
    LANGUAGE plpgsql
    stable
    SECURITY DEFINER
    AS $$
    DECLARE
      _result jsonb;
      _auth_user jsonb;
      _residency_info jsonb[];
      _resident app.resident;
      _license app.license;
    BEGIN
      select to_jsonb(u.*) into _auth_user from auth.user u where u.id = _id;

      _residency_info = '{}'::jsonb[];
      for _resident in
        select * from app.resident where profile_id = _id
      loop
        _residency_info := array_append(_residency_info, to_jsonb(_resident));
      end loop;

      _auth_user = _auth_user || jsonb_build_object('hashed_password', 'HIDDEN');

      _result = jsonb_build_object(
        'authUser', _auth_user,
        'residencies', _residency_info
      );
      return _result;
    end;
    $$;

commit;
