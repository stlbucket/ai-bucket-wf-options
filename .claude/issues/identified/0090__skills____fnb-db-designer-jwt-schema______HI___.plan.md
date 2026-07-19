# Plan: fnb-db-designer skill documents nonexistent `auth.*` helpers (real schema is `jwt`) + enrich with hardening rules

> **Execution Directive:** Implement via the `fnb-stack-spec` skill (skill governance, fix + enrich).
> Invoke: `/fnb-stack-spec .claude/issues/identified/skill-fnb-db-designer-jwt-schema.plan.md`
> Doc-only. Never run `git`; commits are human-only.

**Severity: HIGH** (every RLS recommendation it makes is wrong) · Workstream: WS1 · Identified: 2026-07-05

## Details

`.claude/skills/fnb-db-designer/SKILL.md` (145 lines) documents the JWT/permission helpers as living
in the **`auth`** schema and names them `auth.uid()`, `auth.jwt()`, `auth.permissions()`,
`auth.has_permission()`, `auth.enforce_permission()`, `auth.tenant_id()` — in its frontmatter table,
"Permission Model", "RLS Pattern", and "Function Convention" sections. Example text:
*"Use `auth.has_permission('p:some-permission', optional_tenant_id)` in USING clauses"*.

In the actual codebase (`db/fnb-auth/deploy/00000000010150_jwt.sql`) these all live in the **`jwt`**
schema: `jwt.uid()`, `jwt.tenant_id()`, `jwt.resident_id()`, `jwt.profile_id()`,
`jwt.has_permission(key, tenant_id)`, `jwt.enforce_permission(key)`, and the permissions accessor is
`jwt.user_permissions()` **not** `permissions()`. The `auth` schema holds only `auth.user`,
`auth.identities`, `auth.login_user`. The separate `jwt` schema is never mentioned in the skill.

## Implication

Any RLS policy, `_api` gate, or helper the skill guides someone to write references functions that
don't exist — every such change fails at deploy. This is the most-wrong project skill: it's confidently
detailed and entirely off on the single most important detail (which schema/functions enforce
security). It also predates the audit findings, so it teaches none of the hardening the codebase
actually needs.

## Suggested fix (fix + enrich, per user's WS1 depth choice)

1. **Correct every `auth.*` helper reference to `jwt.*`** with the real names (`jwt.user_permissions()`,
   not `permissions()`), verified against `db/fnb-auth/deploy/00000000010150_jwt.sql`. Explain the
   schema split: `auth` = credentials/identity, `jwt` = claims-reading helpers used by RLS.
2. Document the **`jwt.has_permission(key, tenant_id default null)` null-tenant behavior**
   (one-arg = global check; tenant-scoped tables must pass `tenant_id` or rely on RLS) — from
   `jwt-has-all-permissions-bug.plan.md`.
3. **Enrich with hardening rules learned from this audit** (these are the recurring DB defects):
   - SECURITY DEFINER ⇒ **always `SET search_path = ''`** + schema-qualify the body
     (`security-definer-search-path.plan.md`).
   - **Never `grant execute on all routines in schema <module>_fn` to anon/authenticated** — that
     bypasses the `_api` gate and RLS (`fn-schema-grant-bypass.plan.md`). Grant the pre-claims trio
     to `authenticator` only.
   - **RLS checklist**: every table (incl. shadow tables `<module>_tenant`/`<module>_resident`) gets
     `enable row level security`; "policies created but RLS not enabled = inert" failure signature
     (the `msg_tenant` bug, `rls-gaps-msg-loc-app.plan.md`); don't `grant all to anon` on a table
     unless a genuine public read path exists.
   - **`grant all to anon` is only safe where RLS is actually enabled** — restate R9 as a
     verification step (`select relname from pg_class where not relrowsecurity`).
4. Keep the accurate parts (three-schema module layout, migration path references — all verified to
   exist). R21: if any of these rules belong in `global-rules.md`/`graphql-api-pattern.md` too,
   update there in the same change and have the skill reference rather than duplicate.

## Verification

- `grep -n 'auth\.\(uid\|jwt\|permissions\|has_permission\|enforce_permission\|tenant_id\)' .claude/skills/fnb-db-designer/SKILL.md` → empty (all migrated to `jwt.*`).
- Every `jwt.*` function the skill names exists in `00000000010150_jwt.sql`.
- The new hardening rules are present and cross-linked to specs where applicable.
