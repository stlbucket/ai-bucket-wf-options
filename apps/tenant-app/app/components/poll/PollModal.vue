<script lang="ts" setup>
const emit = defineEmits<{
  (e: 'create', title: string, description?: string): void
}>()

const open = ref(false)
const title = ref('')
const description = ref('')

function submit() {
  if (title.value.trim().length < 3) return
  emit('create', title.value.trim(), description.value.trim() || undefined)
  open.value = false
  title.value = ''
  description.value = ''
}

function cancel() {
  open.value = false
  title.value = ''
  description.value = ''
}
</script>

<template>
  <UButton icon="i-lucide-plus" size="sm" @click="open = true">New Poll</UButton>

  <UModal v-model:open="open" title="New Poll">
    <template #body>
      <div class="flex flex-col gap-4">
        <UFormField label="Title" required hint="At least 3 characters">
          <UInput v-model="title" placeholder="Poll title…" class="w-full" autofocus />
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
          <UButton :disabled="title.trim().length < 3" @click="submit">Create draft</UButton>
          <UButton variant="ghost" color="neutral" @click="cancel">Cancel</UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
