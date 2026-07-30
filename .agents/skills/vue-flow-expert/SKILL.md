---
name: vue-flow-expert
description: >
  Vue Flow (Vue 3 flowcharts / node-based editors) technology reference: nodes/edges, custom
  components, useVueFlow composables, viewport, built-ins (Background, MiniMap, Controls), plus
  elkjs auto-layout. Generic reference — no in-repo consumers since the wf canvas retired
  2026-07-17.
---

# Vue Flow Expert

Vue Flow is a Vue 3 library for building interactive node-based graphs, flow diagrams, and visual
editors. It provides built-in dragging, zooming, panning, and selection; reactive state via
`useVueFlow`; and an extensible component model for custom nodes and edges.

**Official docs:** https://vueflow.dev/guide/
**MIT License** — Copyright © 2021-present Burak Cakmakoglu

## Core mental model

A graph is two primitive arrays: **nodes** (`id` + `position` required) and **edges** (`id` +
`source` + `target` required). Everything else — custom rendering, layout, interaction — hangs off
those. Quick start:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { VueFlow } from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

const nodes = ref([{ id: '1', position: { x: 0, y: 0 }, data: { label: 'Start' } }])
const edges = ref([])
</script>

<template>
  <div style="height: 500px">
    <VueFlow :nodes="nodes" :edges="edges" fit-view-on-init />
  </div>
</template>
```

## Decision guide — which reference to read

Read the relevant reference before writing code; they carry the exact prop names, composable
signatures, and import paths.

- **Packages/install, node & edge object shapes, basic setup, the full `<VueFlow>` prop table, built-in node/edge types, key TypeScript types (Position, MarkerType, ConnectionMode…)** → `references/core-setup-nodes-and-edges.md`
- **`useVueFlow` (state, actions, viewport, event hooks), useNode/useEdge/useHandle/useHandleConnections/useNodeConnections/useNodesData, `onConnect` + connection validation, controlled-state patterns, graph traversal utilities (getOutgoers, getConnectedEdges…)** → `references/composables-and-events.md`
- **Background, MiniMap, Controls, NodeResizer, NodeToolbar (props/events/slots/required styles) and the `<VueFlow>` slot surface (connection-line, zoom-pane)** → `references/built-in-components.md`
- **Custom node/edge components: slots vs nodeTypes/edgeTypes resolution, the props each receives, `<Handle>`, `nodrag`/`nowheel`, the BaseEdge pattern, edge path utilities (getBezierPath, getSmoothStepPath…)** → `references/custom-components.md`
- **Automatic graph layout with elkjs — laying out a DAG, compound/nested graphs (the retired fnb UOW canvas mapped its hierarchy to ELK `children`), converting ELK output back to Vue Flow nodes: the elkjs API, `layered` options, `INCLUDE_CHILDREN`, parent-relative coordinates, async layout composable, gotchas (leaf nodes need `width`/`height`; option values are strings)** → `references/elkjs-layout.md`

## Common pitfalls

1. **No height on container** — VueFlow fills its container; the container needs an explicit height.
2. **Missing `markRaw()`** on components in `nodeTypes`/`edgeTypes` — causes Vue reactivity warnings and performance issues.
3. **Modifying node position directly** — use `updateNode` or let the user drag; don't mutate `node.position` directly from outside.
4. **`useVueFlow` called outside component tree** — works only inside a component tree where `<VueFlow>` has rendered, or with an explicit matching `id`.
5. **Multiple handles without `id`** — if a node has two source handles, both must have unique `id` props or edge routing breaks.
6. **Styles not imported** — `@vue-flow/core/dist/style.css` is required; minimap and controls need their own package's stylesheet too.
7. **`addEdge` (utility fn) is deprecated** — use `addEdges` from `useVueFlow` instead.
