# G1 — Sqitch Package Deployment Dependency Graph

The order in which sqitch packages must be deployed. Critical for declaring correct
`[requires]` dependencies in `sqitch.plan` when adding a new DB package.

## Deployment Order

```
fnb-auth
  ├── extensions     (pgcrypto, uuid-ossp, citext, pg_trgm)
  ├── auth schema    (auth.user table, JWT helpers: auth.uid(), auth.jwt(), etc.)
  ├── roles          (authenticator, authenticated, anon, service_role — NOINHERIT config)
  └── auth policies  (RLS on auth.user)
        ↓
fnb-app
  ├── app schema     (app.tenant, app.profile, app.resident, app.license, etc.)
  ├── app_fn         (types + business logic functions, SECURITY DEFINER)
  ├── app_fn_definers (profile_claims_for_user, current_profile_claims — granted to authenticator)
  ├── app_fn_support  (become_support, exit_support_mode)
  ├── app policies   (RLS on all app.* tables)
  └── app bootstrap  (anchor tenant seed, install_basic_application, base license pack)
        ↓ (all parallel after fnb-app)
  ┌────────────────────────────────────────────┐
  │              │              │              │
fnb-msg       fnb-todo        fnb-wf       fnb-my-app
```

## Declaring Dependencies in `sqitch.plan`

When adding a new package (e.g. `fnb-widget`), the first change must depend on the
appropriate upstream package:

```
# sqitch.plan for db/fnb-widget/
%syntax-version=1.0.0
%project=fnb-widget

00000000010700_widget [fnb-app:00000000010260_app_bootstrap] 2026-06-11 ...
```

The `[fnb-app:00000000010260_app_bootstrap]` dependency ensures the anchor tenant and
`install_basic_application` function exist before the widget package tries to use them.

## Cross-Package Dependency Syntax

```
<change_name> [<project>:<change_name>] <datetime> <author> <description>
```

- `fnb-app:00000000010260_app_bootstrap` — depends on the bootstrap change in fnb-app
- `fnb-auth:00000000010100_auth` — depends on the core auth schema in fnb-auth

## Deploy Script

`scripts/db-deploy.ts` runs packages in the correct order. When adding a new package,
register it in the deploy script AND declare the sqitch cross-package dependency — both
are required.

## `DEPLOY_PACKAGES` in docker-compose.yml

The `db-migrate` service uses:
```yaml
DEPLOY_PACKAGES: "${DEPLOY_PACKAGES:-fnb-auth fnb-app}"
```

Default deploys only `fnb-auth` and `fnb-app`. To include module packages (msg, loc, etc.),
set `DEPLOY_PACKAGES=fnb-auth fnb-app fnb-msg` in your `.env` or override.
