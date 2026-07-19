# Phase 4 — Commands

## ▶ Invocation
**Trigger:** "run phase 4", "run phase-4-commands.md", or reaching P4 from
[`plan.md`](./plan.md).
**Prerequisite:** Phase 3 complete.
**Do:** Implement the Tasks below in `.claude/sheep/poc/sheep-poc.html`. Then run
Verify. Then tick P4 in `plan.md`, **STOP, and report**. Do not start Phase 5.
**Constraints:** obey the Global Invariants in `plan.md`.

---

## Goal
Replace mouse control with the five **commands**. The dog becomes a steering agent
whose target/behavior is set by the command; **facing is derived** (eye on the
flock). **Milestones 3 & 4.**

## Tasks
- **§0 PARAMS:** add `R_orbit 160`, `omega 1.2`, `R_drive 140`,
  `driveShrink 10` (px/s), plus a read-only `goal` point (pen center, provisional
  until P5). Bind `R_orbit`, `omega`, `R_drive`, `lieDownIntensity` to a "Dog"
  folder.
- **§1 SIM — dog steering** (see
  [force-model → Dog steering](../brainstorming/force-model.md#dog-steering-command--target--seek)):
  compute `GCM` (flock centroid) each tick, then per command set `target` +
  `facing` + `intensity`:
  - `come_by` / `away`: point on a circle radius `R_orbit` around `GCM`, angle
    advances +/−`omega`·dt (CW/CCW). `facing` = toward `GCM`. Maintain standoff so
    the dog stays outside the blob.
  - `walk_on`: point on line `GCM→goal`, `R_drive` **behind** `GCM`; shrink
    `R_drive` by `driveShrink`·dt while active. `facing` = toward `GCM`.
  - `lie_down`: `target = pos` (stop); `intensity = lieDownIntensity`; `facing`
    held toward `GCM`.
  - `that_ll_do`: `target = owner pos`; `intensity = 1`; flee still applies until
    the dog exits `R_flee`.
  - Dog moves toward `target` via seek/arrive at `dog.vMax`.
- **§3 INPUT:** five HTML buttons (Come By / Away / Walk On / Lie Down / That'll
  Do) in `#hud`, plus hotkeys (e.g. Q/E/W/S/D). Each sets `dog.command`.
- **§0/§2:** add an `owner` point (dog's home) to sim state; render it, the goal
  marker, and the current command label.

## Verify
- **Come By / Away** → dog orbits the blob and it **walks to the opposite side**;
  stragglers get swept in. **Milestone 3.**
- **Walk On** → steady **drive toward the goal**; occasional protest/bolt shows
  up (boldness-driven; fuller in P5). **Milestone 4.**
- **Lie Down** → dog stops, pressure visibly eases (cone/intensity drop).
- **That'll Do** → dog returns to owner; flock relaxes.
- Facing always reads as "eye on the herd" without any manual look control.

## Done when
- [ ] All five commands wired to buttons + hotkeys, driving §1 steering.
- [ ] Facing derived (eye on GCM); no manual head control.
- [ ] Come-by/away sweep works (**M3**); walk-on drives to goal (**M4**).
- [ ] Lie-down and that'll-do behave as specified.

## Gotchas
- Keep the **player→command→target→steering** chain intact: buttons set only
  `dog.command`; §1 does the rest. No sheep touched by input.
- Arrive (slow near target) prevents orbit jitter.
- `walk_on`'s shrinking `R_drive` needs a floor so the dog doesn't walk *into* the
  blob (that's P5's crush territory).
