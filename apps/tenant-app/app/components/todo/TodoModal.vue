<script lang="ts" setup>
const emit = defineEmits<{
  (e: 'create', name: string, description?: string): void
}>()

const open = ref(false)
const name = ref('')
const description = ref('')

function submit() {
  if (!name.value.trim()) return
  emit('create', name.value.trim(), description.value.trim() || undefined)
  open.value = false
  name.value = ''
  description.value = ''
}

function cancel() {
  open.value = false
  name.value = ''
  description.value = ''
}
</script>

<template>
  <UButton icon="i-lucide-plus" size="sm" @click="open = true">New Todo</UButton>

  <UModal v-model:open="open" title="New Todo">
    <template #body>
      <div class="flex flex-col gap-4">
        <UFormField label="Name" required>
          <UInput v-model="name" placeholder="Todo name…" class="w-full" autofocus />
        </UFormField>

        <UFormField label="Description">
          <UTextarea
            v-model="description"
            placeholder="Optional description…"
            :rows="3"
            class="w-full"
          />
        </UFormField>

        <div class="flex gap-3">
          <UButton :disabled="!name.trim()" @click="submit">Create</UButton>
          <UButton variant="ghost" color="neutral" @click="cancel">Cancel</UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
