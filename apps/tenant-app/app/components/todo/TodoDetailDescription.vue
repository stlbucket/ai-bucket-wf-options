<script lang="ts" setup>
const props = defineProps<{
  description?: string | null
}>()

const emit = defineEmits<{
  (e: 'update', description: string | null): void
}>()

const editing = ref(false)
const draft = ref('')

function startEdit() {
  draft.value = props.description ?? ''
  editing.value = true
}

function save() {
  const d = draft.value.trim() || null
  if (d !== (props.description ?? null)) {
    emit('update', d)
  }
  editing.value = false
}
</script>

<template>
  <section>
    <p class="text-xs font-semibold uppercase tracking-wide text-muted mb-1">
      Description
    </p>
    <div
      v-if="editing"
      class="flex flex-col gap-2"
    >
      <UTextarea
        v-model="draft"
        :rows="3"
        class="w-full"
        autofocus
      />
      <div class="flex gap-2">
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
    </div>
    <p
      v-else
      class="text-sm cursor-pointer hover:text-primary transition-colors min-h-[2rem]"
      :class="!description ? 'text-muted italic' : ''"
      title="Click to edit"
      @click="startEdit"
    >
      {{ description ?? 'No description — click to add' }}
    </p>
  </section>
</template>
