<script setup lang="ts">
import { ref, computed, watch, nextTick, type Ref } from 'vue'

// Friendly US phone entry in three segments (area · prefix · line). v-models the assembled E.164
// string (`+1XXXXXXXXXX`, or '' while incomplete). Each segment auto-advances to the next as it
// fills; backspace on an empty segment hops back. Shared across auth-app (profile preferences) and
// tenant-app (SMS-Test) — lives in auth-layer, the common ancestor.
const props = withDefaults(
  defineProps<{ modelValue?: string; disabled?: boolean }>(),
  { modelValue: '', disabled: false },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

type InputExpose = { inputRef: HTMLInputElement | null }
const area = ref('')
const prefix = ref('')
const line = ref('')
const areaRef = ref<InputExpose | null>(null)
const prefixRef = ref<InputExpose | null>(null)
const lineRef = ref<InputExpose | null>(null)

const digits = computed(() => area.value + prefix.value + line.value)
const e164 = computed(() => (digits.value.length === 10 ? `+1${digits.value}` : ''))

const onlyDigits = (s: string, n: number) => s.replace(/\D/g, '').slice(0, n)
const focusEl = (r: Ref<InputExpose | null>) => nextTick(() => r.value?.inputRef?.focus())

// Hydrate segments from an incoming value (prefill). Guarded so our own emits don't re-trigger it.
watch(
  () => props.modelValue,
  (v) => {
    if ((v ?? '') === e164.value) return
    const d = (v ?? '').replace(/\D/g, '')
    const ten = d.length === 11 && d.startsWith('1') ? d.slice(1) : d
    area.value = ten.slice(0, 3)
    prefix.value = ten.slice(3, 6)
    line.value = ten.slice(6, 10)
  },
  { immediate: true },
)

watch(area, (v) => {
  const c = onlyDigits(v, 3)
  if (c !== v) {
    area.value = c
    return
  }
  if (c.length === 3) focusEl(prefixRef)
})
watch(prefix, (v) => {
  const c = onlyDigits(v, 3)
  if (c !== v) {
    prefix.value = c
    return
  }
  if (c.length === 3) focusEl(lineRef)
})
watch(line, (v) => {
  const c = onlyDigits(v, 4)
  if (c !== v) line.value = c
})

// Emit the assembled E.164 whenever the segments change.
watch(e164, (v) => {
  if (v !== (props.modelValue ?? '')) emit('update:modelValue', v)
})

const onPrefixBackspace = (e: KeyboardEvent) => {
  if (e.key === 'Backspace' && prefix.value === '') focusEl(areaRef)
}
const onLineBackspace = (e: KeyboardEvent) => {
  if (e.key === 'Backspace' && line.value === '') focusEl(prefixRef)
}
</script>

<template>
  <div class="flex items-center gap-1.5">
    <span class="text-sm text-muted">+1</span>
    <UInput
      ref="areaRef"
      v-model="area"
      :disabled="disabled"
      :ui="{ base: 'text-center font-mono tracking-widest' }"
      class="w-16"
      placeholder="555"
      inputmode="numeric"
      maxlength="3"
      aria-label="Area code"
    />
    <span class="text-muted">–</span>
    <UInput
      ref="prefixRef"
      v-model="prefix"
      :disabled="disabled"
      :ui="{ base: 'text-center font-mono tracking-widest' }"
      class="w-16"
      placeholder="123"
      inputmode="numeric"
      maxlength="3"
      aria-label="Prefix"
      @keydown="onPrefixBackspace"
    />
    <span class="text-muted">–</span>
    <UInput
      ref="lineRef"
      v-model="line"
      :disabled="disabled"
      :ui="{ base: 'text-center font-mono tracking-widest' }"
      class="w-20"
      placeholder="4567"
      inputmode="numeric"
      maxlength="4"
      aria-label="Line number"
      @keydown="onLineBackspace"
    />
  </div>
</template>
