# Phase 3 — Dog + Flee

## ▶ Invocation
**Trigger:** "run phase 3", "run phase-3-dog-flee.md", or reaching P3 from
[`plan.md`](./plan.md).
**Prerequisite:** Phase 2 complete.
**Do:** Implement the Tasks below in `.claude/sheep/poc/sheep-poc.html`. Then run
Verify. Then tick P3 in `plan.md`, **STOP, and report**. Do not start Phase 4.
**Constraints:** obey the Global Invariants in `plan.md`.

---

## Goal
Introduce a dog and the **ambient-cone flee force** so an approaching dog
compacts the blob — and make the "eye" visible. Dog is manually driven for now
(mouse-follow); commands come in P4. **Milestone 2.**

## Tasks
- **§0 PARAMS:** add `dog vMax 135`, `R_flee 120`, `w_flee 2.0`, `ambient 0.2`,
  `coneK 2`, `lieDownIntensity 0.3` (unused until P4). Bind `R_flee`, `w_flee`,
  `ambient`, `coneK` to a "Flee/Eye" folder.
- **§1 SIM:**
  - Dog state: `{ pos, vel, facing, command:'none', target, intensity:1 }`.
  - For P3, `facing = normalize(vel)` (dog looks where it moves); it heads toward
    a `target` set from the mouse (see §3).
  - **`flee` force** per sheep (see
    [force-model §4](../brainstorming/force-model.md#4-flee--the-crux-predator-pressure-eye)):
    for the dog within `R_flee`,
    `eyeFactor = ambient + (1−ambient)·max(0,cosθ)^coneK`,
    `T = falloff(dist)·eyeFactor·intensity`, add `dir·T` scaled by `w_flee` to the
    sheep's accel. Use a smoothstep `falloff(dist)` (1 at contact → 0 at `R_flee`).
  - Set each sheep's `stress` = its total incoming threat `T` this tick (for
    render tint; scoring uses it in P6).
- **§3 INPUT:** dog `target` follows the mouse position over the canvas
  (temporary — replaced by commands in P4).
- **§2 RENDER:**
  - Dog triangle (16×11) oriented to `facing`.
  - **Draw the eye:** a semi-transparent cone wedge (half-angle from `coneK`) +
    the `R_flee` threat circle. This is not optional — tuning needs to *see* it.
  - Tint sheep by `stress` (calm→white, fleeing→reddish).

## Verify
- Moving the dog toward the flock makes sheep **flee coherently** and the blob
  **compacts** on the far side. **Milestone 2.**
- Dropping `ambient` toward 0 visibly **narrows** the effective threat to the
  cone; raising to 1 makes it omnidirectional. The wedge + circle render correctly.
- 60 FPS; §1 DOM-free.

## Done when
- [ ] Dog exists, mouse-driven, faces its heading.
- [ ] Ambient-cone flee implemented; sheep flee & compact (**Milestone 2**).
- [ ] Eye cone + threat radius drawn; sheep tint by stress.
- [ ] `ambient`/`coneK`/`R_flee`/`w_flee` sliders visibly change behavior.

## Gotchas
- `θ` is the angle between **dog.facing** and **dog→sheep**; get the sign/domain
  right (use `acos` of a dot of unit vectors, or compare via dot directly).
- `falloff` must be 0 at `R_flee` or sheep twitch at the boundary — use smoothstep.
- Keep the whole flee calc in §1; only the *drawing* of the cone is §2.
