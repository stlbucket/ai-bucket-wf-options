# Built-in Components & VueFlow Slots

The shipped add-on components (Background, MiniMap, Controls, NodeResizer, NodeToolbar) and the
`<VueFlow>` slot surface.

## VueFlow Slots

| Slot | Transforms with viewport? | Use case |
|------|--------------------------|----------|
| `default` | No | Sidebars, floating panels |
| `#connection-line="props"` | Yes | Custom connection line during drag |
| `#zoom-pane` | Yes | Content that scales/pans with viewport |

## Background

```vue
import { Background, BackgroundVariant } from '@vue-flow/background'

<VueFlow>
  <Background variant="dots" :gap="20" :size="0.6" pattern-color="#81818a" />
</VueFlow>
```
Props: `variant` (`'dots' | 'lines'`), `gap`, `size`, `patternColor`, `bgColor`, `height`, `width`, `x`, `y`

## MiniMap

```vue
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/minimap/dist/style.css'

<VueFlow>
  <MiniMap :pannable="true" :zoomable="true" node-color="#fff" />
</VueFlow>
```
Props: `pannable`, `zoomable`, `nodeColor`, `nodeStrokeColor`, `nodeClassName`, `nodeBorderRadius`, `nodeStrokeWidth`, `maskColor`  
Slots: `#node-${node.type}` for custom minimap node rendering

## Controls

```vue
import { Controls } from '@vue-flow/controls'
import '@vue-flow/controls/dist/style.css'

<VueFlow>
  <Controls :show-fit-view="true" :show-zoom="true" :show-interactive="true" />
</VueFlow>
```
Events: `zoom-in`, `zoom-out`, `fit-view`, `interaction-change`  
Slots: `top`, `control-zoom-in`, `control-zoom-out`, `control-fit-view`, `control-interactive`

## NodeResizer

Use **inside a custom node component**:
```vue
import { NodeResizer } from '@vue-flow/node-resizer'
import '@vue-flow/node-resizer/dist/style.css'

<NodeResizer :min-width="100" :min-height="30" />
```
Props: `nodeId`, `color`, `minWidth`, `minHeight`, `isVisible`, `handleClassName`, `handleStyle`, `lineClassName`, `lineStyle`  
Events: `resizeStart`, `resize`, `resizeEnd`

## NodeToolbar

Use **inside a custom node component**:
```vue
import { NodeToolbar } from '@vue-flow/node-toolbar'

<NodeToolbar :is-visible="selected" :position="Position.Top" :offset="10">
  <button>Delete</button>
</NodeToolbar>
```
Props: `nodeId` (string or array), `isVisible`, `position` (Position enum), `offset`
