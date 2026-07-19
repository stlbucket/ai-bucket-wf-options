# Throwaway JS Canvas PoC — "Does the herding feel good?"

You asked whether a plain-JavaScript proof of concept makes sense, or whether
you'd "have to incorporate Godot first."

**Short answer: no — do the JS PoC first. You do not need Godot to prove this.**
(This doc is the plan for that PoC. Per your instruction, the prototype is **not
written yet**.)

---

## Why JS-first beats Godot-first here

The question the prototype needs to answer is **"does the simulation feel
good?"** — not "does the Godot architecture hold up?" For a feel test, plain JS
+ Canvas 2D is the fastest possible path:

- The sim is pure `Vector2` math → it ports to Godot's `FlockSim`
  ([`godot-prototype.md`](./godot-prototype.md)) **1:1**. Only the rendering is
  throwaway.
- **Instant edit-refresh** — no compile/import step. Tune weights live.
- **Zero engine concepts in the way.** You're testing math, not nodes.
- Runs in any browser; trivial to share a link or a GIF.
- Genuinely disposable with no sunk cost — and you walk away with a **tuned
  parameter table** and a list of **validated behaviors** to seed the Godot build.

**When Godot-first *would* be right instead:** if the open question were engine
architecture/perf, or you wanted to test real 3D art and animation. Neither is
the current question, so: JS first.

---

## Stack

- **Rendering:** plain **Canvas 2D** (simplest, recommended). Alternatives:
  `p5.js` (nice for quick creative-coding viz), `PixiJS` (only if you later want
  lots of sprites/perf). For a feel test, Canvas 2D or p5.
- **Loop:** `requestAnimationFrame` with a **fixed-timestep accumulator** (stable
  physics regardless of framerate).
- **Tuning UI:** `lil-gui` / `dat.GUI` sliders bound to every weight and radius
  in the [tuning table](./force-model.md#tuning-table-starting-guesses--the-pocs-job-is-to-find-the-fun).
  Live feel-finding **is the whole point** of the PoC.
- **No build tooling:** a single `index.html` + a module or two.

---

## What to render (procedural "animation" — no art assets)

- **Sheep** = a small triangle pointing along its velocity; tint by state
  (calm → white, fleeing → reddish, scaled by `T_total`). Optional squash/stretch
  or a sine-wave leg-wiggle for life.
- **Dog** = a triangle; **draw its threat radius / gaze cone** as a
  semi-transparent wedge so you can literally *see* the pressure — invaluable for
  tuning.
- **Overlays** (toggle-able): flock GCM marker, goal pen rectangle, fences,
  per-sheep velocity vectors, neighbor links, current collect/drive state, and
  the dog's current target point.

"Appropriate animation directly in JavaScript" here = **procedural**: interpolated
motion, heading rotation, a little squash/stretch. No sprite sheets. Dots and
triangles are enough to feel the flock.

---

## Conceptual structure (not writing it now)

- `vec2` helpers
- `Sheep { pos, vel, boldness }`
- `Dog { pos, vel, facing, command, target, intensity }`
- `FlockSim.step(dt)` → neighbors → forces (per [`force-model.md`](./force-model.md))
  → integrate → dog steering
- `render(ctx)`
- input: 5 buttons / hotkeys → `dog.command`
- `lil-gui` bound to the parameter table

---

## Milestones — acceptance for "the core is fun"

Prove these six, with sliders dialed:

1. 20 sheep graze and form a loose group (boids alone, no dog).
2. Dog approaches → coherent flee + visible compaction.
3. **Come by / Away** → the blob walks to the opposite side; stragglers swept in.
4. **Walk on** → steady drive toward the goal; occasional protest / bolt.
5. **Lie down** → the front trickles through a narrow gate without a pile-up blowout.
6. **Overpressure** → a visible, feelable **split**.

If those six feel good, the game's core is proven → port the numbers into the
Godot `FlockSim`.

---

## Keep it disposable

One folder, no backend, no fnb, no framework ceremony. The **salvage value** is
exactly two things, both of which transfer straight to Godot:

1. the tuned **parameter table**, and
2. the six **validated behaviors**.

The rendering code is meant to be thrown away.
