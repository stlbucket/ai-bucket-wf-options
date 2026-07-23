# Execution log — 0050_recur__skill-drift-reconciliation — 2026-07-22

Doc-only leg (skill governance). Two drift classes this run: the 11→12 db-package landing
(`fnb-notify`) and a systemic **retired-agent-engine** drift the `agentic-decommission` left in the
skills (R21/R22 propagation gap).

## Fixed inline (trivial reference-list / count corrections)

1. **`fnb-db-designer/SKILL.md`** (§Packages) — the db-package list was doubly stale: it named a
   phantom **`fnb-agent`** (retired — no `db/fnb-agent`, commit `a13d3cc "no fnb-agent"`) and omitted
   both `fnb-game` and `fnb-notify`. Rewrote to the true 12-package `.env` order
   (`fnb-auth fnb-app fnb-n8n fnb-notify fnb-res fnb-msg fnb-todo fnb-loc fnb-storage
   fnb-location-datasets fnb-airports fnb-game`), "Eleven → Twelve", `agent_worker`/`agent_fn`
   ordering note → `n8n_worker`, `fnb-game` last.
2. **`function-bucket-legacy-ui-converter/SKILL.md`** (L185–186) — same stale list (phantom
   `fnb-agent`, missing `fnb-game`/`fnb-notify`); corrected to the 12-package list, "eleven → twelve".
3. **`fnb-stack-implementor/SKILL.md`** (L44, L660) + **`fnb-stack-spec/SKILL.md`** (L28, L81) —
   "the/all **seven** packages" describing `package-layers-pattern.md` → "**ten** packages" (the
   pattern file itself says ten shared packages + game-engines as the eleventh; "seven" was stale).

## Checklist results

- **Schema/helper names** — the `jwt.*` helpers cited by skills all exist (incl. `jwt.profile_id()`,
  used by the new notify RLS). The new `notify_fn`/`notify_api` functions are not cited by any skill,
  so no new drift there.
- **File paths** — the standing key paths resolve; the broken ones are the retired `apps/agent-app/…`
  paths → captured in the spawned 0380 (below).
- **Package/db lists** — corrected as above; `.env`-deferring skills (`sqitch-expert`,
  `new-db-package`, `fnb`, `fnb-stack-implementor` L290) are robust by design and needed no count fix
  (though `new-db-package` L89 + `sqitch-expert` L28–29 still name `fnb-agent` in prose → 0380).
- **Version pins** — `@nuxt/ui ^4.6.1` citations still match the catalog. No drift.
- **SKILL.md casing** — all uppercase; no `skill.md` case-drift.
- **R21 inline re-description** — the fixed items are reference lists, not stack re-descriptions.

## Spawned identified/ items

- **`0380__skills____agent-engine-r22-drift__________MED__`** — systemic R22 propagation gap: ~6
  skills still describe `apps/agent-app` / `fnb-agent` / `agent_worker` / the `claude-agent-sdk`
  skill as the live workflow engine, contradicting global-rules R22 ("n8n is the sole workflow
  engine") and the deleted app/package. Worst offender is `fnb-stack-implementor` (L102 "primary
  workflow engine … R22 dual engines", L113 db-list, L598 dead `apps/agent-app/server/lib/*` paths);
  also `fnb-stack-spec` (L46, L205), `fnb` (L47), `new-db-package` (L89), `sqitch-expert` (L28–29),
  `fnb-acquire-dataset`. MED — the prose would send a stack-implementor run to build against a
  nonexistent engine. Narrative rewrite of ~6 skills → spawned rather than rushed inline. The
  self-labeled-legacy `graphile-worker-expert` is intentionally left as historical reference.

## Gate

Doc-only edits (SKILL.md markdown + one new `identified/*.md`); `pnpm build` unaffected — the final
run-wide build was green (see the run summary / 0020 leg).
