# Recurring: spec / code reconciliation

> **Execution Directive:** This is a recurring playbook — run *this* plan periodically; it never
> "finishes" and is never prioritized or closed. A run may spawn new numbered `identified/` items.
> Implement fixes via the `fnb-stack-spec` skill (spec governance). R21: the pattern files are the
> canonical source — fix once here and every skill that references them inherits the fix. Doc-only.
> Never run `git`.

**Category: specs · Recurring (no rank, no severity)**

## When to run

Periodically, and after any architecture change — reconcile `.claude/specs/` (pattern files +
`global-rules.md`) against the actual code so the single source of truth stays true. This is the
sweep behind `0230__specs__fnb-types-drift`.

## Scope / checklist (global-rules R18–R21)

1. **Pattern files vs code** — `graphql-api-pattern.md`, `package-layers-pattern.md`,
   `sockets-pattern.md`, `monorepo-bootstrap-pattern.md` describe what the code actually does (e.g.
   the barrel does NOT `export *` the generated module; ProfileClaims live in localStorage; 2-arg
   `withClaims`).
2. **global-rules R1–R23** — each rule still matches reality; no rule contradicts another or the
   pattern files.
3. **Per-page specs** — every page still has `.ui.md` + `.data.md` (R18); shared types/permissions
   live in `_shared.data.md` (R19); no stray `[FILL IN]` in specs marked authoritative (R20).
4. **Single-description invariant (R21)** — the stack is described in exactly three places (global
   rules, the pattern file, the two skills) with no inline duplication drift.

## Output

For each real drift, fix in the canonical pattern file/global-rules (propagating to skills per R21),
or create a numbered `identified/[####]__specs__[title-slug]__[SEV]__.plan.md` item (R23).
