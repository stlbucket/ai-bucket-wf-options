# Plan: Spec files still describe the pre-fnb-types world (barrel export, ProfileClaims location, UC2)

> **Execution Directive:** Implement via the `fnb-stack-spec` skill (spec governance).
> Invoke: `/fnb-stack-spec .claude/issues/identified/specs-fnb-types-drift.plan.md`
> Doc-only. R21: these are the canonical pattern files — fix once here, and any skill that references
> them inherits the fix. Never run `git`; commits are human-only.

**Severity: MEDIUM** · Workstream: WS1 · Identified: 2026-07-05

## Details

The `fnb-types` migration (the shared type vocabulary, global-rules R3) left contradictions between
the newer rules and the older pattern files:

1. **`.claude/specs/graphql-api-pattern.md`** (Layer 3 barrel section, ~line 136) says the barrel
   does `export * from './generated/fnb-graphql-api'` plus per-composable exports. This contradicts
   R3, `package-layers-pattern.md`, and the actual code
   (`packages/graphql-client-api/src/index.ts` explicitly does **NOT** `export *` the generated
   module — it re-exports only composables + two named hooks). Leaking generated types to the UI is
   exactly what R3 forbids.
2. **Same file** (Auth Context, ~line 179) says `ProfileClaims` lives at
   `packages/db-access/src/types/profile-claims.ts`. Reality:
   `packages/fnb-types/src/profile-claims.ts` (db-access has no `src/types/` dir; it imports the
   type from `@function-bucket/fnb-types`). The implementor skill's Security Model section says the
   same wrong-ish thing in places — reconcile with `skill-fnb-stack-implementor-enrich.plan.md`.
3. **`.claude/specs/ui-components-rules.md` UC2** tells the UI to import types from
   `@function-bucket/fnb-graphql-client-api` or `@function-bucket/fnb-db-access` (naming
   `ProfileClaims`, `MessageWithSender`). Post-R3 the UI imports entity types **only** from
   `@function-bucket/fnb-types`. UC2 predates the leaf package.
4. **`global-rules.md` R9** ("All tables have RLS enabled") is stated as enforced but is
   aspirational (WS2 audit: wf, msg_tenant, loc shadows, app.module/tool/app_settings violate it).
5. **db-access doc comments** (`current-profile-claims.ts` / `profile-claims-for-user.ts`) disagree
   with the actual middleware call site about which function bootstraps request claims
   (`get-event-claims-hardening.plan.md`, F3).

## Implication

The canonical pattern files (which every skill references per R21) teach the retired barrel/type
layout. A developer trusting `graphql-api-pattern.md` would re-introduce the generated-type leak and
look for ProfileClaims in the wrong package. UC2 would have them import from the wrong package. R9
overstates enforcement, masking the real RLS gaps.

## Suggested fix (fix + enrich)

1. **graphql-api-pattern.md barrel section:** correct to "the barrel does NOT `export *` the
   generated module; it re-exports composables + only the named urql hooks the UI needs
   (`useDiscussionByIdQuery`, `useUpsertMessageMutation`)" — matching R3/package-layers/code.
2. **graphql-api-pattern.md Auth Context:** ProfileClaims lives at
   `packages/fnb-types/src/profile-claims.ts`; db-access imports it from `@function-bucket/fnb-types`.
   Update the path and remove the `db-access/src/types/` reference.
3. **ui-components-rules.md UC2:** UI imports entity/view types from `@function-bucket/fnb-types`
   (generated types are internal to graphql-client-api, reached via mappers). Composable **view**
   types still come from graphql-client-api (R4) — distinguish the two.
4. **global-rules.md R9:** annotate with current enforcement reality (or keep the rule and add a
   "Known Gaps" note that several tables currently violate it, cross-linking the WS2 issues) so the
   rule reads as the target with an honest status.
5. **db-access doc comments:** align with whichever claims function the middleware standardizes on
   (decided in `get-event-claims-hardening.plan.md`).
6. R21: after fixing here, sweep the two skills for any inline restatement of these points and make
   them reference the specs instead (coordinate with the implementor-skill plan).

## Verification

- `grep -n "export \* from './generated" .claude/specs/graphql-api-pattern.md` → empty.
- `grep -rn "db-access/src/types/profile-claims\|fnb-graphql-client-api.*ProfileClaims" .claude/specs/` → empty.
- UC2 references `fnb-types`; R9 carries an accurate status note.
- Pattern files agree with `packages/graphql-client-api/src/index.ts` and
  `packages/fnb-types/src/profile-claims.ts` as they actually are.
