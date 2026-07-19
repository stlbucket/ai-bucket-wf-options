# Recurring: skill drift reconciliation

> **Execution Directive:** This is a recurring playbook — run *this* plan periodically; it never
> "finishes" and is never prioritized or closed. A run may spawn new numbered `identified/` items.
> Implement fixes via the `fnb-stack-spec` skill (skill governance). R21: propagate any stack-truth
> change to the specs + both stack skills in the same change. Doc-only. Never run `git`.

**Category: skills · Recurring (no rank, no severity)**

## When to run

Periodically, and after any change to schema names, file paths, package layout, or the data stack —
re-verify every `.claude/skills/*/SKILL.md` against the live code. This is the sweep behind
`0080__skills__new-db-package-template`, `0090__skills__fnb-db-designer-jwt-schema`,
`0100__skills__sqitch-expert-corrections`, `0240__skills__fnb-stack-implementor-enrich`,
`0250__skills__legacy-ui-converter-nav-fix`, and `0270__skills__fnb-create-app-filename`.

## Scope / checklist

1. **Schema/helper names** — every `jwt.*` / `<module>_api` / `<module>_fn` reference in a skill
   exists in the code (the classic bug: docs saying `auth.has_permission` when it's `jwt.*`).
2. **File paths** — every path a skill cites resolves (`grep`/`ls`); flag phantom APIs (e.g. a
   `nav-register.ts` / `useNavRegistry()` that exists nowhere — nav is DB-driven per R14).
3. **Package/db lists** — the seven-package and db-package lists are complete and current.
4. **Version pins** — Nuxt UI v4 API, `@nuxt/ui ^4.6.1` direct-dependency rule, etc.
5. **SKILL.md casing** — the file is uppercase `SKILL.md` (case-sensitive-FS discoverability).
6. **No inline stack re-description** (R21) — skills reference the pattern files, not restate them.

## Output

For each real drift, create a numbered `identified/[####]__skills__[title-slug]__[SEV]__.plan.md`
item (R23), or fix trivially inline and note it.
