# Plan: Storage public-read functions serve assets that haven't passed virus scanning

> **Execution Directive:** Implement via the `sqitch-expert` + `fnb-db-designer` skills.
> Invoke: `/fnb-stack-implementor .claude/issues/identified/storage-public-scan-status.plan.md`
> Coordinate with `.claude/specs/asset-storage/` (this touches the active file-upload spec).
> Never run `git` in a sqitch session; never redeploy the DB yourself — ask the user, then verify read-only.

**Severity: MEDIUM** (design-stage — upload pipeline not yet built) · Workstream: WS2 (DB security) · Identified: 2026-07-05

## Details

`db/fnb-storage/deploy/00000000010615_storage_api.sql:17,25` defines the anon-facing public readers
`storage.public_asset(uuid)` and `storage.public_assets_for_entity(context, uuid)` (SECURITY
DEFINER, `set search_path = ''` — the hardening is otherwise exemplary). Their filters are:

```sql
where is_public and asset_status = 'active'
```

They do **not** require `scan_status = 'clean'`. The `storage.asset` table has
`scan_status scan_status not null` with enum values `('pending','clean','infected','error')`
(`00000000010608_storage_fn_types.sql`).

The asset-storage spec (`.claude/specs/asset-storage/README.md`, `endpoint.data.md`) says scanning
is synchronous at upload — infected files are rejected and never stored — which would make
`infected` rows unreachable in the happy path. But: (a) `async-scanning.future.md` explicitly plans
a move to async scanning where `pending` rows exist by design; (b) rows can be inserted through
`storage_api.insert_asset` (or `storage_fn.insert_asset` directly — see
`fn-schema-grant-bypass.plan.md`) **without any scan having occurred**, since the DB layer doesn't
enforce that the endpoint did its job; (c) `error`-status rows are also currently servable.

## Implication

A public asset whose scan is pending, errored, or (under any future async/bypass path) infected is
served to anonymous users by fetch-by-reference. The DB is the last line of defense; today it
delegates malware policy entirely to an endpoint that doesn't exist yet.

## Suggested fix

One sqitch change in `db/fnb-storage`:

1. Add `and scan_status = 'clean'` to both public readers' WHERE clauses.
2. Decide with the user how authenticated/tenant reads should treat non-clean assets: the
   RLS tenant policies on `storage.asset` don't filter scan_status either — probably correct for
   admins (they need to see quarantined items) but the eventual `downloadUrl` presign plugin
   (spec Phase 5, `graphql.data.md`) must refuse to presign non-clean assets. Record that
   requirement in `.claude/specs/asset-storage/graphql.data.md` now so Phase 5 inherits it.
3. Update `.claude/specs/asset-storage/_shared.data.md` invariants to state: "an asset is
   externally retrievable only when `scan_status='clean'` and `asset_status='active'`."

## Verification

- Insert (as super admin in a dev DB) a public asset row with `scan_status='pending'`:
  `select storage.public_asset(<id>)` → returns nothing; flip to `'clean'` → returned.
- Existing seed/demo public assets still resolve after redeploy.
- Spec files updated in the same change (R21 discipline: spec + code together).
