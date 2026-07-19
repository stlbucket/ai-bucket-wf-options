# The Threat Model — Radius vs. Gaze Cone ("Eye")

The single biggest fork in the sim's *feel*. It decides whether the dog's
**facing** is a real gameplay variable or just cosmetic — and therefore whether
several of your commands (especially **lie down facing the herd**) mean anything
mechanically.

**Bottom line up front:** use a **gaze cone**, but implement it as an *ambient +
directional* hybrid with a single `ambient` slider that spans both models — and
**derive the dog's facing automatically** so you don't add controls. Details
below.

---

## The two models

**Plain radius (isotropic).** A sheep's flee force depends only on *distance* to
the dog. The dog threatens equally in every direction; its facing is irrelevant.
Dead simple, rotationally trivial, nothing to explain.

**Gaze cone ("eye").** Threat is *directional* — strongest in the direction the
dog is looking, weak or nil to the sides and rear. This mirrors how real
sheepdogs (especially Border collies) actually work: they herd with **eye**, a
directional stare-down. This is literally the fiction you already wrote —
"intimidation and stare-downs," "lie down *facing* the herd."

---

## Why the cone matters (and how it lights up each command)

The cone turns **where the dog looks** into a second axis of skill on top of
**where the dog stands**. Concretely, it's what makes your five commands
*mechanically distinct* instead of just "dog in different spots":

| Command | Radius model | Cone model |
|---|---|---|
| **Come by / Away** | Orbiting circle of pressure; near and far sides both spooked. | Dog orbits with its **eye locked on the herd** → only the near edge feels it → clean *peeling* and sweeping of that edge. Far side stays calm = controllable. |
| **Walk on** | Blob pushed by proximity. | Focused forward pressure — you're *aiming* the drive. Sheep beside the dog aren't spooked, so the blob stays coherent instead of squirting sideways. |
| **Lie down** | Facing does nothing; "facing the herd" is flavor text. | **The payoff.** Eye locks forward, cone narrows, intensity drops → a gentle, *precise* hold on the front of the herd while the sweeping threat vanishes. Exactly your gate/bottleneck verb — and it's meaningless without a cone. |
| **That'll do** | Threat fades with distance. | Dog turns its eye *off* the herd (toward owner) → threat drops immediately even before it's far, so the flock relaxes cleanly. |

Two more things the cone buys you:

- **Surgical collect.** You can aim the eye at a straggler or a sub-cluster and
  pressure *just that part* without spooking the whole blob. Radius can't isolate.
- **Legible bolting.** Sheep bolt through the dog's **blind spots** (sides/rear).
  With a cone the gap is *visible* — the player sees where a break is possible,
  which is exactly what makes the come-by/away "reset" feel earned rather than
  random.

---

## The key insight: it's a slider, not a binary

You don't have to commit to radius *or* cone. Make threat the product of a radial
falloff and an **angular** falloff that has a *floor*:

```
T = g(dist) · eyeFactor(θ) · intensity

eyeFactor(θ) = ambient + (1 − ambient) · max(0, cos θ)^k
```

- `θ` = angle between the dog's facing and the direction to the sheep.
- `ambient ∈ [0, 1]` = omnidirectional presence (a real animal is a *little*
  scary even from behind).
- `k` = cone tightness.

Now the two "models" are just endpoints of one slider:

- `ambient = 1.0` → pure **radius** (facing irrelevant).
- `ambient = 0.0` → pure **cone** (rear is a total safe zone — unnatural; sheep
  ignore a dog standing right behind them).
- `ambient ≈ 0.15–0.3` → the sweet spot: directional pressure you can aim, plus a
  believable "the dog is *right there*" floor. **Start ~0.2 and tune in the PoC.**

This is the honest resolution of the fork: **build the hybrid, expose `ambient`
and `k` as sliders, let feel decide.** You get the cone's depth without gambling
the whole design on it.

**Angular shape:** `cos^k` is smooth (`k=2` → half-strength at ~45°, so ~90° full
cone). If you want a crisper, more *readable* cone edge, swap in a
`smoothstep` over a hard half-angle instead. Optional refinement: a narrow intense
**focal** cone plus a wider weak **peripheral** one (models real vision) — nice-to-
have, not for the prototype.

---

## How the dog's facing is set (the important design call)

A cone is only worth it if facing is **automatic and legible**. Do **not** make
the player steer the dog's head with a separate control — that would wreck the
"simple buttons, bird's-eye" UX. Instead **derive** facing:

- **Default: the dog's eye is locked on the flock** (toward the GCM, or the
  nearest sub-cluster). Real collies watch the sheep constantly; this needs zero
  extra input and reads instantly.
- **Per-command overrides:**
  - *Come by / Away*: eye on GCM while orbiting → near-edge pressure, clean sweeps.
  - *Walk on*: eye on the GCM (or the front-of-herd toward the goal) → aimed drive.
  - *Lie down*: eye locked forward on GCM; cone narrows, intensity drops → precise
    gentle hold.
  - *That'll do*: eye disengages toward the owner → threat falls off fast.

Later, for advanced play or 3–4 dogs, you *could* expose a manual "look here"
input — but the prototype shouldn't need it. Depth comes from the cone geometry,
not from more buttons.

---

## Where the cone really pays off: multi-dog & terrain

- **Flanking / pressure corridors.** Two cones aimed to form facing "walls" make a
  corridor the flock flows down — real shepherding with a brace of dogs. Radius
  dogs just stack overlapping circles; cones let 2–4 dogs *shape* space. This is a
  strong argument for the cone in the full game even if the 1-v-20 prototype
  barely exercises it.
- **Line of sight / terrain.** If terrain is a difficulty dial (hills, rocks), a
  cone naturally interacts with **occlusion** — the dog can't eye a sheep behind a
  rock, so pressure is blocked. Radius ignores geometry entirely. Free depth if
  you add obstacles later.

---

## Readability & juice (non-negotiable if you pick the cone)

If the player can't *see* the eye, the cone feels like random inconsistency
("why did those sheep react and not those?"). So:

- **Draw the cone** — a semi-transparent wedge (already in the JS PoC plan).
- **Tint sheep by threat** — sheep inside the eye shade toward alarm.
- The teachable skill becomes "**paint the flock with the dog's eye**," which is
  satisfying precisely because it's visible and learnable.

---

## When radius would actually win

Be honest about the trade: pick **radius** if the game is meant to be very
casual/simple, if you want zero facing-related bugs, or for a *first* playable
that only tests whether the blob *locomotes* nicely. It's less to explain and
rotationally foolproof.

But your design — stare-downs as the core fiction, and a **lie-down-facing** verb
whose entire purpose is precise low pressure at a gate — *wants* the cone. The
`ambient` slider lets you start near radius and dial toward cone as the feel
firms up, so there's little downside to building the hybrid.

---

## Recommendation

1. Implement the **ambient-cone hybrid** (`eyeFactor = ambient + (1−ambient)·cos^k θ`).
2. **Derive facing** (eye-on-flock by default, per-command overrides above) — no
   extra player control.
3. Expose `ambient`, `k`, and the lie-down `intensity`/half-angle as **PoC
   sliders**.
4. **Draw the cone and tint by threat** so it's legible.

## PoC test — what "the cone earns its keep" looks like

Tune sliders until:

1. `ambient ≈ 1` (radius): the herd moves, but come-by feels *mushy* — near and
   far sides both react, hard to aim. (Baseline to feel the difference against.)
2. Dial `ambient` down: come-by/away start to **peel the near edge cleanly**;
   stragglers can be picked off individually.
3. **Lie down at a narrow gate** visibly differs from walk-on — a calm, precise
   front-hold with no sideways spook. If this moment feels good, the cone is
   justified.
4. Sheep **bolt through the blind spots** you can see, and a come-by/away resets
   it. If bolting reads as *fair* (you saw the gap), the cone is doing its job.

Cross-reference: this refines the `eyeFactor` term in
[`force-model.md`](./force-model.md#4-flee--the-crux-predator-pressure-eye).
