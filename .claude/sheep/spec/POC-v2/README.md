# POC-v2 — Spec Index

Feature specs for the second iteration of the sheep PoC. A version may bundle
multiple features; add more by running `/sheep spec POC-v2 <notes>` again.

Pipeline: **spec → plan → implement**. When these specs are agreed, run
`/sheep plan POC-v2` to turn them into a phased build plan.

## Features

| Feature | Spec | Status |
|---|---|---|
| Settings Inspector — self-describing tunables: one schema drives `params` + lil-gui, hover tooltips, per-category ⓘ grid | [settings-inspector.md](./settings-inspector.md) | **draft — review Appendix A inventory** |
| Flock Behavior — semantic rules for how the flock behaves; starts with the calm/scattered idle state (50 sheep, no convergence, loose 2–5 groups) | [flock-behavior.md](./flock-behavior.md) | **draft — living rules list, owner adding more** |

## Locked decisions (this version)

- Schema is the **single source of truth**: `params` defaults + lil-gui
  folders/ranges are generated from it.
- Document **all ~64 params** (incl. currently hidden ones) via an `exposed` flag.
- Per-category detail popup triggered by an **ⓘ button per lil-gui folder**.

## Still open

- Review the **settings inventory** (Appendix A of settings-inspector.md) —
  correct any wrong descriptions / units / proposed ranges before planning.
- Whether to promote any currently-hidden params to real sliders (default: no).
- Read-only grid vs editable current-value cells (default: read-only for v2).
