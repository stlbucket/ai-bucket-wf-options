# B5 — `install_basic_application` Call Signature

The standard way to register a new module with the fnb platform. Creates the application
record, modules, tools, license types, permissions, license pack, and auto-subscribes tenants.

## Full SQL Call Pattern

```sql
SELECT app_fn.install_basic_application(
  'my-app'::citext,              -- application key (unique)
  'My Application'::citext,      -- display name
  'A description of my app'::citext,  -- description
  true,                          -- auto_subscribe (subscribe all existing + new tenants)
  ARRAY[
    ROW(
      'my-module'::citext,                    -- module key
      'My Module'::citext,                    -- module display name
      ARRAY['p:my-app']::citext[],            -- module permission_keys (for nav gating)
      'i-lucide-star'::citext,               -- module icon (i-lucide-* only)
      1,                                      -- ordinal (display order)
      ARRAY[
        ROW(
          'my-tool'::citext,                  -- tool key
          'My Tool'::citext,                  -- tool display name
          ARRAY['p:my-app']::citext[],        -- tool permission_keys
          'i-lucide-star'::citext,            -- tool icon
          '/my-app'::citext,                  -- tool route
          1                                   -- tool ordinal
        )::app_fn.tool_info
      ]::app_fn.tool_info[]
    )::app_fn.module_info
  ]::app_fn.module_info[]
);
```

## What It Creates

1. `app.application` row — key, name, description
2. `app.module` rows — one per entry in the modules array
3. `app.tool` rows — one per entry in each module's tools array
4. `app.license_type` rows — `my-app` (user scope) + `my-app-admin` (admin scope)
5. `app.permission` rows — `p:my-app` + `p:my-app-admin`
6. `app.license_type_permission` rows — joining types to permissions
7. `app.license_pack` row — key `my-app`, auto_subscribe = param
8. If `auto_subscribe = true`: `app.tenant_subscription` rows for all existing tenants

## Casting Syntax Note

The `ROW(...)::app_fn.module_info` and `ROW(...)::app_fn.tool_info` casts are required —
PostgreSQL needs the explicit composite type cast to know how to interpret the ROW literals.
Omitting the cast produces a "could not determine row type" error.

## Deploy File Location

Add as a new sqitch change in `db/fnb-<module>/deploy/`:
```
db/fnb-<module>/deploy/<timestamp>_<module>_app.sql
```
The change depends on `fnb-app` (specifically the bootstrap function being available).
