# Phase 1 — Sheep Move

## ▶ Invocation
**Trigger:** "run phase 1", "run phase-1-sheep-move.md", or reaching P1 from
[`plan.md`](./plan.md).
**Prerequisite:** Phase 0 complete.
**Do:** Implement the Tasks below in `.claude/sheep/poc/sheep-poc.html`. Then run
Verify. Then tick P1 in `plan.md`, **STOP, and report**. Do not start Phase 2.
**Constraints:** obey the Global Invariants in `plan.md`.

---

## Goal
~20 sheep exist as sim state, integrate their motion (velocity + damping +
boundary clamp), and render as triangles pointing along heading. No boid forces
yet — a gentle wander is enough to see life.

## Tasks
- **§0 PARAMS:** add `sheepCount 20`, `sheep vMax 90`, `grazeSpeed 15`,
  `damping 0.9`, `w_graze 0.3`. Bind `sheepCount`, `vMax`, `damping` to lil-gui.
- **§1 SIM:**
  - Sheep state: array of `{ pos, vel, boldness, stress }` (boldness/stress unused
    yet; init boldness `clamp(N(0.3,0.1),0,1)`, stress 0). Spawn at random
    positions inside the play rect.
  - `integrate(sheep, dt)`: apply a small smoothed wander (graze) accel,
    `vel = clampLen((vel + accel*dt) * damping, vMax)`, `pos += vel*dt`, then
    **clamp to the play rect** (reflect or clamp position + zero the outward vel
    component).
  - `FlockSim.step(dt)`: loop sheep → `integrate`. Deterministic given a seeded
    RNG (add a tiny seeded PRNG in §1 so reseed is reproducible later).
- **§4 BOOTSTRAP:** call `sim.step(dt)` in the fixed slice.
- **§2 RENDER:** draw each sheep as a triangle oriented to `normalize(vel)` (fall
  back to a fixed heading when nearly stationary), sized 12×8 px.

## Verify
- 20 triangles drift around the field, **stay inside the fence**, and point where
  they're going.
- Motion is smooth and **framerate-independent** (same feel regardless of FPS).
- No console errors; §1 still has zero DOM references.

## Done when
- [ ] 20 sheep spawn inside the play rect from a seeded RNG.
- [ ] Integration with damping + boundary clamp works; none escape.
- [ ] Triangles render oriented to heading.
- [ ] `sheepCount`/`vMax`/`damping` sliders take effect live.

## Gotchas
- **Clamp a minimum distance later** (P2 separation) — not needed yet.
- Stationary sheep have no heading; pick a stable fallback so triangles don't
  flicker.
- Keep the PRNG in §1 (pure) so P7 reseed reproduces a run.
