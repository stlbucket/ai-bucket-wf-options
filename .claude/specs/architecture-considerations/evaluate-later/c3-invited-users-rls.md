# C3 — Invited Users: Nullable profile_id and view_own_resident_email

## The Problem

Users can be invited to a tenant by email before they have registered an account.
`app.resident.profile_id` is **nullable** for this reason — an invited resident exists
with only an email, no linked profile yet.

Standard RLS policies like `view_own_resident` check `auth.uid() = profile_id`, which
would never match a NULL profile_id. Invited users would have no way to see their pending
invitation.

## The Solution: `view_own_resident_email`

A special RLS policy on `app.resident` that matches by email instead of profile_id:

```sql
CREATE POLICY view_own_resident_email ON app.resident
  FOR SELECT
  USING (
    auth.jwt()->>'email' = email
    AND auth.tenant_id() = tenant_id
  );
```

This allows a newly registered user (who already has claims with their email) to see their
pending invitation in the target tenant even before their profile_id is linked.

## The Link: `handle_new_user` Trigger

When the user completes registration, `auth.user` INSERT fires → `app_fn.handle_new_user()`
updates `app.resident SET profile_id = new.id WHERE email = new.email AND status NOT IN
('blocked_individual', 'blocked_tenant')`. After this, the standard `view_own_resident`
policy applies and `view_own_resident_email` becomes redundant (but still correct).

## Why This Matters for New Modules

If a module has its own shadow `<module>_resident` table and you want to support invited
users, the shadow resident must also handle nullable profile_id. The module's `ensure_<module>_resident`
function should accept a resident_id (not profile_id) — the app.resident record is the
authoritative link, and its profile_id will be populated by the trigger chain.
