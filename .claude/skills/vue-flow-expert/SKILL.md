---
name: vue-flow-expert
description: Expert guidance for Vue Flow, the Vue 3 library for building interactive flowcharts, node-based editors, and graph visualizations. Use this skill whenever the user is working with @vue-flow/core or related packages — including setting up the VueFlow component, defining nodes and edges, creating custom node/edge components, using composables (useVueFlow, useNode, useEdge), configuring viewport/pan/zoom, wiring up connections, using built-in components (Background, MiniMap, Controls, NodeResizer, NodeToolbar), edge path utilities, or TypeScript types. Also covers automatic graph layout with elkjs (ELK layered layouts, compound/nested graphs). NOTE: the fnb wf UOW canvas that used this retired 2026-07-17 with the workflow dashboard — no @vue-flow/elkjs consumers remain in-repo; this is a generic technology reference for future canvases. Trigger on "flow diagram", "node graph", "visual editor", "drag-and-drop graph", "auto-layout", "elk", or any Vue Flow API by any spelling.
---

# Vue Flow Expert

Vue Flow is a Vue 3 library for building interactive node-based graphs, flow diagrams, and visual editors. It provides built-in dragging, zooming, panning, and selection; reactive state via `useVueFlow`; and an extensible component model for custom nodes and edges.

**Official docs:** https://vueflow.dev/guide/  
**MIT License** — Copyright © 2021-present Burak Cakmakoglu

---

## Packages

| Package | Purpose | Styles |
|---------|---------|--------|
| `@vue-flow/core` | Core component and composables | `dist/style.css` (required) + `dist/theme-default.css` (optional) |
| `@vue-flow/background` | Background pattern component | none |
| `@vue-flow/minimap` | MiniMap component | `dist/style.css` (required, not in default theme) |
| `@vue-flow/controls` | Controls component | `dist/style.css` (required, not in default theme) |
| `@vue-flow/node-resizer` | NodeResizer component | `dist/style.css` (required) |
| `@vue-flow/node-toolbar` | NodeToolbar component | none |

**Prerequisites:** Node.js v20+, Vue 3.3+

```bash
pnpm add @vue-flow/core
```

---

## Core Concepts

A Vue Flow graph has two primitive types:

- **Node** — requires `id` (string, unique) and `position: { x, y }`. Optional: `type`, `data`, `label`, `style`, `class`, `draggable`, `connectable`, `selectable`, `sourcePosition`, `targetPosition`, `parentNode`, `extent`, `zIndex`, `dragHandle`.
- **Edge** — requires `id`, `source` (node id), `target` (node id). Optional: `type`, `sourceHandle`, `targetHandle`, `label`, `data`, `style`, `animated`, `markerStart`, `markerEnd`, `updatable`, `selectable`, `zIndex`.

---

## Basic Setup

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { VueFlow } from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

const nodes = ref([
  { id: '1', type: 'input', position: { x: 0, y: 0 }, data: { label: 'Start' } },
  { id: '2', position: { x: 0, y: 150 }, data: { label: 'Middle' } },
  { id: '3', type: 'output', position: { x: 0, y: 300 }, data: { label: 'End' } },
])

const edges = ref([
  { id: 'e1-2', source: '1', target: '2' },
  { id: 'e2-3', source: '2', target: '3' },
])
</script>

<template>
  <div style="height: 500px">
    <VueFlow :nodes="nodes" :edges="edges" fit-view-on-init />
  </div>
</template>
```

**VueFlow must have an explicit height** — it fills its container, which must have a defined height.

---

## VueFlow Component Props (key selection)

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `nodes` | `Node[]` | `[]` | Node definitions |
| `edges` | `Edge[]` | `[]` | Edge definitions |
| `node-types` | `Record<string, Component>` | — | Custom node type map |
| `edge-types` | `Record<string, Component>` | — | Custom edge type map |
| `fit-view-on-init` | `boolean` | `false` | Auto-fit on mount |
| `apply-default` | `boolean` | `true` | Auto-apply node/edge changes |
| `connection-mode` | `'loose' \| 'strict'` | `'loose'` | Handle connection rules |
| `snap-to-grid` | `boolean` | `false` | Snap nodes to grid |
| `snap-grid` | `[number, number]` | `[15, 15]` | Grid size |
| `zoom-on-scroll` | `boolean` | `true` | Scroll to zoom |
| `zoom-on-pinch` | `boolean` | `true` | Pinch to zoom |
| `zoom-on-double-click` | `boolean` | `true` | Double-click to zoom |
| `pan-on-drag` | `boolean` | `true` | Drag to pan |
| `pan-on-scroll` | `boolean` | `false` | Scroll to pan |
| `min-zoom` | `number` | `0.5` | Minimum zoom level |
| `max-zoom` | `number` | `2` | Maximum zoom level |
| `default-viewport` | `Viewport` | — | Initial zoom/position |
| `nodes-draggable` | `boolean` | `true` | Global drag toggle |
| `nodes-connectable` | `boolean` | `true` | Global connection toggle |
| `elements-selectable` | `boolean` | `true` | Global selection toggle |
| `select-nodes-on-drag` | `boolean` | `true` | Select on drag |
| `elevate-edges-on-select` | `boolean` | `false` | Raise edge z-index on select |
| `only-render-visible-elements` | `boolean` | `false` | Skip off-screen rendering |
| `delete-key-code` | `string` | `'Backspace'` | Delete key |
| `selection-key-code` | `string` | `'Shift'` | Selection rectangle key |
| `multi-selection-key-code` | `string` | `'Meta'` | Multi-select key |
| `default-edge-options` | `Partial<Edge>` | — | Defaults for new edges |

---

## Built-in Node Types

| Type | Handles | Use case |
|------|---------|----------|
| `default` | target (top) + source (bottom) | Branch/middle nodes |
| `input` | source (bottom) only | Entry points |
| `output` | target (top) only | Terminal points |

---

## Built-in Edge Types

| Type | Appearance |
|------|-----------|
| `default` (bezier) | Curved S-path |
| `step` | Right-angle steps |
| `smoothstep` | Rounded right-angle steps |
| `straight` | Direct line |

---

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

---

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

---

## useVueFlow Composable

The primary API for programmatic control. Call inside any component within the VueFlow tree (or in setup before mount with an `id` if outside).

```js
const {
  // State
  nodes, edges, getNodes, getEdges,
  getNode, findNode, getEdge, findEdge,

  // Node actions
  addNodes, removeNodes, updateNode, updateNodeData,
  setNodes, applyNodeChanges,

  // Edge actions
  addEdges, removeEdges, updateEdge, updateEdgeData,
  setEdges, applyEdgeChanges,

  // Viewport
  fitView, setViewport, getViewport,
  zoomIn, zoomOut, zoomTo, setCenter,
  panBy,

  // Internals
  updateNodeInternals,

  // Connections
  onConnect,

  // Events (composable hooks)
  onNodeClick, onNodeDoubleClick, onNodeContextMenu,
  onNodeDragStart, onNodeDrag, onNodeDragStop,
  onNodeMouseEnter, onNodeMouseLeave, onNodeMouseMove,
  onEdgeClick, onEdgeDoubleClick, onEdgeContextMenu,
  onEdgeMouseEnter, onEdgeMouseLeave, onEdgeMouseMove,
  onEdgeUpdateStart, onEdgeUpdate, onEdgeUpdateEnd,
  onPaneClick, onPaneContextMenu, onPaneScroll, onPaneReady,
  onConnect, onConnectStart, onConnectEnd,
  onNodesChange, onEdgesChange,
  onSelectionChange,
} = useVueFlow()
```

**Multiple instances:** pass an `id` string to `useVueFlow('my-flow')` and set the same `id` prop on `<VueFlow>` to target a specific instance.

---

## Other Composables

### useNode
Use inside a custom node component to get the node instance without prop drilling:
```js
const { node, id } = useNode()
node.data = { ...node.data, updated: true }
```

### useEdge
Use inside a custom edge component:
```js
const { edge, id } = useEdge()
edge.animated = true
```

### useNodeId
Returns current node's ID when inside a custom node:
```js
const nodeId = useNodeId()
```

### useHandle
Build handle behavior without the `<Handle>` component:
```js
const { handlePointerDown, handleClick } = useHandle()
// attach to any element
```

### useHandleConnections
Get connections for a specific handle:
```js
const connections = useHandleConnections({
  type: 'target',     // required: 'source' | 'target'
  handleId: 'my-handle',  // optional
  nodeId: 'node-1',       // optional, defaults to useNodeId()
  onConnect: (connections) => {},
  onDisconnect: (connections) => {},
})
```

### useNodeConnections
Get all connections for an entire node:
```js
const connections = useNodeConnections({
  handleType: 'source',
  onConnect: (conns) => {},
  onDisconnect: (conns) => {},
})
```

### useNodesData
Get reactive data from nodes by IDs:
```js
const nodesData = useNodesData(['node-1', 'node-2'])
// works well with useHandleConnections to read upstream node data
```

---

## VueFlow Slots

| Slot | Transforms with viewport? | Use case |
|------|--------------------------|----------|
| `default` | No | Sidebars, floating panels |
| `#connection-line="props"` | Yes | Custom connection line during drag |
| `#zoom-pane` | Yes | Content that scales/pans with viewport |

---

## Built-in Components

### Background
```vue
import { Background, BackgroundVariant } from '@vue-flow/background'

<VueFlow>
  <Background variant="dots" :gap="20" :size="0.6" pattern-color="#81818a" />
</VueFlow>
```
Props: `variant` (`'dots' | 'lines'`), `gap`, `size`, `patternColor`, `bgColor`, `height`, `width`, `x`, `y`

### MiniMap
```vue
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/minimap/dist/style.css'

<VueFlow>
  <MiniMap :pannable="true" :zoomable="true" node-color="#fff" />
</VueFlow>
```
Props: `pannable`, `zoomable`, `nodeColor`, `nodeStrokeColor`, `nodeClassName`, `nodeBorderRadius`, `nodeStrokeWidth`, `maskColor`  
Slots: `#node-${node.type}` for custom minimap node rendering

### Controls
```vue
import { Controls } from '@vue-flow/controls'
import '@vue-flow/controls/dist/style.css'

<VueFlow>
  <Controls :show-fit-view="true" :show-zoom="true" :show-interactive="true" />
</VueFlow>
```
Events: `zoom-in`, `zoom-out`, `fit-view`, `interaction-change`  
Slots: `top`, `control-zoom-in`, `control-zoom-out`, `control-fit-view`, `control-interactive`

### NodeResizer
Use **inside a custom node component**:
```vue
import { NodeResizer } from '@vue-flow/node-resizer'
import '@vue-flow/node-resizer/dist/style.css'

<NodeResizer :min-width="100" :min-height="30" />
```
Props: `nodeId`, `color`, `minWidth`, `minHeight`, `isVisible`, `handleClassName`, `handleStyle`, `lineClassName`, `lineStyle`  
Events: `resizeStart`, `resize`, `resizeEnd`

### NodeToolbar
Use **inside a custom node component**:
```vue
import { NodeToolbar } from '@vue-flow/node-toolbar'

<NodeToolbar :is-visible="selected" :position="Position.Top" :offset="10">
  <button>Delete</button>
</NodeToolbar>
```
Props: `nodeId` (string or array), `isVisible`, `position` (Position enum), `offset`

---

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

---

## Graph Utility Functions

```js
import {
  isNode, isEdge,
  getOutgoers, getIncomers, getConnectedEdges,
  getRectOfNodes, getNodesInside, getTransformForBounds,
} from '@vue-flow/core'

isNode(element)         // boolean
isEdge(element)         // boolean
getOutgoers(node, nodes, edges)     // nodes connected as targets
getIncomers(node, nodes, edges)     // nodes connected as sources
getConnectedEdges([node], edges)    // edges linked to node(s)
getRectOfNodes(nodes)               // bounding rect { x, y, width, height }
getNodesInside(nodes, rect, transform)  // nodes within a rect
getTransformForBounds(bounds, width, height, minZoom, maxZoom, padding)
```

---

## Key TypeScript Types

```ts
import type {
  Node, Edge,
  GraphNode, GraphEdge,
  NodeProps, EdgeProps,
  Connection, HandleProps,
  Viewport, XYPosition, Dimensions,
  NodeChange, EdgeChange,
} from '@vue-flow/core'

import { Position, ConnectionMode, MarkerType, BackgroundVariant } from '@vue-flow/core'

// Position enum values
Position.Top | Position.Right | Position.Bottom | Position.Left

// MarkerType for edge arrows
MarkerType.Arrow | MarkerType.ArrowClosed

// ConnectionMode
ConnectionMode.Loose   // any handle → any handle (default)
ConnectionMode.Strict  // source → target only
```

---

## Connections & onConnect

```js
const { onConnect, addEdges } = useVueFlow()

// Handle new connections
onConnect((connection: Connection) => {
  addEdges([connection])  // or merge with default edge options
})

// With default edge options applied
onConnect((params) => {
  addEdges([{ ...params, animated: true, type: 'smoothstep' }])
})
```

Validate connections with `isValidConnection` prop on `<Handle>` or `<VueFlow>`:
```js
const isValidConnection = (connection: Connection) => {
  return connection.source !== connection.target  // no self-loops
}
```

---

## State Management Patterns

### Controlled updates (apply-default="false")
```vue
<VueFlow :nodes="nodes" :edges="edges" :apply-default="false"
         @nodes-change="onNodesChange" @edges-change="onEdgesChange">
</VueFlow>
```
```js
import { applyNodeChanges, applyEdgeChanges } from '@vue-flow/core'

const onNodesChange = (changes) => {
  nodes.value = applyNodeChanges(changes, nodes.value)
}
```

### Updating node data
```js
// From outside the node
const { updateNodeData } = useVueFlow()
updateNodeData('node-id', { label: 'updated' })

// From inside a custom node
const { node } = useNode()
node.data = { ...node.data, label: 'updated' }
```

### Injecting state early (for child components)
Initialize `useVueFlow()` in the parent **before** children mount so the store is available via injection:
```js
// In parent setup (before VueFlow renders)
const instance = useVueFlow({ id: 'my-flow' })
```

---

## Common Pitfalls

1. **No height on container** — VueFlow fills its container; the container needs an explicit height.
2. **Missing `markRaw()`** on components in `nodeTypes`/`edgeTypes` — causes Vue reactivity warnings and performance issues.
3. **Modifying node position directly** — use `updateNode` or let the user drag; don't mutate `node.position` directly from outside.
4. **`useVueFlow` called outside component tree** — works only inside a component tree where `<VueFlow>` has rendered, or with an explicit matching `id`.
5. **Multiple handles without `id`** — if a node has two source handles, both must have unique `id` props or edge routing breaks.
6. **Styles not imported** — `@vue-flow/core/dist/style.css` is required; minimap and controls need their own package's stylesheet too.
7. **`addEdge` (utility fn) is deprecated** — use `addEdges` from `useVueFlow` instead.

---

## Automatic Layout (elkjs)

For any automatic graph layout task — laying out a DAG, compound/nested graphs (the retired fnb
UOW canvas mapped its hierarchy to ELK `children`), or converting ELK output back to Vue Flow
nodes — read
`references/elkjs-layout.md` before writing code. It covers the elkjs API, the `layered`
algorithm options, `INCLUDE_CHILDREN` for cross-level edges, the ELK→Vue Flow mapping
(parent-relative coordinates, parent-before-children ordering), an async layout composable,
and the gotchas (leaf nodes need `width`/`height`; all option values are strings).

