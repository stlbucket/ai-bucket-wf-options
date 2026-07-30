# Composables, Events & State Management

The `useVueFlow` API surface (state, actions, event hooks), the per-node/per-edge composables,
connection handling, state management patterns, and the graph traversal utilities.

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
