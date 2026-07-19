# Plan: RLS silently missing on msg_tenant (copy-paste bug), loc shadow tables, and app.module/tool/app_settings

> **Execution Directive:** Implement via the `sqitch-expert` + `fnb-db-designer` skills.
> Invoke: `/fnb-stack-implementor .claude/issues/identified/rls-gaps-msg-loc-app.plan.md`
> Never run `git` in a sqitch session; never redeploy the DB yourself — ask the user, then verify read-only.

**Severity: HIGH** · Workstream: WS2 (DB security) · Identified: 2026-07-05

## Details

Three separate RLS coverage gaps, all combined with `grant all ... to anon, authenticated`:

1. **`msg.msg_tenant` — policies exist but RLS is never enabled (copy-paste bug).**
   `db/fnb-msg/deploy/00000000010420_msg_policies.sql:31` runs
   `alter table msg.msg_resident enable row level security;` where the surrounding block targets
   `msg_tenant` (the CREATE POLICY statements that follow are correctly *on* `msg.msg_tenant`).
   Line 42 then enables RLS on `msg.msg_resident` **again** (harmless duplicate). Net effect:
   `msg_tenant` has inert policies — with grant-all-to-anon, anon has unrestricted access to it.
   Additional msg observations (same file): every msg table has only SELECT+INSERT policies (no
   UPDATE/DELETE — see `msg-delete-topic-gate.plan.md`), and the `manage_all` super-admin policies
   are commented out (~lines 99-109).

2. **`loc.loc_tenant` and `loc.loc_resident` — no RLS at all.**
   `db/fnb-loc/deploy/00000000010330_loc_policies.sql` enables RLS only on `loc.location`; the two
   shadow tables (created in `00000000010300_loc.sql`) get grants but no RLS.

3. **`app.module`, `app.tool`, `app.app_settings` — no RLS at all.**
   `db/fnb-app/deploy/00000000010250_app_policies.sql` covers profile/resident/tenant/
   tenant_subscription/license/application/license_pack/license_type/permission/support_ticket/
   support_ticket_comment — but the three tables above (created in `00000000010220_app.sql`) are
   never RLS-enabled. `grant all on all tables in schema app to anon` makes them world-writable.
   These drive the navigation tree (`ProfileClaims.modules` per global-rules R14) — a write here
   changes every user's nav.

## Implication

Anon/authenticated roles can read and **write** module/tool/app_settings (nav injection, settings
tampering) and msg_tenant/loc shadow rows (cross-tenant shadow-table manipulation, breaking the
lazy-init invariants that `ensure_<module>_resident` relies on). All three violate global-rules R9.

## Suggested fix

One sqitch change per package (deploy + revert + verify):

1. **fnb-msg:** change line 31 to `alter table msg.msg_tenant enable row level security;`
   (rework or new change per sqitch-expert guidance — the original change is deployed, so a new
   corrective change is the right shape). Decide with the user whether to also (a) add UPDATE
   policies where mutations legitimately update (e.g. topic rename via `msg_api.upsert_topic`),
   and (b) uncomment/reinstate the `manage_all` super-admin policies.
2. **fnb-loc:** enable RLS on `loc.loc_tenant` + `loc.loc_resident` with the same tenant-scoped
   policy shape used by `storage.storage_tenant`/`storage_resident`
   (`db/fnb-storage/deploy/00000000010620_storage_policies.sql` is the current best-practice
   reference: `manage_all_for_tenant` + `manage_all_super_admin`).
3. **fnb-app:** enable RLS on `app.module`, `app.tool`, `app.app_settings`. `module`/`tool` are
   read-mostly catalog data maintained by `app_fn.install_basic_application` — a
   `FOR SELECT USING (true)` policy (matching the other reference tables' `1=1` SELECT-only pattern
   at `00000000010250_app_policies.sql:~93-127`) plus super-admin manage policy is likely right.
   `app_settings` should probably be super-admin only; confirm intended readers with the user.
4. Narrow grants where write access isn't needed (SELECT to authenticated; drop anon table grants
   unless a public read path exists).

## Verification

- `select n.nspname, c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in ('app','msg','loc','todo','wf','storage') and not c.relrowsecurity;` → zero rows.
- As anon: `insert into app.module ...` → permission denied; `select * from msg.msg_tenant` → denied/empty.
- Nav still renders for a normal user after redeploy (module/tool SELECT path intact).
