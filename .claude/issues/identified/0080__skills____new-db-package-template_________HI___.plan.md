# Plan: new-db-package skill — nonexistent deploy step + template teaches insecure defaults (RLS off, grant-all-anon)

> **Execution Directive:** Implement via the `fnb-stack-spec` + `fnb-db-designer` skills.
> Invoke: `/fnb-stack-spec .claude/issues/identified/skill-new-db-package-template.plan.md`
> Doc-only (skill + template). Never run `git`; commits are human-only.

**Severity: HIGH** (the template propagates the S-class RLS bugs) · Workstream: WS1 · Identified: 2026-07-05

## Details

`.claude/skills/new-db-package/SKILL.md` (68 lines):

1. **Step 4 says** *"Append a new `docker run` block to `scripts/db-deploy.sh`"* — that file doesn't
   exist. Registration is actually `db/db-config.ts` `dbPackages[]` + `docker-compose.yml`.
2. Scaffold prefix `00000000010000_<slug>` doesn't match how its own exemplar output (`db/my-app`)
   is numbered (`00000000020010`).

More seriously, the template this skill produces (`db/my-app`, the exemplar) teaches the exact
insecure patterns the WS2 audit flagged:

- `db/my-app/deploy/00000000020010_my_app.sql:3` opens with
  `drop schema if exists my_app cascade;` — destructive drop-and-recreate no real package uses.
- `db/my-app/deploy/00000000020040_my_app_policies.sql` **grants all to anon** and has
  `-- alter table my_app.band enable row level security` **commented out** (referencing a table
  `band` that doesn't even exist). i.e. the template ships RLS-off + grant-all-anon — precisely
  `wf-rls-missing.plan.md` / `rls-gaps-msg-loc-app.plan.md` in seed form.

## Implication

Every new DB module scaffolded from this skill starts from an insecure template: RLS commented out,
blanket anon grants, a destructive drop. New modules will reproduce the cross-tenant-exposure class
of bug by default. A scaffolding skill that emits vulnerable boilerplate is a bug factory.

## Suggested fix (fix + enrich)

1. **Fix the deployment step:** register via `db/db-config.ts` `dbPackages[]` (with `schemas` and
   `deployOnBuild`) — not `db-deploy.sh`. Cross-reference `skill-sqitch-expert-corrections.plan.md`.
2. **Fix the numbering guidance** to match the real convention (align the prefix example with how
   modules are actually numbered).
3. **Rewrite the emitted template to be secure-by-default:**
   - No `drop schema cascade` in deploy (revert handles teardown).
   - Every table: `enable row level security` **uncommented**, with at least a tenant-scoped policy
     using `jwt.has_permission('p:...', tenant_id)`.
   - Grants scoped to `authenticated` (RLS filters), not blanket `to anon`.
   - No `grant execute on all routines in schema <module>_fn to anon/authenticated`
     (`fn-schema-grant-bypass.plan.md`).
   - SECURITY DEFINER functions with `SET search_path = ''` (`security-definer-search-path.plan.md`).
   - Include the shadow-table scaffold (`<module>_tenant`/`<module>_resident` + `ensure_*_resident`).
   - Reference the storage module (`db/fnb-storage/`) as the canonical secure exemplar.
4. Decide with the user whether to **regenerate `db/my-app` as a correct template** or delete it
   (`dead-code-sweep.plan.md`). If kept as the living exemplar, it must be the secure version.

## Verification

- No `db-deploy.sh` reference remains in the skill.
- A freshly scaffolded package has RLS enabled on every table and no anon table grants
  (spot-check by scaffolding into a throwaway dir, read-only).
- The emitted template deploys clean and passes an RLS presence check.
