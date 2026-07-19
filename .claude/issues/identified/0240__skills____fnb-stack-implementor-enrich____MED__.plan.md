# Plan: fnb-stack-implementor skill — remove nonexistent nav API, fix UC13/package-count drift, add audit failure signatures

> **Execution Directive:** Implement via the `fnb-stack-spec` skill (skill governance, fix + enrich).
> Invoke: `/fnb-stack-spec .claude/issues/identified/skill-fnb-stack-implementor-enrich.plan.md`
> Doc-only. R21: propagate any stack-truth changes to specs + fnb-stack-spec in the same change.
> Never run `git`; commits are human-only.

**Severity: MEDIUM** (largest project skill; drift compounds) · Workstream: WS1 · Identified: 2026-07-05

## Details

`.claude/skills/fnb-stack-implementor/SKILL.md` (597 lines — largest project skill). It's largely
current (localStorage claims, 2-arg withClaims, GraphQL-default all correct), but has several drifts:

1. **Nonexistent nav API.** Checklist step 5 and the key-file table instruct
   `plugins/nav-register.ts` → `useNavRegistry().register([...])`. **Neither exists anywhere in
   `packages/` or `apps/`** (grep confirms zero hits). The real nav is DB-driven:
   `app_fn.install_basic_application` seeds modules/tools → `ProfileClaims.modules` (fetched at auth)
   → `packages/tenant-layer/app/composables/useAppNav.ts` + `AppNav.vue`/`ModuleNavSection.vue`.
   This is exactly what global-rules R14 says ("Navigation is registered in the DB, not hardcoded").
   The skill contradicts its own rule set.
2. **UC13 collision.** The skill defines "UC13 — UTable uses Nuxt UI v4 API" inline, but
   `.claude/specs/ui-components-rules.md` reserves UC13 for form validation ("will be formalized as
   UC13 once adopted") and the skill elsewhere cites "UC1–UC12". Duplicated UI rule inline (R21
   violation — skills should reference ui-components-rules, not restate/extend it).
3. **Package count.** Skill's monorepo layout says "seven packages" and omits `auth-server`;
   `package-layers-pattern.md` says eight and includes it.
4. **Iconify rule** ("each Nuxt app must declare `@iconify-json/*` directly") is contradicted by
   3/5 apps not declaring it — see `iconify-rule-verification.plan.md` (resolve there first, then
   align this skill).
5. Missing failure signatures the audit surfaced (the skill is otherwise rich in these, so they'd
   fit its style).

## Implication

Following step 5 leads someone to build a nav-registration mechanism that doesn't exist instead of
the DB-driven flow. The UC13 collision means two different rules share a number. Package-count drift
is minor but erodes trust. The skill is the primary implementor reference — its drift multiplies.

## Suggested fix (fix + enrich)

1. **Replace the nav-register instructions** with the real DB-driven nav flow:
   `app_fn.install_basic_application(...)` seeds modules/tools ([b4]/[b5]) → claims → `useAppNav`.
   Remove `useNavRegistry`/`nav-register.ts` from step 5 and the key-file table. Cross-reference R14.
2. **Resolve UC13:** move the UTable-v4 guidance into `ui-components-rules.md` as its own properly
   numbered UC rule (it's genuinely useful — it just shouldn't be invented inline in the skill).
   Have the skill **reference** it. Fix the "UC1–UC12" range accordingly.
3. **"Eight packages"** + add `auth-server` to the monorepo layout block.
4. **Enrich with new failure signatures** from this audit (match the existing
   "does not provide an export named X" style):
   - *Policies created but RLS never enabled = inert policies + grant-all-anon exposure* (the
     `msg_tenant` copy-paste bug) — verify with `select relname from pg_class where not relrowsecurity`.
   - *GraphQL WS subscriptions resolve as anon* (synthetic H3Event skips middleware) — attach claims
     in grafast context (`ws-subscriptions-anon.plan.md`).
   - *Absolute client paths (`/_ws`, `/api/...`) bypass `NUXT_APP_BASE_URL` and miss the nginx
     prefix block* (`msg-realtime-nginx-routing.plan.md`).
   - *Blanket `grant execute … schema <module>_fn` bypasses the `_api` gate* (`fn-schema-grant-bypass.plan.md`).
5. **Add a mapper-coverage rule** to the graphql-client-api section: every composable returns
   `fnb-types` shapes via a `src/mappers/<entity>.ts`; **no inline shaping, no exporting generated
   types through the barrel** (the `TopicStatus` leak — `graphql-client-api-consistency.plan.md`).
6. Reconcile the ProfileClaims-location + barrel wording with `specs-fnb-types-drift.plan.md` so
   skill and specs agree.

## Verification

- `grep -n 'useNavRegistry\|nav-register' .claude/skills/fnb-stack-implementor/SKILL.md` → empty.
- No inline "UC13" definition remains; the range citation is consistent with ui-components-rules.
- "eight packages" + auth-server present in the layout.
- New failure signatures + mapper rule present.
- Cross-referenced specs updated in the same change (R21).
