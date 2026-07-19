# Plan: Tenant-level nav for the assets page (`p:app-user`) (asset-storage v2 — final-eval M6)

> **Execution Directive:** Implement via the `fnb-stack-implementor` skill (+ `fnb-db-designer`
> for the nav/tool SQL; `sqitch-expert` for the change mechanics — never run `git` in a sqitch
> session). Invoke: `/fnb-stack-implementor .claude/issues/identified/asset-tenant-nav.plan.md`
> Gate is `pnpm build`. Never rebuild Docker yourself — nav rows only go live on a DB reseed,
> which wipes the DB (test data gone, tenant users revert to invited) — the USER decides when.

**Severity: LOW (v2 enhancement)** · Workstream: asset-storage · Identified: 2026-07-06 (final-eval M6 — recorded deferral)

## Details

Today `/storage/assets` is reachable by URL for any authenticated tenant user (the page is
RLS-scoped, so regular users correctly see only their tenant's assets), but the **only** nav entry
is the site-admin tool `tenant-site-admin-asset-manager` (gated `p:app-admin-super`, in the
`site-admin` module — `db/fnb-app/deploy/00000000010240_app_fn.sql:336`). Regular `p:app-user`
users have no way to discover the page.

## Constraints (R14: nav is DB-registered, not hardcoded)

- Nav is driven by `ProfileClaims.modules` assembled from DB module/tool rows; permission keys on
  tools gate visibility client-side, with the DB as the real enforcement (R12/R13 — already true
  here via RLS + the `insert_asset` gate).
- Decide the module home for the user-facing tool:
  - (a) a new **`assets` module** registered via `app_fn.install_basic_application(...)` (the
    standard mechanism → deep-ref b5), with a `p:app-user`-keyed tool pointing at
    `/storage/assets` (cross-app link — same precedent as the Workflow Dashboard tool); or
  - (b) hang a tool off an existing tenant-facing module.
  Recommend (a) — self-contained, and gives the storage module a nav home for future tools
  (e.g. a "My uploads" filter view). Note `install_basic_application` also creates license-type /
  pack wiring — check whether `p:app-user` scoping suffices or a `p:assets` module permission is
  warranted (mirrors `p:todo`/`p:discussions`; would need license-pack membership → b2/b3).
- The change is **sqitch** (R10): either rework the existing `00000000010240_app_fn.sql` seed
  change (how the site-admin tool was added) or an additive change in `db/fnb-storage/` — follow
  whatever the prior nav additions did; matching revert/verify required.
- If a nav section should also render inside storage-app itself, register it via the layer's
  `plugins/nav-register.ts` pattern (`useNavRegistry().register([...])`) — but the DB rows remain
  the source of truth for the cross-app dashboard grid.

## Decision to surface to the user before building

Whether plain `p:app-user` gets the tool (spec's upload permission — matches W7's observed
`enforce_any_permission(['p:app-admin','p:app-user'])` gate) or a dedicated `p:assets` permission
is introduced. The DB insert gate and the nav key should end up telling the same story — W7's
undocumented widening should be resolved (revert to `p:app-user`-only or codify) in the same
change.

## Verification (after the user runs the reseed)

- Fresh login as a plain tenant user (remember: reseed reverts tenant users to invited; use the
  super-admin `bucket@` account to re-activate or verify via a demo tenant): the assets tool
  appears in their nav; clicking it lands on `/storage/assets` showing only their tenant's assets.
- Super-admin still sees the site-admin Asset Manager tool.
- `pnpm build` green; sqitch deploy/revert/verify all pass on a scratch deploy.
