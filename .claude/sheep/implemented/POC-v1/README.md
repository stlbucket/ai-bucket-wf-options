# PoC Planning — Single-File Build

Execution planning for the throwaway JS PoC. This folder holds the *how we
actually build it* work; the design rationale lives in
[`../brainstorming/`](../brainstorming/README.md).

> **To build it:** point me at [`plan.md`](./plan.md) ("run plan.md") — it's the
> runner. It executes one phase at a time from `phase-0-skeleton.md` …
> `phase-7-tuning.md`, each of which is independently invocable ("run phase 3").
> This README holds the decisions + constants those phases consume.

**Supersedes** the multi-file ES-module layout in
[`../brainstorming/poc-plan.md`](../brainstorming/poc-plan.md): we're building a
**single HTML file** instead. The 8-phase build order and the milestone/scoring
acceptance from that doc still stand — only the file structure changes.

---

## The decision: one HTML file, inline `<script>`

**Yes — the whole PoC is one `.html` file with an inline plain `<script>`.**
For a throwaway feel-test that's the right structure:

| | Single file, plain `<script>` (chosen) | Multi-file ES modules |
|---|---|---|
| Run it | **double-click** (`file://`) | needs a static server (`npx serve`) |
| Share it | send one file | zip a folder |
| Build tooling | none | none |
| Sim→Godot boundary | a **section convention** (walled block) | a folder boundary |
| Cost | discipline to keep the sim block DOM-free | more files |

The only tradeoff — losing the physical `sim/` folder — is neutralized by
**keeping the simulation in one clearly-marked, DOM-free section** (see anatomy
below). The port to Godot stays a copy-paste of that block.

### Locked tech decisions
- **Rendering:** Canvas 2D, inline.
- **Script:** one plain `<script>` (NOT `type=module`) → runs from `file://`, no
  server.
- **Tuning UI:** `lil-gui` **UMD** build via CDN
  (`lil-gui.umd.min.js` → `window.lil.GUI`). *Gotcha:* a plain `<script>` can't
  use lil-gui's ESM build (`+esm` / `import`), so pin the **UMD** file. CDN needs
  internet (accepted — see locked decisions).
- **Timestep:** fixed `dt = 1/60` with an accumulator; cap max frame delta at
  ~0.25s (anti spiral-of-death).

---

## Single-file anatomy

Top-to-bottom in the one file. The section comments are load-bearing — they *are*
the module boundary.

```
sheep-poc.html
├── <head>
│   ├── <style>            centered canvas, HUD/panel CSS            [throwaway]
│   └── <script src=CDN>   lil-gui                                   [throwaway]
├── <body>
│   ├── <canvas>           the field
│   ├── <div id=hud>       command buttons + score card             [throwaway]
│   └── <script>  ← ONE plain inline script, in commented sections:
│       ├── §0  PARAMS      the single `params` object (SALVAGE ARTIFACT — ports as data)
│       ├── §1  SIM  ◀── PURE, DOM-FREE, PORTS TO GODOT FlockSim 1:1
│       │        vec2 · neighbors · forces · Dog steering · FlockSim · scoring
│       ├── §2  RENDER      draw field/sheep/dog/cone/overlays/HUD   [throwaway]
│       ├── §3  INPUT       buttons + hotkeys → dog command          [throwaway]
│       └── §4  BOOTSTRAP   fixed-timestep loop, wire gui, kick off  [throwaway]
```

**The one rule that matters:** nothing in **§1** may touch `canvas`, `document`,
`window`, or `params` GUI wiring. It receives `params` as a plain object and
exposes state + `step(dt)`. That's what keeps it a clean lift into Godot's
`FlockSim`.

---

## Build checklist (single-file edits, phase by phase)

Same 8 phases as `poc-plan.md`, re-expressed as concrete edits to the one file.
Each phase leaves the page runnable.

- [ ] **P0 — Skeleton.** `<head>`/`<body>`/`<canvas>`; §4 fixed-timestep loop;
  §2 draw field rect + FPS. Decide lil-gui CDN vs hand-rolled sliders here.
- [ ] **P1 — Sheep move.** §1 vec2 + Sheep state + integrate/damp/clamp; §2 draw
  triangles along heading. → sheep drift in bounds.
- [ ] **P2 — Boids.** §1 neighbors (brute force) + separation/cohesion/alignment;
  §0 add their sliders. → loose grazing group *(Milestone 1)*.
- [ ] **P3 — Dog + flee.** §1 Dog + ambient-cone flee; §2 **draw gaze cone +
  threat radius**, tint sheep by stress; §3 mouse-follow dog for now. → blob
  compacts *(Milestone 2)*.
- [ ] **P4 — Commands.** §1 command→target→steering + derived facing; §3 five
  buttons + hotkeys. → come-by sweeps, walk-on drives *(Milestones 3 & 4)*.
- [ ] **P5 — Gate + crush.** §1 goal pen + gate + `crush = density × forward_pressure`
  + boldness; §2 **visible crush indicator**. → lie-down relieves the gate
  *(Milestone 5 + injury↔lie-down loop)*.
- [ ] **P6 — Scoring spine.** §1 scoring (stress, line deviation, split/straggler);
  §2 post-run four-axis card. → fast vs. calm cards differ *(Milestone 6 +
  scoring test)*.
- [ ] **P7 — Tuning polish.** §2 debug overlays (velocity/neighbors/GCM/target/
  state) + toggles; §3 reseed button; §0 **export `params` to JSON**. → the
  salvage artifact.

Milestone definitions: [`../brainstorming/js-poc.md`](../brainstorming/js-poc.md#milestones--acceptance-for-the-core-is-fun).
Scoring test: [`../brainstorming/failure-and-scoring.md`](../brainstorming/failure-and-scoring.md#poc-test--what-to-prove).
Force math: [`../brainstorming/force-model.md`](../brainstorming/force-model.md).

---

## Definition of done

1. All **six milestones** read clearly on the page.
2. The **three scoring checks** hold (stress spikes on rushed runs; crush→lie-down
   works; fast-vs-calm cards diverge).
3. **Export `params`** as JSON works.

Then: lift **§0 `params`** + **§1 SIM** into the Godot `FlockSim`
([`../brainstorming/godot-prototype.md`](../brainstorming/godot-prototype.md));
discard §2–§4.

---

## Locked decisions (P0)

1. **Tuning UI → lil-gui (UMD build) via CDN.** Faster than hand-rolling; the
   internet dependency is accepted for a dev tuning tool. (If offline ever
   matters, a hand-rolled `<input type=range>` panel is a drop-in swap behind the
   same `params` object — but not now.)
2. **Single file only — no `params.json`.** "Export" copies the current `params`
   as JSON to the clipboard **and** logs it to the console. (Paste-back import is
   a maybe-later, not P0.)
3. **Field scale & counts → locked to the table below.**

### Starting constants (P0) — all slider-backed defaults

Unit of length **L = 12 px** (one sheep body-length). These are *starting
guesses*; the whole point of the PoC is to move the sliders. Derived from the
[force-model tuning table](../brainstorming/force-model.md#tuning-table-starting-guesses--the-pocs-job-is-to-find-the-fun)
(body-lengths × 12).

**Stage**
| Thing | Value |
|---|---|
| Canvas / field | **1120 × 720 px** |
| Fence inset (play rect) | 20 px → play area 1080 × 680 |
| Body-length `L` | 12 px |
| Sheep | 20, triangle 12 × 8 px |
| Dog | 1, triangle 16 × 11 px |
| Layout | herd starts left; **vertical fence at x = 820** with a **gate gap**; **goal pen = region x > 820** (drive them through) |
| Gate width | 30 px (2.5 L), slider 12–60 |

**Speeds (px/s)**
| | Value |
|---|---|
| sheep `v_max` | 90 |
| dog `v_max` | 135 (1.5×) |
| graze speed | 15 |

**Boid / flee radii (px) & weights**
| Param | Start | | Param | Start |
|---|---|---|---|---|
| `r_sep` | 18 (1.5 L) | | `w_sep` | 1.5 |
| min-separation clamp | 4 px | | `w_coh` | 1.0 |
| cohesion `n` (topological) | 10 | | `w_align` | 0.2 |
| `r_align` | 36 (3 L) | | `w_flee` | 2.0 |
| `R_flee` | 120 (10 L) | | `w_graze` | 0.3 |
| `ambient` | 0.2 | | `w_fence` | 1.5 |
| cone `k` | 2 | | `damping` | 0.9 |

**Dog steering / gate**
| Param | Start |
|---|---|
| `R_orbit` (come-by/away standoff) | 160 px |
| `ω` (orbit angular speed) | 1.2 rad/s |
| `R_drive` (walk-on standoff behind blob) | 140 px, shrink 10 px/s while active |
| `lieDownIntensity` | 0.3 |
| `crush_threshold` | **calibrate at P5** (density × forward_pressure; no good a-priori number) |

**Boldness & sim**
| Param | Start |
|---|---|
| `boldness` per sheep | `clamp(N(0.3, 0.1), 0, 1)` |
| `dt` | 1/60 s (fixed) |
| `maxFrameDelta` | 0.25 s |

> Note the two numbers that can only be found by *feel*, not derivation:
> `crush_threshold` (calibrate at P5 against the visible crush indicator) and the
> `ambient`↔cone sweet spot (dial at P3–P4). Everything else has a principled
> starting value above.
