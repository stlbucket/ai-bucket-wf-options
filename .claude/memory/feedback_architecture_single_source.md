---
name: feedback_architecture_single_source
description: The fnb stack architecture is single-sourced in the pattern files; any architecture change must update specs + both skills in the same change (global-rules R21).
metadata:
  type: feedback
---

The fnb data-stack architecture is described in exactly three places, and they must never drift:
`.claude/specs/global-rules.md`, the affected pattern file
(`graphql-api-pattern.md` / `package-layers-pattern.md` / `sockets-pattern.md` /
`monorepo-bootstrap-pattern.md`), and the two skills (`fnb-stack-spec`, `fnb-stack-implementor`).
The skills **reference** the pattern files — they must not re-describe `withClaims`, the layer
stack, or package internals inline.

**Why:** The last big migration (Kysely/`db-types`/Nitro-REST → PostGraphile 5 + urql +
raw-`pg` `db-access`) was recorded only in `.claude/issues/` and never propagated to the specs or
skills, which then described an abandoned stack in three independently-drifting places. Root cause
was a DRY violation.

**How to apply:** Any change to how the stack works must update `global-rules.md` + the affected
pattern file + both skills **in the same change** — this is codified as **R21** in
`global-rules.md`. When reverse-engineering or updating a spec, the current CODE wins over stale
spec text. Default data path = urql GraphQL → PostGraphile; `withClaims(claims, fn)` is 2-arg and
only a carve-out; the pre-claims trio stays raw pg in `db-access`; `*.ui.md` files are never
touched by a data-layer change. See [[feedback_architecture_docs]] (all docs under
`.claude/specs/`) and [[project_spec_system]].
