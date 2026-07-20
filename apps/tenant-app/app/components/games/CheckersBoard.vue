<script setup lang="ts">
// Pure presentational (R2 — no API calls). checkers-[id].ui.md §Component. Auto-registers as
// <GamesCheckersBoard>; the [id].vue page imports it explicitly (auto-import naming gotcha).
import type { CheckersCell, CheckersLegalMove, CheckersMove, CheckersSquare } from '@function-bucket/fnb-types'

const props = defineProps<{
  board: CheckersCell[][]
  boardSize: number
  mySeat: number
  legalMoves: CheckersLegalMove[]
  interactive: boolean
  lastMove: CheckersMove | null
}>()

const emit = defineEmits<{ move: [m: CheckersLegalMove] }>()

const selected = ref<CheckersSquare | null>(null)

// Orient so the caller's own pieces sit at the bottom (seat 2 sees a 180° flip).
const rowOrder = computed(() => {
  const rows = Array.from({ length: props.boardSize }, (_, i) => i)
  return props.mySeat === 2 ? rows.reverse() : rows
})
const colOrder = computed(() => {
  const cols = Array.from({ length: props.boardSize }, (_, i) => i)
  return props.mySeat === 2 ? cols.reverse() : cols
})

const key = (r: number, c: number) => `${r},${c}`
const finalSquare = (m: CheckersLegalMove) => m.path[m.path.length - 1]!

// The squares from which the caller may move (populated only on the caller's turn).
const movableKeys = computed(() => new Set(props.legalMoves.map((m) => key(m.from.row, m.from.col))))
// Destination squares for the currently-selected piece.
const destinationKeys = computed(() => {
  if (!selected.value) return new Set<string>()
  const s = selected.value
  return new Set(props.legalMoves.filter((m) => m.from.row === s.row && m.from.col === s.col).map((m) => key(finalSquare(m).row, finalSquare(m).col)))
})
const lastMoveKeys = computed(() => {
  if (!props.lastMove) return new Set<string>()
  const lm = props.lastMove
  return new Set([key(lm.from.row, lm.from.col), key(finalSquare({ from: lm.from, path: lm.path, captures: [] }).row, finalSquare({ from: lm.from, path: lm.path, captures: [] }).col)])
})

function isPlayable(r: number, c: number) {
  return (r + c) % 2 === 1
}

function onCellClick(r: number, c: number) {
  if (!props.interactive) return
  const k = key(r, c)
  // Click a highlighted destination of the selected piece → submit that move.
  if (selected.value && destinationKeys.value.has(k)) {
    const s = selected.value
    const move = props.legalMoves.find((m) => m.from.row === s.row && m.from.col === s.col && key(finalSquare(m).row, finalSquare(m).col) === k)
    if (move) emit('move', move)
    selected.value = null
    return
  }
  // Click one of your movable pieces → select/deselect it.
  const piece = props.board[r]?.[c] ?? null
  if (piece && piece.seat === props.mySeat && movableKeys.value.has(k)) {
    selected.value = selected.value && selected.value.row === r && selected.value.col === c ? null : { row: r, col: c }
    return
  }
  selected.value = null
}

function cellClass(r: number, c: number): string {
  const base = 'relative aspect-square flex items-center justify-center'
  if (!isPlayable(r, c)) return `${base} bg-default`
  const k = key(r, c)
  const isSelected = selected.value?.row === r && selected.value?.col === c
  const isDest = destinationKeys.value.has(k)
  const isLast = lastMoveKeys.value.has(k)
  const piece = props.board[r]?.[c] ?? null
  const selectable = props.interactive && !!piece && piece.seat === props.mySeat && movableKeys.value.has(k)
  return [
    base,
    'bg-elevated',
    isSelected ? 'ring-2 ring-primary' : '',
    isDest ? 'ring-2 ring-primary/60 cursor-pointer' : '',
    isLast && !isSelected ? 'ring-1 ring-info' : '',
    selectable ? 'cursor-pointer' : '',
  ].join(' ')
}

function pieceClass(cell: CheckersCell): string {
  if (!cell) return ''
  const color = cell.seat === 1 ? 'bg-error text-white' : 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900'
  return `size-3/4 rounded-full flex items-center justify-center shadow ${color}`
}
</script>

<template>
  <div class="overflow-x-auto">
    <div class="inline-grid gap-0.5" :style="{ gridTemplateColumns: `auto repeat(${boardSize}, minmax(2rem, 1fr))` }">
      <div />
      <div v-for="c in colOrder" :key="`h-${c}`" class="flex items-center justify-center text-xs text-muted">
        {{ String.fromCharCode(65 + c) }}
      </div>
      <template v-for="r in rowOrder" :key="`r-${r}`">
        <div class="flex items-center justify-center text-xs text-muted">{{ r + 1 }}</div>
        <div v-for="c in colOrder" :key="`${r}-${c}`" :class="cellClass(r, c)" @click="onCellClick(r, c)">
          <div v-if="board[r]?.[c]" :class="pieceClass(board[r]![c])">
            <UIcon v-if="board[r]![c]!.king" name="i-lucide-crown" class="size-3" />
          </div>
          <span v-else-if="destinationKeys.has(`${r},${c}`)" class="block size-2 rounded-full bg-primary/70" />
        </div>
      </template>
    </div>
  </div>
</template>
