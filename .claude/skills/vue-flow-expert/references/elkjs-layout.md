# ELK.js Layout Engine (elkjs) with Vue Flow

[elkjs](https://github.com/kieler/elkjs) is the JavaScript port of the Eclipse Layout Kernel — a production-grade graph layout engine that handles DAGs, compound (nested) graphs, crossing minimization, and edge routing. It is the correct choice when a hand-rolled BFS layout isn't enough.

### Installation

```bash
pnpm add elkjs
pnpm add -D @types/elkjs   # if needed; types may be bundled
```

### Constructor & API

```ts
import ELK from 'elkjs/lib/elk.bundled.js'

const elk = new ELK()

// Options
const elk = new ELK({
  defaultLayoutOptions: { 'elk.algorithm': 'layered' },
  // algorithms: ['layered', 'stress', 'mrtree', 'radial', 'force', 'disco'],
  // workerUrl: './elk-worker.min.js',   // for Web Worker offload
})

// Layout a graph — returns a Promise
const laidOut = await elk.layout(graph, {
  layoutOptions: {},       // override options for this call
  logging: false,          // include debug info in output
  measureExecutionTime: false,
})

// Metadata queries
await elk.knownLayoutAlgorithms()
await elk.knownLayoutOptions()
await elk.knownLayoutCategories()
elk.terminateWorker()      // if using Web Worker
```

### Graph Input Format

```ts
interface ElkNode {
  id: string
  width?: number        // required for leaf nodes; parent size computed by ELK
  height?: number
  x?: number            // ignored on input; set by ELK on output
  y?: number
  layoutOptions?: Record<string, string>
  children?: ElkNode[]  // nested nodes → compound graph
  edges?: ElkEdge[]     // edges owned by this node (typically at root or LCA)
  ports?: ElkPort[]
  labels?: ElkLabel[]
}

interface ElkEdge {
  id: string
  sources: string[]     // array of node/port IDs (usually one element)
  targets: string[]     // array of node/port IDs (usually one element)
  layoutOptions?: Record<string, string>
}
```

**Output:** ELK adds `x`, `y` to every node. Child node coordinates are **relative to their parent**. This matches Vue Flow's `parentNode` coordinate system exactly — no translation needed.

### Algorithms

| Short ID | Full ID | Best for |
|---|---|---|
| `layered` | `org.eclipse.elk.layered` | DAGs, hierarchical workflows, anything with a direction (default for compound graphs) |
| `mrtree` | `org.eclipse.elk.mrtree` | Pure trees (single parent, no cross-edges) |
| `stress` | `org.eclipse.elk.stress` | General undirected graphs, force-directed feel |
| `force` | `org.eclipse.elk.force` | Force-directed, organic layout |
| `radial` | `org.eclipse.elk.radial` | Circular / star topology |
| `box` | `org.eclipse.elk.box` | Pack rectangles without edges (always loaded) |
| `fixed` | `org.eclipse.elk.fixed` | No repositioning — respect `x`/`y` as given |
| `random` | `org.eclipse.elk.random` | Testing only |
| `disco` | `org.eclipse.elk.disco` | Handle disconnected subgraph components |

Use `layered` for workflow DAGs at every hierarchy level.

### Key Layout Options

Options are passed as `Record<string, string>` (all values are strings, even numbers).

**Global / any algorithm:**
| Option key | Values / default | Description |
|---|---|---|
| `elk.algorithm` | `layered` | Which algorithm to run |
| `elk.direction` | `DOWN` \| `RIGHT` \| `UP` \| `LEFT` (default: `RIGHT`) | Primary flow direction; use `DOWN` for top-to-bottom DAGs |
| `elk.padding` | `'[top=20, left=20, bottom=20, right=20]'` | Padding inside compound node containers |
| `elk.spacing.nodeNode` | `'30'` | Horizontal spacing between sibling nodes |
| `elk.spacing.nodeNodeBetweenLayers` | `'50'` | Vertical spacing between layers |
| `elk.spacing.edgeNode` | `'10'` | Clearance between edges and nodes |
| `elk.spacing.edgeEdge` | `'10'` | Clearance between parallel edges |
| `elk.edgeRouting` | `ORTHOGONAL` \| `POLYLINE` \| `SPLINES` | Edge path style |
| `elk.hierarchyHandling` | `INCLUDE_CHILDREN` \| `SEPARATE_CHILDREN` \| `INHERIT` | **Critical for compound graphs.** Set to `INCLUDE_CHILDREN` on root to allow edges between nodes at different hierarchy levels |
| `elk.separateConnectedComponents` | `'false'` | Keep disconnected subgraphs together in one layer pass |

**Layered algorithm specific:**
| Option key | Values / default | Description |
|---|---|---|
| `elk.layered.nodePlacement.strategy` | `BRANDES_KOEPF` (default) \| `LINEAR_SEGMENTS` \| `NETWORK_SIMPLEX` \| `SIMPLE` | Node placement within a layer |
| `elk.layered.crossingMinimization.strategy` | `LAYER_SWEEP` (default) \| `NONE` | Crossing minimization; `NONE` is faster but produces messier graphs |
| `elk.layered.layering.strategy` | `NETWORK_SIMPLEX` (default) \| `LONGEST_PATH` \| `COFFMAN_GRAHAM` | Layer assignment strategy |
| `elk.layered.cycleBreaking.strategy` | `GREEDY` (default) \| `DEPTH_FIRST` \| `MODEL_ORDER` | Handle cycles in the graph |
| `elk.layered.thoroughness` | `'7'` (integer) | How much effort to spend on optimization; higher = slower but better |
| `elk.layered.spacing.baseValue` | float string | Scale all spacing uniformly |
| `elk.layered.feedbackEdges` | `'true'` | Reverse feedback edges instead of treating them as cycles |
| `elk.layered.unnecessaryBendpoints` | `'false'` | Remove unnecessary bends in orthogonal routing |

**Node sizing:**
| Option key | Values | Description |
|---|---|---|
| `elk.nodeSize.constraints` | `'MINIMUM_SIZE'` | Respect `elk.nodeSize.minimum` |
| `elk.nodeSize.minimum` | `'(100, 60)'` | Minimum node size |

### Compound / Nested Graph Layout

ELK natively supports compound graphs via the `children` array. Each parent node is laid out recursively before its parent is laid out.

```ts
const graph = {
  id: 'root',
  layoutOptions: {
    'elk.algorithm': 'layered',
    'elk.direction': 'DOWN',
    'elk.hierarchyHandling': 'INCLUDE_CHILDREN',  // required for cross-level edges
    'elk.spacing.nodeNode': '40',
    'elk.spacing.nodeNodeBetweenLayers': '60',
    'elk.padding': '[top=30, left=30, bottom=30, right=30]',
  },
  children: [
    {
      id: 'milestone-1',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'DOWN',
        'elk.padding': '[top=40, left=20, bottom=20, right=20]',
      },
      children: [
        { id: 'task-1', width: 200, height: 80 },
        { id: 'task-2', width: 200, height: 80 },
      ],
      edges: [
        { id: 'e-t1-t2', sources: ['task-1'], targets: ['task-2'] },
      ],
    },
    {
      id: 'milestone-2',
      layoutOptions: { 'elk.algorithm': 'layered', 'elk.direction': 'DOWN' },
      children: [
        { id: 'task-3', width: 200, height: 80 },
      ],
    },
  ],
  edges: [
    // Cross-hierarchy edges live at the LCA (here: root)
    // ELK resolves them when hierarchyHandling=INCLUDE_CHILDREN
    { id: 'e-m1-m2', sources: ['milestone-1'], targets: ['milestone-2'] },
    // Cross-milestone task dependency
    { id: 'e-t2-t3', sources: ['task-2'], targets: ['task-3'] },
  ],
}

const result = await elk.layout(graph)
```

### Mapping ELK Output → Vue Flow Nodes

ELK output `x`/`y` are relative to the parent node — which is exactly what Vue Flow expects when `parentNode` is set.

```ts
import type { Node, Edge } from '@vue-flow/core'

function elkToVueFlow(
  elkNode: ElkNode,
  parentId?: string,
  vfNodes: Node[] = [],
): Node[] {
  const isLeaf = !elkNode.children?.length

  vfNodes.push({
    id: elkNode.id,
    type: isLeaf ? 'task' : 'milestone',
    position: { x: elkNode.x ?? 0, y: elkNode.y ?? 0 },
    style: isLeaf ? undefined : {
      width: `${elkNode.width}px`,
      height: `${elkNode.height}px`,
    },
    data: { /* your data */ },
    ...(parentId ? { parentNode: parentId, extent: 'parent' } : {}),
  })

  for (const child of elkNode.children ?? []) {
    elkToVueFlow(child, elkNode.id, vfNodes)
  }

  return vfNodes
}
```

**Important:** Parent (compound) nodes must be listed in the `nodes` array **before** their children, otherwise Vue Flow will not render children correctly.

### UOW Hierarchy Pattern

The fnb `wf.uow` table has `parent_uow_id` which maps directly to ELK's `children`. UOW types map to roles:

| `uow.type` | Role in graph |
|---|---|
| `wf` | Root node (often omitted from the visible graph, or used as root container) |
| `milestone` | Compound node with `children`; laid out by ELK as a container |
| `task` | Leaf node; must have `width`/`height` so ELK can size it |
| `issue` | Leaf node |
| `trigger` | Leaf node |

`uow_dependency` rows are edges. Their `dependerId`/`dependeeId` can cross milestone boundaries — place those edges at the lowest common ancestor (LCA) level in the ELK graph. Setting `elk.hierarchyHandling: 'INCLUDE_CHILDREN'` on the root lets ELK handle this automatically even if you put all edges on the root.

**Building the ELK input from flat UOW arrays:**

```ts
function buildElkGraph(
  uows: UowFragment[],
  deps: UowDependencyFragment[],
  nodeWidth = 220,
  nodeHeight = 100,
): ElkNode {
  const byId = new Map(uows.map((u) => [u.id, u]))
  const children = new Map<string, ElkNode>()

  // Build ELK node for each UOW
  for (const uow of uows) {
    const isLeaf = uow.type === 'task' || uow.type === 'issue' || uow.type === 'trigger'
    children.set(uow.id, {
      id: uow.id,
      ...(isLeaf ? { width: nodeWidth, height: nodeHeight } : {}),
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'DOWN',
        'elk.padding': '[top=40, left=20, bottom=20, right=20]',
        'elk.spacing.nodeNode': '30',
        'elk.spacing.nodeNodeBetweenLayers': '50',
      },
      children: [],
      edges: [],
    })
  }

  // Wire parent-child
  const roots: ElkNode[] = []
  for (const uow of uows) {
    const elkNode = children.get(uow.id)!
    if (uow.parentUowId && children.has(uow.parentUowId)) {
      children.get(uow.parentUowId)!.children!.push(elkNode)
    } else {
      roots.push(elkNode)
    }
  }

  // All deps go on root (INCLUDE_CHILDREN handles cross-level routing)
  const edges: ElkEdge[] = deps.map((d) => ({
    id: d.id,
    sources: [d.dependeeId],
    targets: [d.dependerId],
  }))

  return {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.spacing.nodeNode': '40',
      'elk.spacing.nodeNodeBetweenLayers': '60',
      'elk.padding': '[top=30, left=30, bottom=30, right=30]',
    },
    children: roots,
    edges,
  }
}
```

### Async Layout in a Composable

`elk.layout()` returns a Promise. In a Vue composable, use `watchEffect` or `watch` + an async inner function, and guard against stale results:

```ts
import ELK from 'elkjs/lib/elk.bundled.js'
import { ref, watch, toValue } from 'vue'
import type { MaybeRef } from 'vue'
import type { Node, Edge } from '@vue-flow/core'

const elk = new ELK()

export function useElkLayout(
  uows: MaybeRef<UowFragment[]>,
  deps: MaybeRef<UowDependencyFragment[]>,
) {
  const nodes = ref<Node[]>([])
  const edges = ref<Edge[]>([])
  const layoutPending = ref(false)

  watch(
    [() => toValue(uows), () => toValue(deps)],
    async ([u, d]) => {
      if (!u.length) { nodes.value = []; edges.value = []; return }
      layoutPending.value = true
      try {
        const graph = buildElkGraph(u, d)
        const result = await elk.layout(graph)
        nodes.value = elkToVueFlow(result)
        edges.value = d.map((dep) => ({
          id: dep.id,
          source: dep.dependeeId,
          target: dep.dependerId,
          type: 'smoothstep',
        }))
      } finally {
        layoutPending.value = false
      }
    },
    { immediate: true },
  )

  return { nodes, edges, layoutPending }
}
```

### ELK Gotchas

1. **Leaf nodes must have `width`/`height`** — ELK cannot size leaf nodes; pass the actual rendered size or a fixed estimate.
2. **Parent node size is computed** — do not set `width`/`height` on compound nodes; ELK sizes them from children + padding.
3. **`INCLUDE_CHILDREN` required for cross-level edges** — without it, edges between nodes in different containers are silently dropped.
4. **All option values are strings** — even numbers: `'30'` not `30`. ELK will ignore non-string values silently.
5. **Property key format** — use `elk.*` short form (e.g., `elk.algorithm`) or the full `org.eclipse.elk.*` form. Do NOT mix dots and hyphens (the reference docs show hyphens in some places; JavaScript elkjs uses dots).
6. **ELK is sync-heavy** — for large graphs, use the Web Worker variant to avoid blocking the main thread.
7. **Vue Flow `parentNode` ordering** — parent nodes must appear before their children in the `nodes` array or Vue Flow won't render children correctly.
8. **`extent: 'parent'`** — add to child nodes to prevent dragging them outside the parent container; omit if you want free dragging.
9. **ELK output coordinates origin** — the root graph's children get `x`/`y` relative to the root, which starts at `(0, 0)`. If you skip the `wf` root node and only render milestones/tasks directly in Vue Flow, coordinates are already correct.
