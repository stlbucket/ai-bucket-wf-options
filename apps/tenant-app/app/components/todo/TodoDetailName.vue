<script lang="ts" setup>
const props = defineProps<{
  name: string
}>()

const emit = defineEmits<{
  (e: 'update', name: string): void
}>()

const editing = ref(false)
const draft = ref('')

function startEdit() {
  draft.value = props.name
  editing.value = true
}

function save() {
  const n = draft.value.trim()
  if (n && n !== props.name) {
    emit('update', n)
  }
  editing.value = false
}
</script>

<template>
  <div class="flex-1 min-w-0">
    <div
      v-if="editing"
      class="flex gap-2 items-center"
    >
      <UInput
        v-model="draft"
        class="flex-1"
        autofocus
        @keyup.enter="save"
        @keyup.escape="editing = false"
      />
      <UButton
        size="xs"
        @click="save"
      >
        Save
      </UButton>
      <UButton
        size="xs"
        variant="ghost"
        color="neutral"
        @click="editing = false"
      >
        Cancel
      </UButton>
    </div>
    <h1
      v-else
      class="text-2xl font-semibold cursor-pointer hover:text-primary transition-colors"
      title="Click to edit"
      @click="startEdit"
    >
      {{ name }}
    </h1>
  </div>
</template>
