# Core Setup, Nodes & Edges

Packages, installation, the node/edge primitives, basic setup, the `<VueFlow>` prop surface,
built-in node/edge types, and the key TypeScript types.

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

## Core Concepts

A Vue Flow graph has two primitive types:

- **Node** — requires `id` (string, unique) and `position: { x, y }`. Optional: `type`, `data`, `label`, `style`, `class`, `draggable`, `connectable`, `selectable`, `sourcePosition`, `targetPosition`, `parentNode`, `extent`, `zIndex`, `dragHandle`.
- **Edge** — requires `id`, `source` (node id), `target` (node id). Optional: `type`, `sourceHandle`, `targetHandle`, `label`, `data`, `style`, `animated`, `markerStart`, `markerEnd`, `updatable`, `selectable`, `zIndex`.

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

## Built-in Node Types

| Type | Handles | Use case |
|------|---------|----------|
| `default` | target (top) + source (bottom) | Branch/middle nodes |
| `input` | source (bottom) only | Entry points |
| `output` | target (top) only | Terminal points |

## Built-in Edge Types

| Type | Appearance |
|------|-----------|
| `default` (bezier) | Curved S-path |
| `step` | Right-angle steps |
| `smoothstep` | Rounded right-angle steps |
| `straight` | Direct line |

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
