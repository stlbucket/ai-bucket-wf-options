# C4 — `handle_new_user` Trigger Chain

> **HISTORICAL (ZITADEL cutover 2026-07-08).** `auth.user` and this trigger are dropped
> (`db/fnb-app` change `00000000010280_drop_auth_user`). The provisioning behavior described
> below now lives in `app_fn.provision_idp_user` (called by the auth-app OIDC callback via
> db-access) — same email-linking semantics, keyed by ZITADEL `sub` instead of an auth.user row.
> See `.claude/specs/future-auth/zitadel-login-pattern.md`.

When a new user registers (INSERT into `auth.user`), an automatic trigger chain runs to
set up their application-level identity.

## Trigger Definition

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.user
  FOR EACH ROW
  EXECUTE PROCEDURE app_fn.handle_new_user();
```

## `app_fn.handle_new_user()` Logic

```sql
-- SECURITY DEFINER — runs with elevated privileges, no claims required
CREATE OR REPLACE FUNCTION app_fn.handle_new_user()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Create the profile
  INSERT INTO app.profile (id, email, display_name, status)
  VALUES (
    new.id,
    new.email,
    split_part(new.email, '@', 1),  -- default display name from email prefix
    'active'
  );

  -- Link any pending resident invitations by email
  UPDATE app.resident
  SET profile_id = new.id
  WHERE email = new.email
    AND status NOT IN ('blocked_individual', 'blocked_tenant');

  RETURN new;
END; $$;
```

## What Happens

1. New `auth.user` row inserted (registration)
2. Trigger fires → `handle_new_user()` executes
3. `app.profile` created with `id = auth.user.id` (same UUID)
4. Any existing `app.resident` rows with matching email get `profile_id` linked

## Implications

- `app.profile.id = auth.user.id` is always true — they share the same UUID
- Default display name is the email prefix (before `@`) — users can change it in profile
- Invited residents are automatically linked without any additional API call
- Blocked residents (individual or tenant) are NOT linked — a blocked resident stays unlinked
- SECURITY DEFINER means this runs even during the auth flow before any claims exist

## Source

`db/fnb-app/deploy/00000000010240_app_fn.sql`
