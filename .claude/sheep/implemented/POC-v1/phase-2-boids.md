# Phase 2 — Boids

## ▶ Invocation
**Trigger:** "run phase 2", "run phase-2-boids.md", or reaching P2 from
[`plan.md`](./plan.md).
**Prerequisite:** Phase 1 complete.
**Do:** Implement the Tasks below in `.claude/sheep/poc/sheep-poc.html`. Then run
Verify. Then tick P2 in `plan.md`, **STOP, and report**. Do not start Phase 3.
**Constraints:** obey the Global Invariants in `plan.md`.

---

## Goal
The three Reynolds forces so sheep behave like a loose grazing flock — clump
together, keep spacing, drift as a group. **Milestone 1.**

## Tasks
- **§0 PARAMS:** add `r_sep 18`, `minSep 4`, `cohN 10`, `r_align 36`,
  `w_sep 1.5`, `w_coh 1.0`, `w_align 0.2`. Bind all to lil-gui (a "Boids" folder).
- **§1 SIM — `neighbors.js`-equivalent block:** a neighbor query. Brute-force
  O(n²) is fine at 20; **wrap it behind one function** so a spatial hash can
  replace it later without touching callers.
- **§1 SIM — forces:**
  - `separation`: sum of `(p_i − p_j)/|.|²` over neighbors within `r_sep`;
    **clamp min distance to `minSep`** so it can't explode on overlap.
  - `cohesion`: `normalize(mean(pos of the cohN nearest) − p_i)` (topological —
    partial-select the `cohN` nearest).
  - `alignment`: `normalize(mean(vel of neighbors within r_align))`.
- **§1 SIM — `integrate`:** accumulate
  `accel = w_sep·F_sep + w_coh·F_coh + w_align·F_align + w_graze·F_graze` before
  the damping/clamp step from P1.

## Verify
- Scattered sheep **pull into a loose group** and hold spacing (no overlap, no
  explosion).
- Group **drifts** as a blob; nudging a slider (e.g. `w_coh` up) visibly tightens
  it, `r_sep` up spreads it.
- 60 FPS with 20 sheep; §1 still DOM-free.

## Done when
- [ ] Neighbor query behind a single swappable function.
- [ ] Separation/cohesion/alignment implemented; min-distance clamp prevents blowups.
- [ ] Sheep form and keep a loose grazing group (**Milestone 1**).
- [ ] Boids sliders visibly change flock shape live.

## Gotchas
- Topological cohesion (n nearest) beats a fixed radius as density changes — do
  the partial-select, don't just average a radius.
- Inverse-square separation **will** blow up without the `minSep` clamp.
- Keep alignment weak (`0.2`) — sheep aren't starlings.
