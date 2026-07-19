# Plan: `Resource` type relation naming conflicts — `tenant`/`resident` keys collide on every schema build

> **Execution Directive:** Implement this plan via `/fnb-stack-implementor <this-file>`.

**Severity: LOW** (cosmetic-plus: noisy logs, two relations silently missing from `Resource`)
· Workstream: graphql/urn-registry · Identified: 2026-07-10 (while verifying workspace-tenants)

## Symptom

Every PostGraphile schema build logs three recoverable errors:

```
A naming conflict has occurred - two entities have tried to define the same key 'tenant'.  (×2)
A naming conflict has occurred - two entities have tried to define the same key 'resident'. (×1)
```

Confirmed via a local `makeSchema` run with `DEBUG="graphile-build:warn"` (2026-07-10):

- `Adding field to GraphQL type 'Resource' for singular relation 'tenantByMyTenantId'` — the
  `res.resource.tenant_id → app.tenant(id)` FK; simplify-inflection wants key `tenant`.
- `Adding field to GraphQL type 'Resource' for singular relation 'tenantByTheirId'` — the
  registration FK `app.tenant(id) → res.resource(id)` seen backward from `Resource` (unique →
  singular); also wants `tenant`.
- `Adding field to GraphQL type 'Resource' for singular relation 'residentByTheirId'` — same
  backward pattern for `app.resident(id) → res.resource(id)`; wants `resident` (collides with
  the winner from another resident-relation on `Resource`).

First registrant wins; the others are **dropped from the schema**. Pre-dates the workspace
feature (the `tenant_parent_tenant_id_fkey` self-FK is already explicitly named via smart tags
in `apps/graphql-api-app/postgraphile.tags.json5` and does not conflict).

## Suggested fix

Add `constraint` smart tags in `postgraphile.tags.json5` giving each colliding FK an explicit
`fieldName`/`foreignFieldName` (e.g. `owningTenant` for `resource.tenant_id`, and
`tenantResource`/`residentResource`-style names, or `behavior: -connection -list -single` if the
backward singular relations are never wanted). Constraint names to tag: the
`res.resource` FKs plus each registered table's `fk_<table>_resource` deferred FK
(`fk_tenant_resource`, `fk_resident_resource`, …) as needed. Then restart graphql-api-app,
confirm zero naming-conflict warnings, re-run codegen if any consumed name shifted (none of the
current `.graphql` documents reference the colliding relations).

## Task list

- [ ] Enumerate every FK into/out of `res.resource` and the winning/losing relation names
- [ ] Tag each with explicit names (or suppress unwanted directions)
- [ ] Restart graphql-api-app (user), verify clean build log
- [ ] Codegen + `pnpm build` to confirm nothing consumed a changed name
