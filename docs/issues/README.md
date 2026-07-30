# Issue / Plan Lifecycle (R23)

Durable work items live here as `.plan.md` files. This file is the full lifecycle + naming
convention; `docs/specs/global-rules.md` R23 is the summary that points at it.

## Lifecycle — four directories

- `identified/` — found, not yet started (new finds land here)
- `in-flight/` — actively in planning / spec-update / implementation
- `addressed/` — fully done; never reused. Move here **only with user sign-off** (the completion
  hand-off question — memory `feedback_ask_before_moving_addressed`); never auto-file.
- `recurring/` — periodic playbooks that never "finish" (dead-code sweep, spec reconciliation,
  skill tune-up, RLS/permission audit); `executions/` holds their run records

An item advances by **moving between directories**; status is never encoded in the filename.

## Filenames

`__` (double-underscore) between fields; **fixed-width, right-padded with `_`** so every filename
is the same length up to `.plan.md` and columns line up in a plain `ls`. Kebab-case (`-`) within
a field, so a slug's own hyphens stay visually distinct from the `_` padding.

- one-shot: `[####]__[category]__[title-slug]__[SEV]__.plan.md` — field widths **4 / 8 / 30 / 3**
  (rank / category / slug / severity)
- recurring: `[####]_recur__[title-slug].plan.md` — the `####` prefix (width 4, gapped by 10,
  starting `0010_`) is the **execution order** for a housekeeping pass, not a priority rank; no
  severity — recurring playbooks are never closed

Field semantics:

- `####` — **priority rank** (lower = higher priority), width 4, gapped by 10 so items can be
  inserted between ranks. Reassignable, so **not** a stable identifier — the `title-slug` is.
- `category` — width 8 (the longest enum member), from the closed enum:
  `auth · app · msg · wf · loc · storage · db · graphql · security · infra · testing · skills ·
  specs · docs`
- `title-slug` — width 30; stable across moves and renumbering
- `SEV` — width 3, from the closed set `CRT · HI · MED · LOW`; the item's severity, scannable
  without opening the file. No compound values (no `LOW-MED`) — pick the nearer bucket.

Example (padding shown): `0010__auth______session-cookie-signing__________CRT__.plan.md`

## Execution Directive

Each plan file leads with a **self-referential Execution Directive** — it names *this* file
(`<this-file>` / "this plan"), never a hardcoded `identified/…` path, so the invocation never
goes stale when the file moves between directories or is renumbered. A `recurring/` run may
spawn new numbered `identified/` items when it finds work.

## History note

Plans in `addressed/` from before 2026-07-30 reference the old locations (`.claude/specs/`,
`.claude/issues/`, `.claude/skills/`) — they are historical records and were deliberately left
unedited when the trees moved to `docs/` and `.agents/`.
