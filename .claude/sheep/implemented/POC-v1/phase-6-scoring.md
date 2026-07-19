# Phase 6 — Scoring Spine

## ▶ Invocation
**Trigger:** "run phase 6", "run phase-6-scoring.md", or reaching P6 from
[`plan.md`](./plan.md).
**Prerequisite:** Phase 5 complete.
**Do:** Implement the Tasks below in `.claude/sheep/poc/sheep-poc.html`. Then run
Verify. Then tick P6 in `plan.md`, **STOP, and report**. Do not start Phase 7.
**Constraints:** obey the Global Invariants in `plan.md`.

---

## Goal
The four-axis subtractive scoring spine + a post-run card, so the **fast-vs-calm**
tension is measurable and visible. Also surfaces **Milestone 6** (a feelable
split). (See
[failure-and-scoring](../brainstorming/failure-and-scoring.md#the-four-scoring-axes-and-the-tension-that-carries-the-game).)

## Tasks
- **§0 PARAMS:** add axis weights (`w_time`, `w_line`, `w_cohesion`, `w_calm`) and
  thresholds (`T_straggle`, `splitMinSize`, `T_scatter`). Bind to a "Scoring"
  folder.
- **§1 SIM — `scoring.js`-equivalent block** (pure; accumulates over the run):
  - **Time:** elapsed since run start.
  - **Line:** deviation area between flock GCM path and the ideal path
    (herd-spawn → gate → pen center).
  - **Cohesion:** penalty while there are persistent stragglers (outside main
    blob > `T_straggle`) or a **split** (≥2 clusters each ≥ `splitMinSize`).
    Detect clusters (simple distance-based connected components over the flock).
  - **Calm/welfare:** integrate aggregate sheep `stress` over time + a big lump
    per injury/`down` event.
  - Expose current sub-scores + a total = `100 − Σ weighted penalties`, and a
    win check (all sheep in `goalPen`).
- **§2 RENDER / HUD:** live stress meter + faint ideal-path line shaded by
  deviation; on win (or a "finish run" button), a **post-run card**: Time / Line /
  Cohesion / Calm + itemized faults + total.

## Verify
- A **rushed** run (mash walk-on) spikes stress + racks welfare penalty; a
  **patient** run keeps calm high. The two produce **interestingly different
  cards** — the scoring test.
- Over-pressuring the middle of the blob produces a **visible split**, and the
  cohesion axis penalizes it. **Milestone 6.**
- Reaching the pen ends the run and shows the card. §1 DOM-free.

## Done when
- [ ] Four axes accumulate in a pure §1 scoring block; total = 100 − penalties.
- [ ] Split/straggler detection via cluster components works.
- [ ] Live stress meter + ideal-path deviation render.
- [ ] Post-run card shows on win; fast-vs-calm runs diverge (**scoring test**).
- [ ] A split is producible and penalized (**Milestone 6**).

## Gotchas
- Cluster detection: keep it cheap (distance-based union-find over 20 sheep is
  trivial) and behind one function.
- Line deviation needs a defined **ideal path** — a simple 2–3 point polyline
  (spawn → gate → pen) is enough.
- Keep scoring **pure** (§1) so it ports; the card *rendering* is §2.
