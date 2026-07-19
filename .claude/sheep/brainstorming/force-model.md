# The Force Model

The heart of the game. Sheep are **boids** with an added **flee** force from
dogs; dogs are **steering agents** whose target is set by the player's command.
Everything you described — compaction, splitting, stragglers, protests, bolting,
gate bottlenecks — is *emergent* from the rules below, not scripted.

All math is 2D `Vector2`. Integrate manually (don't hand sheep to a physics
engine — it will fight the steering and won't scale).

---

## Per-tick loop (fixed timestep `dt`)

For each sheep `i` with position `p_i`, velocity `v_i`:

1. Gather neighbors (topological: the `n` nearest; and/or metric: within a radius).
2. Accumulate acceleration `a_i = Σ_k w_k · F_k` (each `F_k` a steering vector).
3. `v_i ← clampLen((v_i + a_i·dt) · damping, v_max)`
4. `p_i ← p_i + v_i·dt`
5. Update facing = `normalize(v_i)`; pick anim by `|v_i|`.

Dogs run their own steering (see **Dog steering** below) in the same loop.

---

## The forces on a sheep

### 1. Separation — internal pressure, and why the blob can split
Repulsion from close neighbors, blowing up at short range so sheep never overlap:

```
F_sep = Σ_{j : |p_i−p_j| < r_sep}  (p_i − p_j) / |p_i − p_j|²
```

Inverse-square makes it a soft wall. This is what pushes back against
compaction and, under bad pressure, drives a **split**.

### 2. Cohesion — compaction, and re-forming
Attraction to the local center of mass of the `n` nearest neighbors
(**topological** — robust as density changes, which it constantly does here):

```
c_i   = mean(p_j) over the n nearest j        // n ≈ 10
F_coh = normalize(c_i − p_i)
```

### 3. Alignment — flow (keep this weak for sheep)
Steer toward neighbors' average heading. Sheep align *far* less than birds, so a
low weight:

```
F_align = normalize( mean(v_j) over j within r_align )
```

### 4. Flee — the crux (predator pressure / "eye")
For each dog `d` within `R_flee` of the sheep:

```
dir  = normalize(p_i − p_d)
dist = |p_i − p_d|
g    = falloff(dist)                 // 0 at edge → 1 at contact
T    = g · eyeFactor(d, i) · dogIntensity(d)
F_flee += dir · T
```

- **`falloff(dist)`** — a tunable "wall." Start with `smoothstep(R_flee, 0, dist)`
  or clamped `(R_flee/dist − 1)`. This controls how sharply pressure ramps as the
  dog closes.
- **`eyeFactor`** — models the stare-down (directional "eye"). Use the
  **ambient-cone hybrid**:
  `eyeFactor = ambient + (1 − ambient)·max(0, cos θ)^k`, where `θ` is the angle
  between the dog's facing and the direction to the sheep. `ambient` slides from
  `1.0` (pure radius, facing irrelevant) to `0.0` (pure cone); start `~0.2`,
  `k ≈ 2`. Full rationale, facing derivation, and multi-dog implications in
  [`threat-model.md`](./threat-model.md).
- **`dogIntensity`** — `1` normally, dropped (≈`0.3`) on **lie down** so pressure
  eases at bottlenecks.

### 5. Boldness gate — "brave sheep protest, then back down or bolt"
Each sheep carries `boldness b_i ∈ [0,1]` (randomized at spawn). Let
`T_total = Σ` threats from all dogs:

- `T_total < b_i·θ_hold` → sheep ignores the dog and grazes.
- Just below threshold → small chance of a **protest**: a brief step *toward* the
  dog (a stamp) before fleeing.
- Otherwise → flee normally. When `T_total` is high, a **panic multiplier** on
  `v_max` gives the sprint.

**Bolting past the dog** needs no special case: when a fleeing sheep's `F_flee`
points through a gap in the dog's coverage, it accelerates into the hole. The
panic multiplier just makes it dramatic — and, as you said, forces a come-by/away
to reset.

### 6. Grazing / wander (undisturbed behavior)
When no dog is near: a smoothed random walk + a weak pull toward good grass /
field center, at low speed. (Strömbom uses ~0.05 probability of moving per tick
while grazing.) Low weight.

### 7. Fence / boundary
Repulsion from the nearest wall within `r_fence` (inverse distance) plus a hard
position clamp at the boundary.

### 8. Inertia / damping
Velocity carries over; a `damping ≈ 0.9` factor per tick models friction. An
optional heading-inertia term (blend new accel with previous heading) mirrors
Strömbom's `h` term and smooths jitter.

---

## Grounding in Strömbom et al. 2014 (starting reference values)

Their discrete, heading-based shepherd model produces exactly this behavior with
a single shepherd. Published parameters (units = body-lengths / steps — adapt to
your world scale and `dt`):

| Symbol | Meaning | Value |
|---|---|---|
| `r_a` | agent–agent repulsion distance | `2` |
| `ρ_a` | strength of agent repulsion | `2` |
| `c`   | strength of attraction to local CoM | `1.05` |
| `R_s` | shepherd detection distance (sheep react within) | `65` |
| `ρ_s` | strength of repulsion from shepherd | `1` |
| `h`   | heading inertia | `0.5` |
| `e`   | angular noise | `0.3` |
| `δ`   | sheep step per tick | `1` |
| `δ_s` | shepherd step per tick | `1.5` (faster than sheep) |
| graze | prob. of moving while grazing | `0.05` |
| `f(N)`| "is the flock cohesive?" radius threshold | `r_a · N^(2/3)` |

`f(N)` is the trick behind **collect vs drive**: if every sheep is within
`f(N)` of the global center of mass (GCM), the flock is cohesive → *drive*;
otherwise → *collect* the furthest outlier first.

---

## Emergent behaviors → mechanism (design ↔ physics)

| You described | Comes from |
|---|---|
| **Compaction** | Dog pressure on the near side → inward flee → local density rises → cohesion + all-sides shrinking outpaces separation. Come-by's *moving* pressure point walks the whole blob across the field. |
| **Blob splits under bad pressure** | Pressure into the *middle* (or two dogs pinching) → flee vectors point opposite ways → two separate CoMs → cohesion splits the blob. This is "too much pressure at the wrong point." |
| **Stragglers collected** | The come-by/away arc passes *behind* outliers; their flee shoves them toward the mass; they rejoin once inside cohesion range. (= Strömbom **collect**.) |
| **Walk-on drives the herd** | Dog sits behind the blob on the blob→goal axis and creeps; steady low pressure moves the whole blob forward. (= Strömbom **drive**.) |
| **Gate bottleneck / accidents** | Many sheep + a narrow goal → separation vs forward pressure → pile-up; **lie down** cuts `dogIntensity` so the front trickles through. Overpressure here is a natural **failure/injury** hook. |
| **Protest, then back down or bolt** | The boldness gate + panic sprint + gaps in dog coverage. |

---

## Dog steering (command → target → seek)

The dog is a seek/arrive steering agent with obstacle avoidance. The **player's
command sets its target/behavior** — the player never touches a sheep.

Let `GCM` = flock centroid, `goal` = target pen.

| Command | Dog target / behavior |
|---|---|
| **Come by** | A point on an orbit circle of radius `R_orbit` around `GCM`; angle advances **clockwise** at rate `ω`. Keep standoff ≥ `R_orbit` so the dog stays *outside* the blob. Arrive-slow near the point. |
| **Away** | Same, **counter-clockwise**. |
| **Walk on** | A point on the line `GCM → goal`, at distance `R_drive` *behind* `GCM` (opposite the goal); `R_drive` shrinks slowly → creep in. Dog faces the herd. |
| **Lie down** | Target = current position (stop). `dogIntensity ↓`. Hold facing toward `GCM`. |
| **That'll do** | Target = owner position. Flee still applies en route until the dog exits `R_flee`. |

Multi-dog: each dog has its own command/target; saying a **dog's name** just
selects which dog the next command applies to.

**The whole game in one line:**
`player button → dog command → dog target → dog steering → dog position+facing → sheep flee → flock motion.`

---

## Tuning table (starting guesses — the PoC's job is to find the fun)

| Param | Start | Note |
|---|---|---|
| `r_sep` | 1.5 × bodyLen | high weight |
| cohesion `n` | 10 nearest | topological |
| `w_coh` | ~1 | medium |
| `r_align` | 3 × bodyLen | |
| `w_align` | ~0.2 | sheep align weakly |
| `R_flee` | 8–12 × bodyLen | high weight; `smoothstep` falloff |
| eye half-angle | ~60°, `k≈2` | if using the gaze cone |
| `boldness b_i` | ~N(0.3, 0.1) clamped | per-sheep variation |
| sheep `v_max` | — | dog `v_max` ≈ 1.5× sheep |
| `damping` | 0.9 | |
| `dt` | fixed 1/60 | |

None of these are sacred — bind them to sliders in the PoC and dial for feel.

---

## Integration & performance notes

- **Fixed-timestep accumulator** so physics is framerate-independent.
- **Neighbor lookup**: brute-force O(n²) is fine to ~50 agents; use a **spatial
  hash grid** (cell ≈ largest interaction radius) for 150+.
- Topological neighbors = partial sort for the `n` smallest distances.
- Everything is `Vector2`. No physics bodies — you own the integration.
