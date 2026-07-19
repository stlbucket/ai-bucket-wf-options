# POC-v2 · Feature: Flock Behavior — Semantic Rules

**Status:** draft — **living rules list** (owner is actively adding rules).

These are **semantic rules**: observable behavior the simulation must produce,
stated independently of the force math. They read as acceptance criteria for how
the flock *feels* — especially at rest, before the dog applies pressure. The list
is expected to grow; each rule is numbered so we can reference and refine them.

This is a fnb side-project — **no fnb DB/GraphQL/backend**. Rules must be
implementable inside §1 SIM (DOM-free, ports to Godot) driven by §0 `params`.

Related: today's boid/graze/cohesion model lives in
[`../../brainstorming/force-model.md`](../../brainstorming/force-model.md); this
spec constrains what that model must *look like* at rest.

---

## Setting changes

- **`sheepCount` default `20 → 50`.** (Slider max is already 80.)

---

## Semantic rules

Convention: `A#` = start / idle (unpressured) behavior. New groups get new letters
as the owner adds them (e.g. `B#` under-pressure, `C#` gate behavior, …).

### A. Start / idle state — the unpressured flock
- **A1.** On game start the flock is **calm and low-mobility** — most sheep barely
  translate; the scene reads as "sheep standing around in a field," not "a swarm."
- **A2.** **Most sheep graze**: near-stationary, slow head-down local wander, not
  covering ground.
- **A3.** **A few** sheep wander off in a **random direction** (slow drift) — a
  small minority, not the majority.
- **A4.** The flock does **NOT converge on a single center point** — there is no
  global pull toward one center of mass. Left alone, they do not gather into one
  blob.
- **A5.** Sheep sit in **several small loose groups of ~2–5**, standing in
  **different places** across the field.
- **A6.** Those groups start **spatially separated** (scattered across the play
  area), not spawned as one clump that then disperses.

*(room to grow — owner is adding more rules here)*

---

## Design notes (light — planning will refine the "how")

These are implications, not the implementation. Flagged because they're the hard
parts of honoring the rules above with a boid model:

- **Cohesion must be local & bounded, not global (A4/A5).** A single strong
  cohesion pull produces one blob. Options: cap cohesion to a short radius / few
  neighbors, and/or gate it off in the idle state so idle groups don't reach for
  each other.
- **Groups must resist merging (A5).** Plain boids tend to coalesce over time. To
  hold ~2–5-sheep groups apart at rest, cohesion likely needs to be **weak/local
  enough that separate groups don't feel each other**, or an idle state that
  suppresses long-range attraction entirely.
- **Scattered spawn (A6).** Replace the single spawn box with **several cluster
  seeds** (random points in the left field), each populated with 2–5 members
  jittered around the seed.
- **Idle vs. mobile split (A1–A3).** A per-sheep idle/graze baseline with a low
  speed cap, and a small random fraction flagged as "wanderers" with a slightly
  higher drift.

---

## Tunables likely involved

Existing: `sheepCount`, `grazeSpeed`, `w_graze`, `wanderTurn`, `damping`, `w_coh`,
`cohN`, `cohScale`.
Likely **new** (name TBD in planning): start-cluster count, cluster size range
(2–5), wanderer fraction, idle speed cap, cohesion-idle gate.

---

## Open questions (parked — for the owner)

1. **Counts:** for 50 sheep, roughly how many start groups, and what fraction are
   the "few wanderers" (A3)? (Guess: ~10–14 groups of 2–5; ~10–15% wanderers.)
2. **Do idle groups stay put or slowly drift/merge over time** until the dog
   arrives? A5/A6 imply they hold; confirm they shouldn't slowly coalesce.
3. **Does pressure dissolve the idle state entirely** (dog arrives → normal boids
   take over), or do these rules persist as a bias even under pressure?
4. Should grazing sheep occasionally **re-orient / take a step and re-settle**, or
   is "grazing" essentially stationary?

---

## Acceptance (for the A-rules so far)

Load the page with the dog idle (no commands):
- ~50 sheep appear in **several small, spatially separated groups** of ~2–5.
- The scene is **mostly still** — a couple of sheep drift slowly, the rest graze.
- Left alone for 10+ seconds, they **do not gather into one blob** or slide toward
  a common center.
