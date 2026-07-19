# JS PoC — Build Plan

The executable plan for the throwaway JS/Canvas proof of concept described in
[`js-poc.md`](./js-poc.md). Goal: **tune the force model and prove the five
commands feel good**, then export a parameter table to seed the Godot build.

This is a *plan*, not the prototype. Nothing here is implemented yet.

> **Superseded (file layout only):** we're building this as a **single HTML
> file**, not the multi-file ES-module folder shown below. The 8-phase build
> order, data shapes, milestones, and definition of done all still hold — only
> the file structure changes. Current execution plan:
> [`../planning/README.md`](../planning/README.md).

**Scope lock:** 1 dog, ~20 sheep, one field, one goal pen + one narrow gate, all
five commands, dots-and-triangles rendering, slider-driven tuning. No art, no
backend, no 3D, no multi-dog.

---

## Strategic file boundary (the whole point)

The `sim/` folder is **engine-agnostic and is what ports to Godot's `FlockSim`
1:1**. Everything else (`render.js`, `input.js`, `index.html`) is **throwaway**.
Keep that boundary clean so the port is a copy, not a rewrite.

```
sheep-poc/
├── index.html            # canvas + lil-gui (CDN) + <script type=module>   [throwaway]
├── main.js               # bootstrap: canvas, loop, wire input + gui, render [throwaway]
├── render.js             # draw field / sheep / dog / cone / overlays / HUD   [throwaway]
├── input.js              # buttons + hotkeys → dog command                    [throwaway]
├── params.js             # SINGLE source-of-truth param object (the salvage artifact)
└── sim/                  # ← PURE, engine-agnostic, ports to Godot FlockSim
    ├── vec2.js           #   vector helpers
    ├── FlockSim.js       #   state + step(dt): orchestrates the tick
    ├── forces.js         #   sep / coh / align / flee / graze / fence (pure fns)
    ├── dog.js            #   command → target → steering; derived facing
    ├── neighbors.js      #   brute-force query now; spatial-hash stub for later
    └── scoring.js        #   four axes + crush + fault detection
```

**Tech decisions to lock:**
- Plain **Canvas 2D** + native **ES modules**, no bundler.
- **lil-gui** via CDN. All tunables live in `params.js` and are bound to the GUI.
- ES modules require `http://` (not `file://`) — serve with `npx serve` /
  VS Code Live Server / any static server.
- **Fixed timestep** `dt = 1/60` with an accumulator; **cap the max frame delta**
  (e.g. 0.25s) to avoid the spiral of death.

---

## Data shapes (planning sketch, not implementation)

- **Sheep** (array of ~20): `{ pos, vel, boldness, stress }`. Object-array is fine
  and readable at this count; note the swap to structure-of-arrays when scaling to
  150 (see [`godot-prototype.md`](./godot-prototype.md#scaling-path-20--150)).
- **Dog**: `{ pos, vel, facing, command, target, intensity }`.
- **Field**: `{ bounds, goalPen, gate, idealPath }`.
- **`params`** (the salvage artifact — mirrors the
  [force-model tuning table](./force-model.md#tuning-table-starting-guesses--the-pocs-job-is-to-find-the-fun)),
  grouped: `boids` (r_sep, w_sep, coh_n, w_coh, r_align, w_align) · `flee`
  (R_flee, w_flee, ambient, k, falloff) · `dog` (v_max, R_orbit, ω, R_drive,
  lieDownIntensity) · `gate` (crush_threshold) · `sim` (dt, damping) · `debug`
  (overlay toggles).

---

## Build order — always leaves something on screen

Each phase is independently runnable and maps to an acceptance check. Sliders are
added as the systems they control come online.

| Phase | Build | Deliverable on screen | Proves |
|---|---|---|---|
| **0 — Skeleton** | `index.html`, canvas, fixed-timestep loop, draw field rect, FPS readout | green field, stable loop | loop is framerate-independent |
| **1 — Sheep move** | spawn ~20 sheep, velocity integration + damping + boundary clamp, draw triangles along heading | sheep drift & stay in bounds | integration & rendering work |
| **2 — Boids** | separation + cohesion + alignment; brute-force neighbors; sliders for weights/radii | sheep form a loose grazing group | **Milestone 1** (graze + group) |
| **3 — Dog + flee** | dog entity (mouse-follow first), ambient-cone flee force, **draw the gaze cone + threat radius**, tint sheep by stress | approaching dog compacts the blob | **Milestone 2** (compaction) |
| **4 — Commands** | replace manual dog with command steering (orbit / drive / lie-down / return); derive facing (eye on GCM); wire 5 buttons + hotkeys | come-by walks the blob across; walk-on drives it | **Milestones 3 & 4** (sweep, drive, protest/bolt) |
| **5 — Gate + crush** | goal pen + narrow gate; `crush = density × forward_pressure`; **visible crush indicator**; per-sheep boldness | lie-down relieves the gate; front trickles through | **Milestone 5** + the injury↔lie-down loop |
| **6 — Scoring spine** | stress meter, ideal-path line + deviation, split/straggler detection, four-axis post-run card | fast vs. calm runs yield different cards | **Milestone 6** (split) + scoring test |
| **7 — Tuning polish** | debug overlays (velocity, neighbor links, GCM, dog target, collect/drive state), reseed button, **export tuned params to JSON** | toggleable overlays; a copyable param table | produces the **salvage artifact** |

Milestone list source: [`js-poc.md`](./js-poc.md#milestones--acceptance-for-the-core-is-fun).
Scoring test source: [`failure-and-scoring.md`](./failure-and-scoring.md#poc-test--what-to-prove).

---

## Definition of done

The PoC is finished when, with sliders dialed:

1. All **six milestones** read clearly (graze → compact → sweep → drive →
   gate-trickle → split).
2. The **three scoring checks** hold: stress spikes on rushed runs, the
   crush→lie-down loop works at the gate, and fast-vs-calm runs produce
   *interestingly different* cards.
3. You can **export the tuned `params`** as JSON.

Then the throwaway is done its job. Carry the **param table** + the **`sim/`
module boundary** into the Godot `FlockSim`
([`godot-prototype.md`](./godot-prototype.md)); throw away the rendering.

---

## Risks / watch-items

- **Separation blow-ups**: inverse-square force → clamp a minimum distance so it
  can't explode when two sheep overlap.
- **Topological neighbors**: cohesion uses the `n` nearest → partial-sort of
  distances; keep it in `neighbors.js` so the spatial-hash swap is localized.
- **O(n²)** is fine at 20; don't optimize early, but keep the query behind
  `neighbors.js` so 150 later is a one-file change.
- **Cone readability**: if you can't *see* the eye, tuning feels random — the
  cone/threat draw in Phase 3 is not optional.
- **Framerate independence**: verify Phase 0's accumulator before building on it.

---

## What this PoC deliberately does NOT do

Multi-dog UX, real art/animation, 3D, backend/fnb, level progression. All of that
waits until the core loop is proven fun. (fnb integration is handled separately by
the owner — do not wire it in here.)
