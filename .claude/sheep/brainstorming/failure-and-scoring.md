# Failure & Scoring — Arcade Tension vs. Zen Flow

Does this game punish you (timed, fail states, pressure) or soothe you (calm,
mastery, no hard fail)? As with the threat model, the honest answer is **not a
binary** — and sheep herding is unusually lucky here, because a single
**multi-axis, subtractive score** naturally *is* both games depending on how the
player engages it.

**Bottom line up front:** score by *eroding a perfect run* across four axes
(time, line, cohesion, **calm/welfare**), gate progress with **stars**, not
pass/fail, and let a **mode toggle** decide whether time and hard-faults actually
end the run. Same scoring code serves the arcade player and the zen player.

---

## Steal the real sport's model: subtractive scoring

Real sheepdog trials (ISDS) don't *accumulate* points — you **start perfect and
lose points for faults**: sheep off the line, a missed gate/panel, a dog that
*grips* (bites — heavy penalty or disqualification), a break, sloppy pen work,
all under a time limit. Perfection is the ceiling; every mistake chips at it.

That model is a gift for this game:

- It frames the score as **"how clean was your run,"** which is exactly the
  fantasy of masterful, invisible-hand herding.
- **Gripping = your overpressure/injury fault.** The sport already treats "the
  dog was too rough" as the cardinal sin — which is thematically the whole point
  (you win through *intimidation, never contact*).
- Subtractive scores make **leaderboards and 3-star chases** legible: a run is a
  single number below a perfect par.

---

## The four scoring axes (and the tension that carries the game)

| Axis | Measures | Penalty accrues when… |
|---|---|---|
| **Time** | how long the task took | always ticking (a soft cost, or a hard limit in Trial mode) |
| **Line** | how close the flock's centroid stayed to the *ideal path* | deviation area between actual and ideal line grows |
| **Cohesion** | did the blob stay whole | splits, persistent stragglers, scatter |
| **Calm / welfare** | how *stressed* the sheep were | aggregate flee/panic intensity over time; injuries |

The **welfare axis is the secret weapon.** The entire fiction is that you never
touch the sheep — so *scoring their stress* makes the theme mechanical. And it
sits in direct **tension with time**: you *can* rush by cranking pressure and
terrifying the flock, but a masterful run is *calm*. Fast vs. calm is the deep
choice at the center of every moment — overpressure is quick but stressful and
risky; patience is slow but clean. **Good scoring rewards the balance, and
difficulty just re-weights the axes.**

---

## Failure taxonomy (three tiers)

**Tier 1 — Recoverable faults (live point erosion, always recoverable):**
- *Off-line*: centroid deviates from the ideal path → deviation penalty per tick.
- *Stress*: high aggregate flee intensity → welfare penalty per tick.
- *Straggler*: a sheep outside the main blob's cohesion radius for > `T_straggle`.
- *Split*: two+ clusters each above a size threshold → penalty until recombined.

**Tier 2 — Hard faults (big one-time hit, run continues):**
- *Escape*: a sheep crosses the field boundary → penalty; retrieve it or forfeit
  those points.
- *Injury at a bottleneck*: crush pressure exceeds threshold → a sheep goes down.
  Large welfare hit. **(The hook — detailed below.)**

**Tier 3 — Run-ending (level fail):**
- Time fully expires **(Trial mode only)** with sheep not penned.
- Full scatter beyond recovery (all clusters small & dispersed > `T_scatter`).
- Optional: a severe injury — though **injury-as-penalty reads better than
  injury-as-death** for this game's tone. Keep death out unless you want it grim.

---

## The star of the show: injury at the bottleneck ↔ lie down

This is the closed loop that gives **lie down** its entire purpose.

**The setup.** At a narrow gate, three things collide: forward pressure
(walk-on / dogs pushing from behind), separation among many bodies, and a small
aperture. Local density spikes at the mouth of the gate.

**The crush metric.** Define, at the aperture:

```
crush = local_density × forward_pressure
```

If `crush > crush_threshold` for a sustained moment → an **injury event**: a
sheep goes down (big welfare penalty; it becomes an obstacle you must work
*around*, compounding the tangle).

**The counter = lie down.** Lie down drops `dogIntensity` and narrows the cone
(see [`threat-model.md`](./threat-model.md)), *releasing* forward pressure so the
front of the herd **trickles** through instead of piling up. So the gate skill is
a **rhythm**:

> drive up to the gate → **lie down** → let the front bleed through →
> **walk on** to top up the pressure → **lie down** again → repeat.

The injury mechanic is what makes that rhythm *matter*. Without a crush penalty,
lie-down is pointless and players would just bulldoze the gate. **The failure
state is what gives the command meaning** — that's the design win.

**Readability (mandatory).** Make crush *visible before* it injures: the gate
mouth reddens / heats up, sheep visibly bunch and jostle, agitated bleating rises
in pitch. The player must be able to read the danger and hit lie-down *in time*,
or the injury feels unfair.

---

## Two modes, one scoring engine

Don't build two games — toggle two behaviors on the same code:

- **Trial mode (arcade tension):** hard time limit, full fault card, leaderboards,
  3-star chase. Time is a guillotine; a botched pen can fail the run.
- **Practice / Zen mode (flow):** no time limit, no run-fail (except maybe full
  scatter), score still shown but non-punitive, instant retry. For learning and
  for the meditative players.

Identical scoring underneath; the mode just decides whether **time** and
**Tier-3 faults** end the run. This is how the same simulation lands as either a
tense speedrun or a calm mastery toy.

---

## Stars, not pass/fail — and difficulty as axis-weighting

- Grade each level **1–3 stars** from the subtractive score. Zen players clear at
  1 star and move on; completionists chase 3 (which demands calm **and** fast
  **and** clean — the axes fight each other, so 3 stars is real mastery).
- **Difficulty = thresholds and weights, not new mechanics** (matches the
  "physics dials TBD" note): early levels have generous par, no hard time, a
  forgiving `crush_threshold`; later levels tighten time, narrow gates, add
  flighty low-boldness sheep, and **weight welfare harder** so rushing stops
  working. Same sim throughout.

---

## Feedback & the post-run "judge's card"

- **Live:** a welfare/stress meter, the ideal-path line shaded by deviation,
  rising bleating with stress, the gate crush indicator. Erosion should be
  *felt*, not just tallied.
- **Post-run:** a trial-style breakdown — Time / Line / Cohesion / Calm, each
  fault itemized, → total → stars. Turns every run into a legible "here's where I
  bled points" lesson, which is what drives the 3-star replay loop.

(Determinism note from [`README.md`](./README.md): a run = `seed + command log`,
so scores are replayable and server-verifiable — but that's a backend concern for
later, per project rules.)

---

## Recommendation

1. **Subtractive score** over four axes: **Time, Line, Cohesion, Calm/welfare.**
2. **Stars, not pass/fail**; difficulty = re-weighting axes + tightening
   thresholds.
3. **Mode toggle** (Trial vs. Zen) over one scoring engine — resolves the
   arcade/zen fork without splitting the design.
4. Build the **crush → injury** fault and pair it tightly with **lie down**; make
   crush **visible before** it triggers.
5. Center everything on the **fast-vs-calm** tension — it's the soul of the game.

## PoC test — what to prove

The 1-v-20 PoC is mostly about *feel*, but you can validate the scoring spine
cheaply:

1. Add a **stress meter** = aggregate flee intensity. Confirm a rushed run spikes
   it and a patient run keeps it low — i.e. the fast/calm tension is *real and
   felt*, not just a number.
2. Put one **narrow gate** in the field. Confirm bulldozing it triggers a visible
   **crush**, and that **lie down** relieves it and lets the front trickle. If
   that moment reads clearly, the injury↔lie-down loop works.
3. Sanity-check the **four-axis breakdown** on a couple of runs: does a
   fast-but-stressful run and a slow-but-calm run produce *interestingly
   different* cards? If yes, the scoring has the depth to carry stars.

Cross-reference: the crush/lie-down mechanic builds on `dogIntensity` and the
gaze cone in [`force-model.md`](./force-model.md) and
[`threat-model.md`](./threat-model.md).
