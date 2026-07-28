---
name: project-rls-repro-claims-shape
description: How to reproduce RLS behavior in psql — claims must be wrapped in user_metadata (snake_case), not flat ProfileClaims
metadata:
  type: project
---

To reproduce what a user sees through PostGraphile, replay their claims in psql. The gotcha:
`jwt.*()` helpers read `request.jwt.claims -> 'user_metadata' ->> '<key>'` (snake_case), NOT the
flat `ProfileClaims` shape and NOT the `to_jsonb(app_fn.current_profile_claims(...))` output.
Using either wrong shape silently yields `jwt.tenant_id() = NULL` / `has_permission = false`
(everything filters to zero rows) — a false "RLS is broken" signal.

**How to apply** (mirrors `graphile.config.ts` pgSettings, `apps/graphql-api-app/server/graphile.config.ts:84`):

```sql
begin;
select set_config('request.jwt.claims', json_build_object(
  'email','<email>', 'display_name','<name>',
  'user_metadata', json_build_object(
    'profile_id','<uuid>', 'tenant_id','<uuid>', 'resident_id','<uuid>',
    'actual_resident_id','<uuid>', 'permissions', json_build_array('p:app-admin', ...)
  ))::text, true);
set local role authenticated;
-- run the page's selects here
rollback;
```

Dev DB: host port from `DB_HOST_PORT` in `.env` (postgres/1234, db `fnb`). Dev logins seed with
password `poiuytre` (`docker/zitadel/seed.mjs`); `site-admin@example.com` is the super admin —
remember `p:app-admin-super` rows pass `FOR ALL` policies, so as super you see ALL tenants' rows
(unfiltered list queries render cross-tenant data; scope by condition, not RLS alone).
Related: [[project-jwt-schema]], [[project_super_admin_lacks_app_user]].
