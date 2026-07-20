<script setup lang="ts">
// Pure presentational (R2 — no API calls). battleship-[id].ui.md §Component.
const props = defineProps<{
  board: string[][]
  mode: 'own' | 'target'
  interactive: boolean
  boardSize: number
}>()

const emit = defineEmits<{ fire: [cell: { row: number; col: number }] }>()

const colLabels = Array.from({ length: props.boardSize }, (_, i) => String.fromCharCode(65 + i))

function cellClass(value: string, row: number, col: number): string {
  const base = 'aspect-square flex items-center justify-center rounded-sm text-xs'
  const clickable = props.mode === 'target' && props.interactive && (value === 'unknown' || value === 'empty')
  const hover = clickable ? 'cursor-pointer hover:ring-2 hover:ring-primary' : ''
  const color =
    value === 'ship'
      ? 'bg-primary/20 text-primary'
      : value === 'hit'
        ? 'bg-error/30 text-error'
        : value === 'sunk'
          ? 'bg-error text-white'
          : value === 'miss'
            ? 'bg-elevated text-muted'
            : 'bg-default'
  return [base, color, hover].join(' ')
}

function onCellClick(value: string, row: number, col: number) {
  if (props.mode !== 'target' || !props.interactive) return
  if (value !== 'unknown' && value !== 'empty') return
  emit('fire', { row, col })
}
</script>

<template>
  <div class="overflow-x-auto">
    <div class="inline-grid gap-0.5" :style="{ gridTemplateColumns: `auto repeat(${boardSize}, minmax(1.75rem, 1fr))` }">
      <div />
      <div v-for="label in colLabels" :key="label" class="flex items-center justify-center text-xs text-muted">
        {{ label }}
      </div>
      <template v-for="(row, r) in board" :key="r">
        <div class="flex items-center justify-center text-xs text-muted">{{ r + 1 }}</div>
        <div
          v-for="(cell, c) in row"
          :key="c"
          :class="cellClass(cell, r, c)"
          @click="onCellClick(cell, r, c)"
        >
          <UIcon v-if="cell === 'hit'" name="i-lucide-flame" class="size-3" />
          <UIcon v-else-if="cell === 'sunk'" name="i-lucide-x" class="size-3" />
          <span v-else-if="cell === 'miss'" class="block size-1.5 rounded-full bg-muted" />
        </div>
      </template>
    </div>
  </div>
</template>
