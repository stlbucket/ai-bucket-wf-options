# Sheepdog Herding Game — Brainstorming

Index + living notes for a sheepdog-trial herding game. Captures the design
conversation and points at the deep-dive docs. **This is a design/planning
effort — no prototype code has been written yet, and (per owner) no fnb/DB work
happens here; fnb is only a future backend, figured out separately.**

## The concept

Bird's-eye herding game. You command one or more **dogs**; you never directly
control the sheep. Dogs apply *pressure* through the natural predator–prey
relationship — threat and "eye" (stare-down), never contact. The herd behaves
like a cohesive **"blob of jelly"** whose motion is emergent. Goal: move and/or
collect the flock to a target (pen / gate / field corner).

Commands (voice-flavored buttons; you say the dog's name in multi-dog scenarios):

| Command | Effect |
|---|---|
| **Come by** | Orbit the herd **clockwise** → herd drifts to the far side, compacting; sweeps stragglers into the mass on the way around. |
| **Away** | Same, **counter-clockwise**. |
| **Walk on** | Dog holds position, creeps straight in; steady rising pressure. A brave sheep or two protests, then backs down — or bolts past if there's a gap (forcing a come-by/away to reset). |
| **Lie down** | Dog lies facing the herd; pressure **released** so the front can trickle through a gate/bottleneck without pile-ups/accidents. |
| **That'll do** | Job done; dog runs back to the owner's side. |

Scale ranges from **1 dog vs 1 sheep** up to **3–4 dogs vs ~150 sheep**;
physics/difficulty dials TBD. UX = bird's-eye view + command buttons.

## Why it works (design thesis)

It's **indirect control over emergent agents** — the same loop that carries
*Pikmin*, *Katamari*, *Untitled Goose Game*. The satisfying moments (compaction,
splitting, stragglers peeling off, gate bottlenecks) *emerge* from local rules
rather than being scripted. Player skill = learning to **read and shape the
blob**. You don't animate the drama; the simulation produces it.

## Grounding: this is a solved simulation problem

- Sheep = Reynolds **boids** (separation / cohesion / alignment) + a
  **flee-from-dog** force.
- It matches **Strömbom et al. 2014, "Solving the shepherding problem"**
  (J. R. Soc. Interface): a shepherd needs only two behaviors — **collect**
  (fetch the furthest straggler back to the group) and **drive** (position
  behind the group and push toward the goal). Your commands are the *manual*
  version of that shepherd. Details in [`force-model.md`](./force-model.md).

## Architecture decision (settles the 2D→3D question)

The **simulation is 2D on the ground plane regardless of how it's rendered.**
So split it hard:

- **Sim layer** — pure 2D vector math; engine-agnostic; unit-testable headless.
- **Render layer** — swappable: 2D sprites first, 3D models on the same plane
  later (that's the *only* place the Blender → glTF → Godot animation pipeline
  enters).

Start 2D, prove the fun lives in the sim, re-skin later. The uncertainty about
dimensionality is itself a *reason* to build this split from day one.

## Prototype path (recommended)

Smallest thing that proves the game: **1 dog, ~20 sheep, one field, one goal,
all five commands, dots-and-triangles art.** Prove the *feel*. Order:

1. **Throwaway JS/Canvas PoC** to tune the force model + command feel (fastest
   possible iteration). Rationale → [`js-poc.md`](./js-poc.md); build plan →
   [`poc-plan.md`](./poc-plan.md).
2. **Port the proven numbers** into a Godot `FlockSim`. → [`godot-prototype.md`](./godot-prototype.md)

No engine required to validate the simulation. No backend anywhere in the
prototype.

## Deep dives

- [`force-model.md`](./force-model.md) — the actual force equations, emergent
  behaviors, dog steering, tuning table.
- [`godot-prototype.md`](./godot-prototype.md) — 1-v-20 Godot node structure +
  the sim/render split.
- [`threat-model.md`](./threat-model.md) — radius vs. gaze cone ("eye"); the
  ambient-cone hybrid, how facing is derived, multi-dog flanking.
- [`failure-and-scoring.md`](./failure-and-scoring.md) — arcade vs. zen; the
  four-axis subtractive score, the crush→injury fault paired with lie-down, modes.
- [`js-poc.md`](./js-poc.md) — throwaway JS Canvas PoC: *why* JS-first beats
  Godot-first, and *what* to render/prove.
- [`poc-plan.md`](./poc-plan.md) — the **build plan** for that PoC: file layout,
  8-phase build order, data shapes, definition of done, risks.

## Open design questions (parked)

- **Difficulty dials**: flock size, field size, sheep boldness/flightiness,
  terrain & line-of-sight, goal shape (open pen vs narrow gate vs split-the-flock).
- ~~**Threat = radius or cone/"eye"?**~~ **Resolved** → ambient-cone hybrid with
  derived facing; see [`threat-model.md`](./threat-model.md).
- ~~**Timed/scored (arcade tension) vs zen/flow?**~~ **Resolved** → four-axis
  subtractive score + stars + a mode toggle (same engine does both); see
  [`failure-and-scoring.md`](./failure-and-scoring.md).
- ~~**Failure state**~~ **Resolved** → three-tier fault taxonomy; the
  crush→injury fault is paired with the lie-down verb. Same doc.
- **Determinism**: a run = `(level_seed, [timestamped commands])` → tiny to
  store, cheat-resistant, free replays/ghosts. (Backend concern — later.)

## Animation pipeline (reference, for the 3D re-skin later)

Blender: model → armature/rig → weight paint → author named **Actions**
(idle/run/lie-down) → export **glTF (.glb)** with actions → Godot imports as a
scene with an `AnimationPlayer` per clip → wrap in `AnimationTree`
(state machine / blend spaces) driven from GDScript. 2D prototype needs none of
this — just sprite frames.
