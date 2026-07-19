# Phase 0 — Skeleton

## ▶ Invocation
**Trigger:** "run phase 0", "run phase-0-skeleton.md", or reaching P0 from
[`plan.md`](./plan.md).
**Prerequisite:** none (first phase).
**Do:** Implement the Tasks below in `.claude/sheep/poc/sheep-poc.html` (create the
`poc/` dir and file). Then run Verify. Then tick P0 in `plan.md`, **STOP, and
report**. Do not start Phase 1.
**Constraints:** obey the Global Invariants in `plan.md` (single file, plain
`<script>`, §1 DOM-free, tunables in §0 `params`, page runs after this phase).

---

## Goal
A runnable HTML shell: a canvas showing the fenced field, driven by a stable,
framerate-independent fixed-timestep loop with an FPS readout. No sheep yet.

## Tasks
- **Create** `.claude/sheep/poc/sheep-poc.html` with the full section skeleton
  (`§0 PARAMS`, `§1 SIM`, `§2 RENDER`, `§3 INPUT`, `§4 BOOTSTRAP` comment
  markers), a `<canvas>`, and a throwaway `<div id="hud">` placeholder.
- `<head>`: minimal CSS (centered canvas, dark page, HUD styling) + the **lil-gui
  UMD** `<script>` tag from a CDN.
- **§0 PARAMS:** create the `params` object seeded with the Stage + Sim constants
  from [`README.md`](./README.md#starting-constants-p0--all-slider-backed-defaults):
  canvas `1120×720`, `fenceInset 20`, `L 12`, `dt 1/60`, `maxFrameDelta 0.25`.
  Instantiate a `lil.GUI` and add a folder (can be empty for now).
- **§4 BOOTSTRAP:** fixed-timestep accumulator loop via `requestAnimationFrame`:
  accumulate real elapsed time (clamped to `maxFrameDelta`), step in fixed `dt`
  slices (no sim yet — just a tick counter), call render once per frame. Track and
  expose FPS.
- **§2 RENDER:** clear canvas; draw the field background + fence rectangle (inset
  by `fenceInset`); draw FPS text.
- **§1 SIM:** add `vec2` helpers only (add/sub/scale/len/norm/dist). Nothing else.

## Verify
- Open the file by **double-clicking** (`file://`) — it must run with **no static
  server** and **no console errors**.
- A fenced field renders; FPS reads ~60.
- Loop is **framerate-independent**: the tick count advances at a rate set by
  `dt`, not by the monitor's refresh (sanity-check the accumulator logic).

## Done when
- [ ] File exists at `.claude/sheep/poc/sheep-poc.html`, opens from `file://`.
- [ ] Field + fence + FPS render, no errors.
- [ ] Fixed-timestep accumulator in place (with `maxFrameDelta` clamp).
- [ ] lil-gui panel appears (even if empty).

## Gotchas
- Use lil-gui's **UMD** build (`window.lil.GUI`), not ESM — a plain `<script>`
  can't `import`.
- Clamp the accumulator's max frame delta or a background tab will spiral.
- Keep §1 free of any `canvas`/DOM reference from the very first line.
