# Phase 5 — Gate + Crush

## ▶ Invocation
**Trigger:** "run phase 5", "run phase-5-gate-crush.md", or reaching P5 from
[`plan.md`](./plan.md).
**Prerequisite:** Phase 4 complete.
**Do:** Implement the Tasks below in `.claude/sheep/poc/sheep-poc.html`. Then run
Verify. Then tick P5 in `plan.md`, **STOP, and report**. Do not start Phase 6.
**Constraints:** obey the Global Invariants in `plan.md`.

---

## Goal
Add the goal pen + narrow gate scenario and the **crush → injury** fault, and
prove **lie down** relieves it. This is the payoff loop for the lie-down verb.
**Milestone 5.** (See
[failure-and-scoring → injury hook](../brainstorming/failure-and-scoring.md#the-star-of-the-show-injury-at-the-bottleneck--lie-down).)

## Tasks
- **§0 PARAMS:** add the field layout — vertical fence at `x 820` with a gate gap
  `gateWidth 30` (slider 12–60) at mid-height; `goalPen` = region `x > 820`;
  herd spawn box on the left. Add `crushThreshold` (**calibrate here** — no good
  a-priori value). Bind `gateWidth`, `crushThreshold`.
- **§1 SIM:**
  - **Interior fence + gate** as boundary geometry: sheep (and dog) collide with
    the fence except through the gap. Fold into the existing boundary clamp / add a
    fence-repulsion force near the wall (`w_fence 1.5`, `r_fence`).
  - **Crush metric** at the gate mouth: `crush = localDensity × forwardPressure`
    (local sheep density near the aperture × net forward push there). When
    `crush > crushThreshold` sustained → **injury event**: mark a sheep `down`
    (stops, becomes an obstacle others avoid; big stress/welfare spike for P6).
  - **Boldness/protest/bolt** (fuller than P4): sheep with `T_total < boldness·θ`
    ignore the dog; near threshold → occasional protest step toward the dog; high
    `T_total` → panic speed multiplier (enables bolting through gaps).
- **§2 RENDER:** draw the interior fence + gate gap + goal pen; a **visible crush
  indicator** at the gate (mouth reddens / heats as `crush` climbs); render
  `down` sheep distinctly.

## Verify
- Driving the herd at the gate with **walk on** and no care → **crush indicator
  reddens**, and past threshold a sheep goes **down**. Calibrate `crushThreshold`
  so this happens under obvious over-pushing, not gentle work.
- **Lie down** at the gate visibly **releases pressure** — the front **trickles
  through** without a pile-up blowout. The rhythm (walk-on → lie-down → trickle →
  repeat) works. **Milestone 5.**
- Brave sheep occasionally **protest then back down or bolt**; a come-by/away
  resets a bolt.

## Done when
- [ ] Interior fence + gate + goal pen exist; sheep only pass through the gap.
- [ ] Crush metric + injury event implemented; `down` sheep render.
- [ ] Visible crush indicator ramps **before** injury (readable, fair).
- [ ] Lie-down relieves the gate; front trickles through (**Milestone 5**).
- [ ] Boldness protest/bolt behavior present.

## Gotchas
- **`crushThreshold` is feel-only** — set it live against the indicator; don't
  trust a computed number.
- Crush must be **visible before** it injures or it feels unfair — build the
  indicator alongside the metric, not after.
- Fence collision for the *dog* too, or it cheats through walls during orbits.
