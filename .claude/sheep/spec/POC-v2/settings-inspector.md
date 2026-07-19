# POC-v2 · Feature: Settings Inspector

**Status:** draft — awaiting review of the settings inventory (Appendix A).

Make every tunable in the sheep PoC **self-describing**. Today the PoC has ~64
tunables spread across 10 lil-gui folders, but ~half have no slider at all and
none carry a human-readable explanation. This feature adds a **single settings
schema** that becomes the source of truth for the whole tuning UI, plus two ways
to read what each setting does: **hover tooltips** in normal mode and a
**per-category detail grid** popup.

This is a fnb side-project — **no fnb DB/GraphQL/backend**. It also must honor the
POC's build invariants (one HTML file, one plain `<script>`, §1 SIM stays
DOM-free). See [Constraints](#constraints).

---

## Goals

1. **One schema, one source of truth.** A single in-file `SETTINGS` structure
   describes every tunable: key, category, label, type, default, valid values,
   unit, and a plain-English description. The `params` object **and** the lil-gui
   folders/controllers are **generated from it** — no more facts split between the
   `params` literal and the `gui.add(...)` calls.
2. **Complete coverage.** All ~64 params are documented, including the ~31 that
   currently have no slider, via an `exposed` flag.
3. **Hover to learn (normal mode).** Hovering a lil-gui control shows its
   description in a tooltip.
4. **Per-category reference popup.** Each lil-gui folder header gets an **ⓘ
   button**; clicking it opens a grid of every setting in that category with full
   detail (label, key, type, range, default, unit, current value, description).

## Non-goals (POC-v2)

- No editing from the popup grid — it is **read-only reference**; editing still
  happens through the lil-gui sliders. (Parked — see Open questions.)
- No search/filter across categories, no master "all settings" overlay (we chose
  per-folder ⓘ over a single tabbed overlay).
- Not adding new sliders for hidden params by default — `exposed` stays as it is
  today unless Appendix A flags a change. (Parked.)
- No change to §1 SIM behavior or the force model. This is tooling only.

---

## The settings schema (single source of truth)

An ordered array of entries lives at the top of §0. Shape of one entry:

```js
{
  key: 'r_sep',            // property name on params (or 'debug.eye' for nested)
  category: 'Boids',       // lil-gui folder (drives grouping + order)
  label: 'separation radius',
  type: 'float',           // 'float' | 'int' | 'boolean' | 'point'
  default: 18,
  min: 4, max: 60, step: 1, // omitted for boolean; point uses per-axis min/max
  unit: 'px',              // 'px' | 'px/s' | 'px/s²' | 'rad/s' | 's' | '—'
  description: 'How close two sheep tolerate before pushing apart.',
  exposed: true,           // false = documented but no slider
  export: true,            // false = excluded from the P7 params JSON export (e.g. debug)
  onChange: 'respawn'      // optional named hook (see below); most omit it
}
```

**Generation rules — the schema drives the app:**

- **`params` defaults:** at boot, build `params` by reducing `SETTINGS` → for each
  entry set `params[key] = default` (respecting nested keys like `debug.eye` and
  `point` values `{x,y}`). §1 SIM still receives the resulting plain `params`
  object exactly as today; it never sees the schema.
- **lil-gui folders:** iterate `SETTINGS` in order; create each `category` folder
  once (first appearance, in array order), then for every `exposed` entry add the
  right controller — `float`/`int` → `add(params, key, min, max, step)`,
  `boolean` → `add(...)`, `point` → an x and a y controller. `label` sets the
  controller name.
- **onChange hooks:** a few controls need side effects (e.g. `sheepCount` respawns
  the herd, `fenceInset` may relayout). The generator looks up a small
  `HOOKS = { respawn(){…}, … }` table by the entry's `onChange` name and wires it.
  This preserves today's special bindings without hardcoding them in the loop.
- **Export stays consistent:** the P7 "export params as JSON" emits only entries
  with `export: true` (so debug toggles stay out, as they do today).

The schema is **dev-tooling metadata**, not part of the Godot-bound SIM. The
salvage path is unchanged: export the resolved `params` **values** (already
supported) and lift §1. The `SETTINGS` array itself is throwaway.

---

## UI

### 1. Hover tooltip (normal mode)
Each generated controller shows its `description` on hover. Use a **small custom
styled tooltip** (a positioned `<div>`), not the native `title=` attribute —
native is slow to appear and unstyleable. Attach on the controller's
`.domElement`; show on `mouseenter`, hide on `mouseleave`. Tooltip also shows the
unit and range as a secondary line (e.g. `px · 4–60`).

### 2. Per-category detail grid (ⓘ button)
- Add an **ⓘ button** into each lil-gui folder's title row (the folder header
  `.title` element).
- Clicking it opens a **modal grid** for that category — a dismissible overlay
  (click-outside / Esc / ✕ closes). Only one open at a time.
- Grid columns: **Label · key · type · range (min–max·step, or true/false) ·
  default · unit · current value · description**. `current value` reads live from
  `params` at open time. Non-`exposed` rows are shown too (marked e.g. a muted
  "no slider" tag) so the grid is the complete reference for the category.
- Styling: reuse the throwaway HUD/panel CSS idiom; a clean table with sticky
  header, zebra rows, monospace for keys/values. Lives in §2 RENDER / §3 INPUT
  (DOM side) — never in §1.

---

## Constraints

- **Single file, one plain `<script>`.** The schema is an **inline JS literal**,
  not a separate `.json` file (can't `fetch` from `file://`, and the one-file rule
  forbids it). It is JSON-shaped and could be serialized out later if wanted.
- **§1 SIM stays DOM-free.** Schema parsing, `params` generation wiring, tooltips,
  and the grid modal all live in §0 / §2 / §3 — the SIM only ever consumes the
  resulting `params` values.
- **Page runs by double-click**, no console errors, after this feature lands.
- **lil-gui UMD** (`window.lil.GUI`) unchanged; we extend its DOM (folder titles)
  rather than replace it.

---

## Acceptance criteria

1. Deleting the old hand-written `gui.addFolder/add` block and the `params`
   literal, the app still boots identically — folders, sliders, ranges, and
   defaults all come from `SETTINGS`.
2. Every entry in Appendix A is present in `SETTINGS` with a description; the ~31
   currently-hidden params are documented (even if `exposed:false`).
3. Hovering any slider shows its description + unit/range tooltip.
4. Each folder header has an ⓘ button; clicking opens that category's grid with
   correct live current-values and closes cleanly.
5. `sheepCount` (and any other hooked control) still triggers its side effect.
6. Export still emits `export:true` values only; §1 SIM untouched.

---

## Open questions (parked — default in **bold**)

1. **Editable grid?** Popup is **read-only** for v2; revisit making current-value
   cells editable later.
2. **Expose the hidden ones?** Keep `exposed` **as-is today** (schema documents
   all, sliders unchanged). Appendix A can flag specific params to promote to
   sliders — call them out on review.
3. **Tooltip mechanism** — **custom styled div** (chosen) vs native `title`.
4. Should `Stage`/`Sim` structural values (`canvasW`, `dt`, `seed`) be shown as
   **read-only rows** in the grid but never get sliders? (Assumed yes.)

---

## Appendix A — settings inventory (review this)

Proposed schema content. Descriptions are enriched from the current inline
comments; **please correct any that are wrong before we plan/implement.** `exp?`
= currently has a slider. Ranges for exposed rows are today's slider bounds;
ranges for hidden rows are proposals. Units: px, px/s, px/s², rad/s, s, — .

### Stage
| key | label | type | default | range | unit | exp? | description |
|---|---|---|---|---|---|---|---|
| canvasW | canvas width | int | 1120 | — | px | no | Field width; structural (read-only). |
| canvasH | canvas height | int | 720 | — | px | no | Field height; structural (read-only). |
| fenceInset | fence inset | int | 20 | 0–60·1 | px | yes | Play-area border margin inside the canvas. |
| L | body length | int | 12 | — | px | no | One sheep body-length; the unit most radii derive from. |

### Sheep
| key | label | type | default | range | unit | exp? | description |
|---|---|---|---|---|---|---|---|
| sheepCount | herd size | int | 20 | 1–150·1 | — | yes* | Number of sheep; changing it respawns the herd. |
| vMax | max speed | float | 90 | 20–240·5 | px/s | yes | Top sheep speed. |
| grazeSpeed | graze speed | float | 15 | 0–60·1 | px/s | yes | Gentle wander cruising speed when undisturbed. |
| damping | damping | float | 0.9 | 0.5–0.99·0.01 | — | yes | Velocity retained per tick (drag). |
| wanderTurn | wander turn rate | float | 1.5 | 0–4·0.1 | rad/s | no | How fast graze heading random-walks. |

\* `sheepCount` is exposed but wired in §4 with a respawn hook (`onChange:'respawn'`).

### Boids
| key | label | type | default | range | unit | exp? | description |
|---|---|---|---|---|---|---|---|
| r_sep | separation radius | float | 18 | 4–60·1 | px | yes | Distance below which sheep push apart. |
| minSep | min-separation clamp | float | 4 | 1–20·1 | px | yes | Floor on separation distance so inverse-square can't explode. |
| cohN | cohesion neighbors | int | 10 | 1–20·1 | — | yes | How many nearest neighbors define the local center (topological). |
| cohScale | cohesion scale | float | 100 | 10–160·5 | px | yes | Spring range easing a sheep toward its local center of mass. |
| r_align | alignment radius | float | 36 | 6–120·1 | px | yes | Range over which sheep match heading. |
| w_sep | separation weight | float | 1.5 | 0–4·0.1 | — | yes | Strength of the push-apart force. |
| w_coh | cohesion weight | float | 1.0 | 0–4·0.1 | — | yes | Strength of the pull-together force. |
| w_align | alignment weight | float | 0.2 | 0–2·0.05 | — | yes | Strength of heading-matching (weak — sheep aren't starlings). |
| w_graze | graze weight | float | 0.3 | 0–2·0.05 | — | yes | Strength of the idle wander force. |
| accelScale | accel scale | float | 250 | 0–800·10 | px/s² | yes | Global responsiveness: accel per unit steering force. |

### Flee / Eye
| key | label | type | default | range | unit | exp? | description |
|---|---|---|---|---|---|---|---|
| dogVMax | dog max speed | float | 135 | 40–300·5 | px/s | no | Top dog speed (≈1.5× sheep). |
| R_flee | flee radius | float | 120 | 40–300·5 | px | yes | Distance within which the dog scares sheep. |
| w_flee | flee weight | float | 2.0 | 0–5·0.1 | — | yes | Strength of the run-from-dog force. |
| ambient | eye ambient floor | float | 0.2 | 0–1·0.05 | — | yes | 1 = pure radius threat, 0 = pure gaze-cone threat. |
| coneK | eye cone tightness | float | 2 | 0.5–8·0.5 | — | yes | How focused the dog's "eye" cone is (cosᵏ). |

### Dog
| key | label | type | default | range | unit | exp? | description |
|---|---|---|---|---|---|---|---|
| R_orbit | orbit radius | float | 160 | 60–300·5 | px | yes | Come-by/away standoff distance around the flock center. |
| omega | orbit speed | float | 1.2 | 0.2–3·0.1 | rad/s | yes | How fast the dog circles during come-by/away. |
| R_drive | drive standoff | float | 140 | 80–260·5 | px | yes | Walk-on standoff behind the flock. |
| driveShrink | drive shrink rate | float | 10 | 0–40·1 | px/s | yes | How fast walk-on closes that standoff over time. |
| R_driveMin | drive standoff floor | float | 55 | 40–160·5 | px | yes | Closest walk-on gets before stopping (don't walk into the blob). |
| lieDownIntensity | lie-down intensity | float | 0.3 | 0–1·0.05 | — | yes | Residual dog pressure while lying down. |
| goal | goal / pen center | point | {970,360} | x 820–1100, y 20–700 | px | no | Where the flock is being driven. |

### Gate + Crush
| key | label | type | default | range | unit | exp? | description |
|---|---|---|---|---|---|---|---|
| fenceX | fence x | int | 820 | 600–1000·5 | px | no | Interior fence line; goal pen is x > fenceX. |
| gateY | gate center y | int | 360 | 20–700·5 | px | no | Vertical center of the gate gap. |
| gateWidth | gate width | int | 30 | 12–60·1 | px | yes | Gate opening size. |
| w_fence | fence weight | float | 1.5 | 0–4·0.1 | — | yes | Strength of fence repulsion. |
| r_fence | fence range | float | 30 | 10–80·1 | px | yes | Distance at which the fence pushes sheep. |
| spawnMinX | spawn box min x | int | 220 | 20–800·5 | px | no | Left edge of the herd's start box. |
| spawnMaxX | spawn box max x | int | 500 | 20–800·5 | px | no | Right edge of the herd's start box. |
| crushRadius | crush radius | float | 40 | 20–80·1 | px | yes | Gate-mouth neighborhood used to measure crush. |
| crushThreshold | crush threshold | float | 1.5 | 0.5–8·0.1 | — | yes | Density×pressure above which sustained crush injures (calibrated P5). |
| crushSustain | crush sustain | float | 0.8 | 0–3·0.1 | s | no | Seconds over threshold before an injury event fires. |

### Boldness
| key | label | type | default | range | unit | exp? | description |
|---|---|---|---|---|---|---|---|
| boldnessTheta | boldness hold | float | 0.5 | 0–1.5·0.05 | — | yes | Sheep ignores the dog while threat < boldness·θ. |
| panicThreshold | panic threshold | float | 0.6 | 0.2–1·0.05 | — | yes | Threat above this triggers a panic sprint (enables bolting). |
| panicMult | panic multiplier | float | 1.6 | 1–2.5·0.1 | — | yes | vMax multiplier while panicking. |
| protestProb | protest chance | float | 0.6 | 0–1·0.05 | — | no | Per-second chance a brave sheep protests just below threshold. |
| protestDur | protest duration | float | 0.3 | 0–1·0.05 | s | no | How long a protest stamp lasts. |

### Scoring
| key | label | type | default | range | unit | exp? | description |
|---|---|---|---|---|---|---|---|
| w_time | time penalty | float | 0.1 | 0–1·0.01 | — | yes | Points lost per second of run time. |
| w_line | line penalty | float | 0.4 | 0–0.01·0.0005 | — | yes | Points lost per second fully off the ideal path. |
| w_cohesion | cohesion penalty | float | 0.4 | 0–3·0.1 | — | yes | Points lost per straggler-fraction-second (+1.5× per split). |
| w_calm | calm penalty | float | 0.6 | 0–5·0.1 | — | yes | Points lost per second of full flock panic. |
| injuryWeight | injury weight | float | 5 | 0–20·0.5 | — | no | Stress-seconds equivalent charged per injury. |
| lineNorm | line norm | float | 150 | 20–400·5 | px | no | Path deviation that counts as "fully off-line". |
| T_straggle | straggle time | float | 3.0 | 0–6·0.5 | s | yes | Seconds outside the blob before a sheep counts as a straggler. |
| splitMinSize | split min size | int | 3 | 2–8·1 | — | yes | Min cluster size to count as a real sub-flock. |
| clusterDist | cluster link dist | float | 70 | 20–160·5 | px | no | Link distance for cluster/split detection. |

### Debug (render toggles — `export:false`)
| key | label | type | default | unit | exp? | description |
|---|---|---|---|---|---|---|
| debug.eye | flee cone + R_flee | boolean | true | — | yes | Draw the dog's gaze cone and flee radius. |
| debug.velocity | velocity vectors | boolean | false | — | yes | Draw per-sheep velocity arrows. |
| debug.neighbors | neighbor links | boolean | false | — | yes | Draw alignment-neighbor links. |
| debug.gcm | flock GCM | boolean | false | — | yes | Draw the flock's center of mass. |
| debug.dogTarget | dog target | boolean | false | — | yes | Draw the dog's current steering target. |
| debug.state | collect / drive | boolean | false | — | yes | Label the dog's current collect/drive state. |

### Sim (structural — mostly read-only)
| key | label | type | default | range | unit | exp? | description |
|---|---|---|---|---|---|---|---|
| seed | PRNG seed | int | 1337 | — | — | no | Seed for reproducible runs (reseed via the reseed button). |
| dt | fixed timestep | float | 0.0167 | — | s | no | Fixed simulation step (1/60 s). |
| maxFrameDelta | max frame delta | float | 0.25 | — | s | no | Clamp on real elapsed time to prevent spiral-of-death. |
