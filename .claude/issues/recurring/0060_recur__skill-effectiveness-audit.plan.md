# Recurring: skill effectiveness audit

> **Execution Directive:** This is a recurring playbook — run *this* plan periodically; it never
> "finishes" and is never prioritized or closed. A run may spawn new numbered `identified/` items.
> Implement fixes via the `fnb-stack-spec` skill (skill governance). R21: propagate any stack-truth
> change to the specs + both stack skills in the same change. Doc-only. Never run `git`.

**Category: skills · Recurring (no rank, no severity)**

## Relationship to 0050 (skill-drift reconciliation)

`0050` asks **"is it correct?"** — do the facts in each skill (schema names, paths, package
lists, version pins) still match the live code. This plan asks **"is it well-designed?"** —
would an agent following each skill route correctly, read the right amount, and act without
ambiguity. Run `0050` **before** this plan (filename order already encodes that): auditing the
design of factually-stale skills wastes the pass.

## When to run

Periodically (each housekeeping pass, after `0050`), and after any of: a new skill is added, an
orchestrator's procedure changes, a skill is retired/tombstoned, or a run of `0050` made
substantial content changes to a skill.

## Scope / checklist

Audit every `.claude/skills/*/SKILL.md` plus `.claude/skills/skill-map.md`:

1. **Trigger clarity** — each skill's frontmatter `description` states *when to invoke it* with
   concrete trigger phrases, not just what it knows. No two skills claim the same trigger; any
   deliberate overlap states which one wins (e.g. `graphile-worker-expert` explicitly routing
   its old triggers to `n8n-cli`).
2. **Routing integrity** — `skill-map.md` is the single registration point (R21): every skill
   directory appears in it, every map entry resolves to a real skill, and every inline
   `→ skill <name>` pointer in the two orchestrators names a skill that exists.
3. **Orchestrator altitude** — `fnb-stack-spec` / `fnb-stack-implementor` hold *sequence,
   checklists, failure signatures, and gotchas* only; the *how* of each layer lives in the
   specialist skill or pattern file they point at. Flag any inline restatement of stack content
   that a pattern file already owns (R21) — that is drift waiting to happen.
4. **Right-sized bodies** — the SKILL.md body carries what an agent needs on every invocation;
   bulk reference material belongs in the skill's `references/` files, named from a decision
   guide in the body. Flag bodies that have grown past the point of reliable attention, and
   reference files the body never points at (dead weight).
5. **Actionability** — procedures are executable as written: steps ordered, gates explicit
   (`pnpm build`, dep-audit, codegen), failure signatures current, templates copy-pasteable.
   Flag advice-shaped content ("be careful with X") that names no check and no action.
6. **Overlap / gap analysis** — no two skills give conflicting guidance on the same ground; no
   recurring task in the repo lacks an owning skill or map route. Check gaps against what the
   issue history keeps re-litigating.
7. **Retirement hygiene** — retired skills (e.g. `graphile-worker-expert`) are clearly marked
   LEGACY at the top, state *why* and *when*, and route their old triggers to the replacement.
   Fully dead skills with no historical value should be flagged for removal, not left ambient.

**Method note:** this audit judges design, not facts — fresh eyes help. Running the read-only
audit pass in a subagent (optionally on a different model) and reconciling its findings here is
a valid and encouraged way to execute a run; fixes still land through `fnb-stack-spec`.

## Output

For each real design defect, create a numbered
`identified/[####]__skills____[title-slug]________[SEV]__.plan.md` item (R23), or fix trivially
inline and note it. Effectiveness findings are usually MED/LOW — reserve HI for defects that
actively misroute an agent (wrong-winner trigger overlap, a map entry pointing at a retired
skill).
