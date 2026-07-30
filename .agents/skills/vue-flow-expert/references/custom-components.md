# Custom Nodes & Edges

Building custom node and edge components: resolution methods, the props each receives, the
`<Handle>` component, the custom edge implementation pattern, and the edge path utilities.

## Custom Nodes

Three resolution methods (in priority order):

### 1. Template Slots (simplest)
```vue
<VueFlow :nodes="nodes">
  <template #node-custom="props">
    <CustomNode v-bind="props" />
  </template>
</VueFlow>
```

### 2. nodeTypes Object (preferred for larger apps)
```vue
<script setup>
import { markRaw } from 'vue'
const nodeTypes = { custom: markRaw(CustomNode) }
</script>
<template>
  <VueFlow :node-types="nodeTypes" />
</template>
```

**Always wrap components with `markRaw()`** to prevent Vue from making the component definition reactive.

### 3. Global component registration (auto-resolved by name)

### Custom Node Props
A custom node component receives these props automatically:

| Prop | Type | Description |
|------|------|-------------|
| `id` | `string` | Unique identifier |
| `type` | `string` | Node type name |
| `data` | `any` | Your custom data object |
| `position` | `{ x, y }` | XY coordinates |
| `dimensions` | `{ width, height }` | Computed size |
| `selected` | `boolean` | Selection state |
| `dragging` | `boolean` | Drag state |
| `resizing` | `boolean` | Resize state |
| `zIndex` | `number` | Layer order |
| `sourcePosition` | `Position` | Default source handle side |
| `targetPosition` | `Position` | Default target handle side |
| `dragHandle` | `string` | CSS selector for drag handle |

### Handle Component
```vue
<script setup>
import { Handle, Position } from '@vue-flow/core'
defineProps(['sourcePosition', 'targetPosition', 'data'])
</script>

<template>
  <Handle type="target" :position="targetPosition" />
  <div>{{ data.label }}</div>
  <Handle type="source" :position="sourcePosition" />
</template>
```

**Handle props:**
- `type`: `'source' | 'target'`
- `position`: `Position.Top | Position.Right | Position.Bottom | Position.Left`
- `id`: required when multiple handles of the same type exist on a node
- `connectable`: `boolean | number | ((node, connectedEdges) => boolean)` — limits connections
- `isValidConnection`: `(connection: Connection) => boolean` — validate before connecting

**Special CSS classes in nodes:**
- `nowheel` — disables zoom/pan scroll on the element (for scrollable content)
- `nodrag` — prevents dragging when interacting with inputs, buttons, sliders

**Dynamic handles:** call `updateNodeInternals(['nodeId'])` from `useVueFlow` after adding/removing handles.

## Custom Edges

### Template Slots
```vue
<VueFlow :edges="edges">
  <template #edge-custom="props">
    <CustomEdge v-bind="props" />
  </template>
</VueFlow>
```

### edgeTypes Object
```js
const edgeTypes = { custom: markRaw(CustomEdge) }
```

### Custom Edge Props
| Prop | Type | Description |
|------|------|-------------|
| `id` | `string` | Unique identifier |
| `source` / `target` | `string` | Node IDs |
| `sourceNode` / `targetNode` | `GraphNode` | Full node objects |
| `sourcePosition` / `targetPosition` | `Position` | Handle sides |
| `sourceHandleId` / `targetHandleId` | `string \| null` | Handle IDs |
| `sourceX` / `sourceY` / `targetX` / `targetY` | `number` | Pixel coordinates |
| `data` | `any` | Custom data |
| `style` | `CSSProperties` | Inline styles |
| `label` | `string` | Edge label |
| `animated` | `boolean` | Animation state |
| `selected` | `boolean` | Selection state |
| `markerStart` / `markerEnd` | `MarkerType \| EdgeMarker` | Arrow markers |
| `curvature` | `number` | Bezier curvature |
| `interactionWidth` | `number` | Invisible click hitbox width |

### Custom Edge Implementation Pattern
```vue
<script setup>
import { computed } from 'vue'
import { BaseEdge, getBezierPath } from '@vue-flow/core'

const props = defineProps(['sourceX', 'sourceY', 'targetX', 'targetY',
  'sourcePosition', 'targetPosition', 'markerEnd', 'style'])

// getBezierPath returns [path, labelX, labelY, offsetX, offsetY].
// Do NOT array-destructure the computed() itself — a ComputedRef isn't iterable;
// keep the tuple in one computed and index it (template auto-unwraps .value).
const path = computed(() =>
  getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  })
)
</script>

<template>
  <BaseEdge :path="path[0]" :marker-end="markerEnd" :style="style" />
</template>
```

## Edge Path Utilities

All return `[path, labelX, labelY, offsetX, offsetY]`:

```js
import { getBezierPath, getSimpleBezierPath, getSmoothStepPath, getStraightPath } from '@vue-flow/core'

// Bezier (curvature-adjustable)
const [path, labelX, labelY] = getBezierPath({
  sourceX, sourceY, sourcePosition,
  targetX, targetY, targetPosition,
  curvature: 0.25,  // optional
})

// Simple bezier (no curvature control)
const [path] = getSimpleBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })

// Smooth step (right-angle with rounded corners)
const [path] = getSmoothStepPath({
  sourceX, sourceY, sourcePosition,
  targetX, targetY, targetPosition,
  borderRadius: 5,   // 0 = hard corners
  offset: 20,
  centerX, centerY,  // optional midpoint override
})

// Straight line
const [path] = getStraightPath({ sourceX, sourceY, targetX, targetY })
```
