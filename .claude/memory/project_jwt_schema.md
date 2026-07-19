---
name: project-jwt-schema
description: JWT accessor functions live in the jwt schema (not auth); grants required for authenticated/anon
metadata:
  type: project
---

JWT helper functions (uid, tenant_id, resident_id, has_permission, enforce_permission, etc.) were
moved from the `auth` schema into a dedicated `jwt` schema.

**Why:** Clean separation of concerns — `auth` schema holds persistent user data (auth.user table,
auth.login_user function); `jwt` schema holds stateless JWT payload accessors.

**How to apply:**
- All RLS policies and `_api` SECURITY INVOKER functions call `jwt.*()` not `auth.*()`
- The `jwt` schema is defined in `db/fnb-auth/deploy/00000000010150_jwt.sql`
- Grants for `authenticated`, `anon`, `service_role` to use jwt functions live in
  `db/fnb-auth/deploy/00000000010500_auth_policies.sql`
- Architecture doc `a2-auth-sql-helpers.md` documents the jwt.* function implementations
- SKILL.md templates use `jwt.enforce_permission()` and `jwt.resident_id()` in `_api` gates

See [[a2]] for full function reference.
