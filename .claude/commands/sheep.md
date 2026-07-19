---
description: Sheepdog-game workflow — spec, plan, or implement a version (POC-v1 done; POC-v2 next)
argument-hint: "spec|plan|implement|status [version] [notes]"
---

You are driving the **sheepdog herding game** side-project. Everything you need is
on disk under `.claude/sheep/` — do not rely on prior conversation context. This
is a fnb side-project: **never wire it into fnb's DB/GraphQL/backend.**

## On-disk layout

```
.claude/sheep/
├── brainstorming/            design rationale (concept, force-model, threat-model, scoring…) — read-only source of "why"
├── spec/<version>/           WHAT to build for a version — one or more feature spec docs + a README index   [spec mode writes here]
├── plan/<version>/           HOW to build it — POC-v1-style: plan.md runner + README + phase-N-*.md          [plan mode writes here]
├── implemented/<version>/    the plan after it's been built (moved here at the end)                          [implement mode moves here]
└── poc/sheep-poc.html        the single-file build artifact (created in POC-v1; later versions edit it)
```

The pipeline is **spec → plan → implement**, per version. `implemented/POC-v1/`
is the completed first version (its plan + phase files live there, all ticked).
The **next version is `POC-v2`**; keep the `POC-vN` naming.

## Resolve the version first

Parse `$ARGUMENTS` as: `<mode> [version] [free-text notes]`. `<mode>` is one of
`spec`, `plan`, `implement`, `status`. If a `POC-vN` token is present, that is the
**explicit** version — use it. Otherwise **default to the active version**:

- Let `impl_max` = highest `POC-vN` in `implemented/`.
- **spec / plan** → active = the highest `POC-vN` that exists in `spec/` or `plan/`
  but is **not** yet in `implemented/`; if none, use `POC-v(impl_max+1)`.
- **implement** → active = the highest `POC-vN` present in `plan/` but not in
  `implemented/` (the version that's planned and ready to build).

State which version you resolved and why before doing anything. If the resolved
version's inputs are missing (e.g. `plan` with no spec, `implement` with no plan),
say so and stop.

## Modes — act on `<mode>`

### `spec` — author feature specs (conversational)
Specs are a **conversation**, not a one-shot dump. A version may bundle **multiple
features**, each its own spec doc.
1. Ground yourself in `brainstorming/` (esp. the parked design questions in
   `brainstorming/README.md`) and any existing `spec/<version>/` docs.
2. **Discuss** the feature(s) with the user from the notes in `$ARGUMENTS` —
   propose scope, surface open questions, get alignment. Do **not** write spec
   files until the shape is agreed.
3. Then write each feature as `spec/<version>/<feature-slug>.md` and maintain
   `spec/<version>/README.md` as the index (feature list + one-line status each).
   Keep §1-SIM-vs-render and "no fnb backend" constraints explicit where relevant.
4. Report what was written and what's still open. Adding another feature later =
   just run `spec` again for the same version.

### `plan` — turn a version's specs into a phased build plan
Precondition: `spec/<version>/` exists.
1. Read every spec doc under `spec/<version>/`.
2. Produce `plan/<version>/` in the **POC-v1 convention**: a `plan.md` **runner**
   (global invariants, section/file map, a phase table, and a **progress
   tracker** of `- [ ]` phases), a `README.md` (locked decisions + any constants
   table the phases consume), and one `phase-N-*.md` per phase — each
   independently runnable with Tasks + Verify steps.
3. Do not implement anything. Report the phase breakdown and stop.

### `implement` — build the plan, one phase at a time
Precondition: `plan/<version>/plan.md` exists.
1. Read `plan/<version>/plan.md`, its `README.md`, and the target phase file.
2. With **no phase arg / empty notes** → run the **next incomplete phase** from
   the progress tracker: implement its Tasks in `poc/sheep-poc.html`, run its
   Verify steps, tick it in the tracker, then **STOP and report**. Wait for
   go-ahead before the next phase.
   - a **number** (e.g. `implement POC-v2 3`) → run that specific phase; if its
     prerequisites aren't ticked, say so and ask first.
   - **`all`** → run phases in order without pausing, but still report at each
     acceptance gate; **halt immediately** if any Verify step fails.
3. When **every phase is ticked**: **ask the user before moving** the plan. On
   their go-ahead, move `plan/<version>/` → `implemented/<version>/` (mirrors how
   `implemented/POC-v1/` holds its finished plan). Never move without asking.

### `status` — report, do not build
Scan `spec/`, `plan/`, `implemented/`. For each version report its stage (spec /
planned / implementing / done) and, for the active version, the plan's progress
tracker: which phases are done and what's next.

## Global invariants (every version that edits the PoC artifact)

- **One HTML file, one plain `<script>`** (not `type=module`) → runs from
  `file://` by double-click. lil-gui is the **UMD** build via CDN
  (`window.lil.GUI`).
- **§1 SIM stays DOM-free** — no `canvas`/`document`/`window`/lil-gui in the sim
  block; it takes `params` as data and exposes state + `step(dt)`. This is the
  block that ports to Godot; protect it.
- **All tunables live in §0 `params`**, bound to lil-gui as introduced — no magic
  numbers in the sim.
- **Every phase leaves the page runnable** — open it, see something, no console
  errors.
- **This is a fnb side-project — never wire it into fnb's DB/GraphQL/backend.**
