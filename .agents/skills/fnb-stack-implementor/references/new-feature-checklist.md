# Adding a New Feature — Checklist

Read when building any new feature. The stack itself is described in
`docs/specs/graphql-api-pattern.md` + `docs/specs/package-layers-pattern.md` — this file is the
build sequence only. `→ skill <name>` means: read `.agents/skills/<name>/SKILL.md` before that
step. `→ [xx]` codes are the deep-reference docs listed in `key-file-paths.md`.

## Quick reference the steps below consume

Permission keys (full list + license mechanics → [b2], [b3]):

| Key | Who has it |
|-----|-----------|
| `p:app-user` | Every tenant user |
| `p:app-admin` | Tenant admins |
| `p:app-admin-super` | Platform super admins (anchor tenant only) |
| `p:app-admin-support` | Support staff (anchor tenant only) |
| `p:todo` / `p:discussions` / … | Module users |

RLS policy template → [a3]:
```sql
alter table <module>.<table> enable row level security;
CREATE POLICY view_all_for_tenant ON <module>.<table>
  FOR SELECT USING (jwt.has_permission('p:<module>', tenant_id));
```

`_api` permission-gate template → [a2] (verified: `msg_api.upsert_topic`):
```sql
CREATE OR REPLACE FUNCTION <module>_api.<action>(_args)
  RETURNS <type> LANGUAGE plpgsql VOLATILE   -- SECURITY INVOKER (default)
AS $$
BEGIN
  PERFORM jwt.enforce_permission('p:<module>');       -- raises if missing
  RETURN <module>_fn.<action>(_args, jwt.resident_id());
END; $$;
```

## 1. DB layer (`db/<module>/`)

→ skill `fnb-db-designer` for schema/RLS/permission design; → skill `sqitch-expert` for plan
mechanics (numbering ranges, cross-project deps, rework); brand-new `db/<package>` → skill
`new-db-package` first (scaffolds files + registers in `DEPLOY_PACKAGES`).

1. `sqitch.plan` entry with dependency on `fnb-app` → [g1] (+ `fnb-res:00000000011000_res`
   if the module registers URNs — every business-object module does)
2. `deploy/<ts>_<module>.sql` — schema, tables, enums; registered tables carry the generated
   `urn` column + deferred FK to `res.resource(id)`; resident references are `*_resident_urn`
   URN columns (no mirror tables — `docs/specs/urn-registry/`)
3. `deploy/<ts>_<module>_fn.sql` — business logic (SECURITY DEFINER);
   `res_fn.register_resource` after each insert, `res_fn.archive_resource` at delete sites
4. `deploy/<ts>_<module>_api.sql` — API functions (SECURITY INVOKER) with `jwt.enforce_permission` gates
5. `deploy/<ts>_<module>_policies.sql` — grants + RLS policies
6. Register via `app_fn.install_basic_application(...)` → [b5], [b4]; add the module to
   `res.module_permission` (registry visibility — urn-registry spec §4.2)
   (Never run any `git` command in a sqitch session.)

## 2. Expose it — confirm PostGraphile sees the schemas

If the module introduces new `<module>` / `<module>_api` schemas, add them to `pgServices.schemas`
in `apps/graphql-api-app/server/graphile.config.ts`. Smart-tag overrides go in
`apps/graphql-api-app/postgraphile.tags.json5`. → skill `postgraphile-5-expert`.

## 3. graphql-client-api layer (`packages/graphql-client-api/src/`)

- Add operation documents under `src/graphql/<module>/{query,mutation,fragment}/*.graphql`. Use
  PostGraphile's auto-generated field names (check `src/generated/fnb-graphql-api.ts` or GraphiQL).
- Run codegen: `pnpm -F @function-bucket/fnb-graphql-client-api generate`. Hook name follows the
  operation: `query FooBar` → `useFooBarQuery()`.
- Add the entity type to `@function-bucket/fnb-types` (if new) and a mapper
  `src/mappers/<entity>.ts` (`to<Entity>(fragment): <Entity>`). Expand the fragment to select
  every field the type needs (global-rules R3). **Every composable returns `fnb-types` shapes via
  its mapper — no inline shaping, no exporting generated types through the barrel.**
- Write the composable `src/composables/use{Domain}.ts` — wrap the generated hook(s), call the
  mapper, return `fnb-types` shapes (`computed` data, `fetching`, `error`; no `refresh` — use
  `executeQuery({ requestPolicy: 'network-only' })`). Declare composable **view** types here (R4).
- **Wire into the barrel `src/index.ts` — the #1 miss** (see `special-cases.md` → barrels).

## 4. Composable re-export (`apps/<app>/app/composables/`)

```ts
export { use{Domain} } from '@function-bucket/fnb-graphql-client-api'
```
Feature apps have **no `server/` directory** — do not add REST routes.

## 5. Nuxt layer (`packages/<module>-layer/`) — only if adding a whole layer

- `nuxt.config.ts` — `extends: ['@function-bucket/fnb-<parent>-layer']`
- **Nav is registered in the DB, not in a plugin** (R14): module/tool rows come from
  `app_fn.install_basic_application(...)` → [b5], [b4]; `useAppNav()` (tenant-layer) renders
  sections from `useAuth().user.modules` claims. There is no `nav-register.ts`/`useNavRegistry`.
- **`package.json` must declare `"@nuxt/ui": "catalog:"` in `dependencies`** — pnpm does not
  hoist, so `@nuxt/ui` must be a direct dependency even if a parent layer declares it.
- **New-dependency workflow (R24):** catalogued packages are declared `"catalog:"`; new shared
  deps get a `pnpm-workspace.yaml` catalog entry first. Never `latest`/`*`. Gate: `pnpm dep-audit`.

## 6. Nuxt app (`apps/<app>/`)

Brand-new app → skill `fnb-create-app` (full skeleton). The bullets below are for touching an
**existing** app.

- `nuxt.config.ts` — `extends: [...]`, set `NUXT_APP_BASE_URL` (must match the Caddy `handle`
  prefix), declare `runtimeConfig.public.graphqlApiUrl` as a `''` sentinel
- Ensure `app/plugins/urql.client.ts` exists (`preferGetMethod: false`, provides `$urqlClient`);
  add `@urql/vue` (`"catalog:"`) to the app `package.json` if missing
- **`"@nuxt/ui": "catalog:"` direct dep** — same hoist reason as layers
- Pages call composables only — zero `$fetch`/`useFetch`/`/api/` paths; permission-gated
  rendering via `useAuth().user.value.permissions`
- Add the Docker service in `docker-compose.yml` + Caddy `handle` block in `docker/Caddyfile`
- UI rules: UC4 (UCard container) · UC5 (responsive) · UC6 (color tokens) · UC7 (useToast) ·
  UC8 (UEmpty) · UC11 (verify `i-lucide-*` names) · UC12 (width constraints) ·
  **UC15 (UTable v4 column API — never v3)** · **UC14 (`ssr: false` for urql pages — same
  change)**. Full text: `docs/specs/ui-components-rules.md`.
