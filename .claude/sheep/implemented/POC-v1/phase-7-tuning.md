# Phase 7 — Tuning Polish

## ▶ Invocation
**Trigger:** "run phase 7", "run phase-7-tuning.md", or reaching P7 from
[`plan.md`](./plan.md).
**Prerequisite:** Phase 6 complete.
**Do:** Implement the Tasks below in `.claude/sheep/poc/sheep-poc.html`. Then run
Verify. Then tick P7 in `plan.md`, **STOP, and report** — this completes the PoC.
**Constraints:** obey the Global Invariants in `plan.md`.

---

## Goal
Turn the PoC into a real tuning tool and produce the **salvage artifact**: debug
overlays for reading the sim, a reseed control, and **export of the tuned
`params` as JSON** to carry into Godot.

## Tasks
- **§2 RENDER — debug overlays** (each toggle-able via `params.debug.*` +
  lil-gui): per-sheep velocity vectors; neighbor links; flock **GCM** marker; dog
  **target** point; current **collect/drive** state label; the flee **cone +
  R_flee** (already from P3, gate it behind a toggle).
- **§3 INPUT:** a **Reseed** button → re-inits sheep from a new seed (reproducible
  via the §1 PRNG); a **Reset run** button → restarts the scoring clock and
  layout without reload.
- **§0 PARAMS:** an **Export** button → serialize `params` to JSON, **copy to
  clipboard** and `console.log` it. (No file written — single-file rule.)

## Verify
- Every overlay toggles cleanly; they make the sim **readable** (you can see why
  sheep react).
- Reseed produces a fresh-but-reproducible flock; Reset restarts a run without
  reloading the page.
- **Export** puts valid JSON of the current tuned `params` on the clipboard and in
  the console.

## Done when
- [ ] Debug overlays implemented + individually toggle-able.
- [ ] Reseed + Reset-run controls work.
- [ ] Export copies tuned `params` JSON to clipboard + console.
- [ ] **Whole-PoC definition of done** (in `plan.md`) is met: six milestones read,
  three scoring checks hold, export works.

## Hand-off (after P7)
Lift **§0 `params`** (the exported JSON) + the **§1 SIM** block into the Godot
`FlockSim` per
[`../brainstorming/godot-prototype.md`](../brainstorming/godot-prototype.md).
Discard §2–§4. The PoC has done its job.

## Gotchas
- `navigator.clipboard` may need a user gesture (it's behind the button click —
  fine) and HTTPS/localhost in some browsers; from `file://` it usually works, but
  the `console.log` fallback guarantees you never lose the numbers.
- Don't let overlays run when toggled off (skip the work, not just the draw) so
  perf stays honest while tuning.
