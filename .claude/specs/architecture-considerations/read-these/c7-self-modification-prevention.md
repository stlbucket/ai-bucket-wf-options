# C7 — Self-Modification Prevention in `grant_user_license`

`app_fn.grant_user_license` prevents an admin from modifying their own scoped license,
which would otherwise allow them to accidentally (or deliberately) lock themselves out.

## The Check

```sql
CREATE OR REPLACE FUNCTION app_fn.grant_user_license(
  _resident_id uuid,
  _license_type_key citext,
  _current_user_resident_id uuid  -- the caller's resident ID
)
RETURNS app.license LANGUAGE plpgsql AS $$
DECLARE
  _license_type app.license_type;
BEGIN
  SELECT * INTO _license_type FROM app.license_type WHERE key = _license_type_key;

  -- For scoped license types, prevent self-modification
  IF _license_type.assignment_scope IN ('admin', 'user', 'superadmin', 'support') THEN
    IF _current_user_resident_id = _resident_id THEN
      RAISE EXCEPTION 'Cannot modify your own scoped license' USING ERRCODE = '30001';
    END IF;

    -- Delete existing license of the same scope for this application
    DELETE FROM app.license
    WHERE resident_id = _resident_id
      AND license_type_key IN (
        SELECT key FROM app.license_type
        WHERE application_key = _license_type.application_key
          AND assignment_scope = _license_type.assignment_scope
      );
  END IF;

  -- Insert the new license
  INSERT INTO app.license (resident_id, license_type_key, ...)
  VALUES (_resident_id, _license_type_key, ...)
  ON CONFLICT ... DO UPDATE ...;
  ...
END; $$;
```

## Why This Matters

Without this check, a tenant admin could call the grant endpoint targeting themselves with
a different (or no) license type — effectively revoking their own admin license and locking
themselves out of the admin UI.

## The `_current_user_resident_id` Parameter

`app_api.grant_user_license` (the SECURITY INVOKER public surface) passes
`auth.resident_id()` as the third argument — the currently authenticated user's resident ID.
Since `app_api` functions run inside a `withClaims` transaction, `auth.resident_id()` returns
the correct resident ID from the JWT claims.

## Scope

This check only applies to `admin`, `user`, `superadmin`, and `support` scopes (the "scoped"
types where the delete-and-replace behavior fires). `none` and `all` scope license types are
not affected — they are not individually grantable anyway.
