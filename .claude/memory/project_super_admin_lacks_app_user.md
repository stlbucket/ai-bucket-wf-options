---
name: project_super_admin_lacks_app_user
description: The anchor super-admin login lacks p:app-user — gate tenant-user actions with any-of {p:app-user, p:app-admin}
metadata:
  type: project
---

The default dev super-admin login `bucket@function-bucket.net` (anchor tenant) holds
`p:app-admin`, `p:app-admin-super`, `p:app-admin-support`, `p:todo`/`p:discussions` (+admin
variants) — but **NOT the base `p:app-user`**. Regular tenant users (e.g.
`my-app-tenant-user@example.com`) do have `p:app-user`.

**Consequence:** any `<module>_api` function or `WORKFLOW_REGISTRY` entry gated on a plain
`jwt.enforce_permission('p:app-user')` will raise `30000: NOT AUTHORIZED` for the super-admin
login even though they can obviously perform the action. This bit `app_api.create_deep_link`
(OTP-login "Copy quick-login link") — 2026-07-22.

**How to apply:** for actions available to both regular users and admins, use the **any-of gate**
`jwt.enforce_any_permission(array['p:app-user','p:app-admin']::citext[])` (DB) or
`permission: ['p:app-user','p:app-admin']` (the `triggerWorkflow` `WORKFLOW_REGISTRY`). This is the
established precedent — see the `game-event` registry entry's comment. Do the real scoping via the
tenant check (`jwt.tenant_id()`), not the permission breadth. Related: [[project_jwt_schema]].
