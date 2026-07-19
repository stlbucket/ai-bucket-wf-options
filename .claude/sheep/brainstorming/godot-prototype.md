# Godot Prototype — 1 Dog vs 20 Sheep (2D)

A mock of how the smallest real prototype is structured in Godot. Goal: prove
**sim feel + command mapping + emergent behaviors** — not art, not backend, not
multi-dog UX. (No code here; this is the shape.)

The key principle carries over from [`README.md`](./README.md): a hard
**sim / render split**. The simulation is a pure GDScript class; nodes only
*render* it. That's what lets you port the tuned JS PoC math in 1:1 and, later,
swap 2D sprites for 3D models without touching the sim.

---

## Scene tree

```
Main (Node2D)
├── Field (Node2D)
│   ├── Ground (ColorRect / Sprite2D)
│   ├── Fences (Line2D)                 # visual; boundary lives in the sim as data
│   └── GoalPen (Area2D + CollisionShape2D)   # win detection (or a sim-side region test)
├── Flock (Node2D)                      # container
│   └── Sheep × 20                       # instances of Sheep.tscn
├── Dogs (Node2D)
│   └── Dog                              # instance of Dog.tscn
├── SimController (Node)                 # owns the FlockSim, ticks it, syncs nodes
├── CommandUI (CanvasLayer)
│   └── Control → 5 Buttons: Come By / Away / Walk On / Lie Down / That'll Do
└── Camera2D
```

---

## The sim layer: `FlockSim` (RefCounted, pure)

A plain `RefCounted` GDScript class — **no Node dependency**:

- Holds arrays: sheep positions/velocities/boldness, dog state (pos, vel, facing,
  command, target, intensity), fences, goal.
- `step(dt)` does exactly the loop in [`force-model.md`](./force-model.md):
  build neighbors → accumulate forces → integrate sheep → run dog steering.
- `set_command(dog_id, cmd)` sets a dog's behavior/target.

This class is the thing you copy from the JS PoC. It's headless and unit-testable.

---

## The render layer: `SimController` (Node)

Owns one `FlockSim`. In `_physics_process(dt)`:

1. `sim.step(dt)`
2. For each sheep node: `node.global_position = sim.sheep_pos[i]`;
   `node.update_anim(sim.sheep_vel[i])`
3. Sync the dog node (position, facing, lie-down state).
4. Win check: is the flock inside `GoalPen`?

Nodes are *dumb* — they display whatever the sim says.

---

## `Sheep.tscn`

```
Sheep (Node2D)                 # NOT CharacterBody2D — see below
└── AnimatedSprite2D           # frames: idle / walk / run
    (optional) Shadow (Sprite2D)
```

- Manual integration means **no physics body and no collision shape** — the sim's
  separation force handles spacing.
- `update_anim(vel)`: pick `idle/walk/run` by `|vel|`; set facing by rotation or
  `flip_h`.

**Why `Node2D`, not `CharacterBody2D`/`RigidBody2D`:** boids compute their own
velocity. Handing them to the physics solver makes it fight your steering and
tanks performance at flock scale. Manual `Vector2` integration is the standard
approach for flocking.

## `Dog.tscn`

```
Dog (Node2D)
├── AnimatedSprite2D           # frames: idle / walk / run / lie_down
└── (dev only) ThreatCone (Polygon2D / Line2D)   # visualize the gaze cone while tuning
```

## `Field`

- `Ground`: a `ColorRect` or `Sprite2D`.
- `Fences`: a `Line2D` for the visual; the actual boundary is data in the sim.
- `GoalPen`: an `Area2D` for win detection (or just a region test in the sim).

## `CommandUI`

`CanvasLayer → Control` with five `Button`s. Each emits a signal →
`SimController.set_command(dog_id, cmd)`. (Multi-dog later: a dog selector or
name buttons choose `dog_id`.)

---

## Animation (2D prototype)

`AnimatedSprite2D` frame sets, chosen by speed (`idle/walk/run`) plus a
`lie_down` state for the dog; heading via rotation or `flip_h`. **Blender is not
needed for the 2D prototype** — sprite frames or even colored triangles are
enough to read the flocking.

When you move to 3D later, only the render layer changes: swap in glTF characters
with an `AnimationTree` (blend `idle↔walk↔run`, plus a `lie_down` state), driven
by the same `FlockSim` output. See the animation-pipeline note in
[`README.md`](./README.md).

---

## Scaling path (20 → 150)

- Node-per-sheep is comfortable at 20–50.
- For 150+: drop per-sheep nodes for a single **`MultiMeshInstance2D`** (one draw
  call) fed from the sim's arrays; add a **spatial hash** for neighbors; consider
  moving `sim.step` to a thread or a compute shader.
- The sim/render split makes all of that a render-side swap — the sim is untouched.

---

## What this prototype proves (and doesn't)

**Proves:** the force model feels good; the five commands map to satisfying herd
behavior; compaction/split/collect/drive/bottleneck all emerge.

**Doesn't (deliberately):** final art, backend/fnb, multi-dog UX, 3D. Add those
only after the core is proven fun.
