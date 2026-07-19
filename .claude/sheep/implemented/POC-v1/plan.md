# PoC Build — Master Plan & Runner

Single-file JS/Canvas proof of concept for the sheepdog herding game. This file
is the **runner**: point me at it and I execute the phases in order. Design
rationale lives in [`../brainstorming/`](../brainstorming/README.md); locked
constants and the single-file anatomy live in [`README.md`](./README.md).

---

## ▶ Invocation — how to run this plan

**Trigger:** "run plan.md", "run the plan", "build the PoC", or pointing me at
this file.

**Do this:**
1. Determine the **next incomplete phase** from the Progress tracker below
   (top-to-bottom; first unchecked phase).
2. Open that phase's file (`phase-N-*.md`) and follow **its** invocation directive
   exactly — implement its tasks in the target file, run its Verify steps.
3. When its acceptance passes: tick that phase in the Progress tracker here,
   **STOP, and report** what was built + how to eyeball it. **Wait for my
   go-ahead before the next phase.**
4. If I say **"run all phases"**, repeat 1–3 without pausing, but still report at
   each phase's acceptance gate; halt immediately if a Verify step fails.

**Do NOT:** implement more than one phase per go (unless "run all"), skip a
phase, or violate the Global Invariants below.

**Target file:** `.claude/sheep/poc/sheep-poc.html` (one file; created in P0).

---

## Global invariants (apply to every phase)

- **One file, one plain `<script>`** (not `type=module`) → runs from `file://` by
  double-click. lil-gui is the **UMD** build via CDN (`window.lil.GUI`).
- **§1 SIM stays DOM-free.** No `canvas`/`document`/`window`/lil-gui references in
  the sim block — it takes `params` as data, exposes state + `step(dt)`. This is
  the block that ports to Godot; protect it.
- **All tunables live in §0 `params`** and are bound to lil-gui as they're
  introduced. No magic numbers scattered in the sim.
- **Every phase leaves the page runnable** — open it, see something, no console
  errors.
- **Constants** come from [`README.md` → Starting constants (P0)](./README.md#starting-constants-p0--all-slider-backed-defaults).
  They're slider defaults, not law.
- **Fixed timestep** `dt = 1/60` with an accumulator; cap frame delta at 0.25 s.

## File anatomy (section map — every phase edits by §)

```
§0 PARAMS      the params object (+ lil-gui bindings)     [tunable data]
§1 SIM   ◀──   vec2 · neighbors · forces · dog · FlockSim · scoring   [PURE — ports to Godot]
§2 RENDER      draw field/sheep/dog/cone/overlays/HUD     [throwaway]
§3 INPUT       buttons + hotkeys → command                [throwaway]
§4 BOOTSTRAP   fixed-timestep loop, wire gui, kick off    [throwaway]
```

---

## Phases

| # | File | Goal | Proves |
|---|---|---|---|
| 0 | [phase-0-skeleton.md](./phase-0-skeleton.md) | HTML shell, canvas, fixed-timestep loop, draw field | stable framerate-independent loop |
| 1 | [phase-1-sheep-move.md](./phase-1-sheep-move.md) | sheep state + integration, draw triangles | sheep drift & stay in bounds |
| 2 | [phase-2-boids.md](./phase-2-boids.md) | separation/cohesion/alignment + neighbors | Milestone 1 — grazing group |
| 3 | [phase-3-dog-flee.md](./phase-3-dog-flee.md) | dog + ambient-cone flee, draw the eye | Milestone 2 — compaction |
| 4 | [phase-4-commands.md](./phase-4-commands.md) | command steering + 5 buttons, derived facing | Milestones 3 & 4 — sweep & drive |
| 5 | [phase-5-gate-crush.md](./phase-5-gate-crush.md) | goal pen + gate + crush metric + boldness | Milestone 5 — gate & injury loop |
| 6 | [phase-6-scoring.md](./phase-6-scoring.md) | stress/line/cohesion axes + post-run card | Milestone 6 — split & scoring |
| 7 | [phase-7-tuning.md](./phase-7-tuning.md) | debug overlays + export params to JSON | the salvage artifact |

---

## Progress tracker

- [x] Phase 0 — Skeleton
- [x] Phase 1 — Sheep move
- [x] Phase 2 — Boids
- [x] Phase 3 — Dog + flee
- [x] Phase 4 — Commands
- [x] Phase 5 — Gate + crush
- [x] Phase 6 — Scoring spine
- [x] Phase 7 — Tuning polish

## Definition of done (whole PoC)

1. All six milestones read clearly on the page.
2. The three scoring checks hold (stress spikes on rushed runs; crush→lie-down
   works at the gate; fast-vs-calm cards diverge).
3. Export `params` as JSON works.

Then lift **§0 `params`** + **§1 SIM** into the Godot `FlockSim`
([`../brainstorming/godot-prototype.md`](../brainstorming/godot-prototype.md));
discard §2–§4.
