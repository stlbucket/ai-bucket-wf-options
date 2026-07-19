# A3 — Complete RLS Policy Reference

All RLS policies by table, with exact policy names and conditions. Source of truth:
`db/fnb-app/deploy/00000000010250_app_policies.sql`.

---

## `auth.user`
| Policy | Command | Condition |
|--------|---------|-----------|
| view_self | SELECT | `auth.uid() = id` |
| update_self | UPDATE | `auth.uid() = id` |
| manage_all_super_admin | ALL | `auth.has_permission('p:app-admin-super')` |

## `app.profile`
| Policy | Command | Condition |
|--------|---------|-----------|
| view_self | SELECT | `auth.uid() = id` |
| update_self | UPDATE | `auth.uid() = id` |
| manage_all_super_admin | ALL | `auth.has_permission('p:app-admin-super')` |

## `app.resident`
| Policy | Command | Condition |
|--------|---------|-----------|
| view_own_resident_email | SELECT | `auth.jwt()->>'email' = email AND auth.tenant_id() = tenant_id` |
| view_own_resident | SELECT | `auth.uid() = profile_id AND type != 'support' AND auth.tenant_id() = tenant_id` |
| update_own_resident | UPDATE | `auth.uid() = profile_id` |
| manage_own_tenant_residencies | ALL | `auth.has_permission('p:app-admin', tenant_id) AND type != 'support'` |
| manage_all_super_admin | ALL | `auth.has_permission('p:app-admin-super')` |

Note: `view_own_resident_email` supports invited users whose `profile_id` is still NULL —
they can see their pending invitation by email match before they register.

## `app.tenant`
| Policy | Command | Condition |
|--------|---------|-----------|
| view_own_tenant_user | SELECT | `auth.has_permission('p:app-user', id)` |
| manage_own_tenant_admin | ALL | `auth.has_permission('p:app-admin', id)` |
| manage_tenant | ALL | `auth.has_permission('p:app-admin-super')` |

## `app.tenant_subscription`
| Policy | Command | Condition |
|--------|---------|-----------|
| view_own_tenant_subscriptions | SELECT | `auth.has_permission('p:app-admin', tenant_id)` |
| manage_tenant_subscription | ALL | `auth.has_permission('p:app-admin-super')` |

## `app.license`
| Policy | Command | Condition |
|--------|---------|-----------|
| view_own_profile_licenses | ALL | `auth.profile_id() = profile_id` |
| view_own_tenant_licenses | ALL | `auth.has_permission('p:app-admin', tenant_id)` |
| manage_license | ALL | `auth.has_permission('p:app-admin-super')` |

## Reference Tables
Tables: `app.application`, `app.license_pack`, `app.license_type`, `app.permission`,
`app.module`, `app.tool`

| Policy | Command | Condition |
|--------|---------|-----------|
| view_all_users | SELECT | `1=1` (visible to all authenticated users) |

These are configuration/catalog data — every authenticated user can read them.

## Module Tables (msg, todo, loc)
```sql
-- msg:
USING (auth.has_permission('p:discussions', tenant_id))

-- todo:
USING (auth.has_permission('p:todo', tenant_id))

-- loc (tenant-scoped, no dedicated permission):
USING (auth.tenant_id() = tenant_id)
```
