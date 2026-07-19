<script setup lang="ts">
const props = defineProps<{
  creating?: boolean
}>()

const emit = defineEmits<{
  (e: 'create', name: string, identifier?: string): void
}>()

const open = ref(false)
const form = reactive({
  name: '',
  identifier: ''
})

function submit() {
  if (!form.name.trim()) return
  emit('create', form.name.trim(), form.identifier.trim() || undefined)
}

function reset() {
  open.value = false
  form.name = ''
  form.identifier = ''
}

defineExpose({ reset })
</script>

<template>
  <UButton
    icon="i-lucide-plus"
    size="sm"
    @click="open = true"
  >
    New Workspace
  </UButton>

  <UModal
    v-model:open="open"
    title="New Workspace"
    description="Creates a nested workspace tenant under this tenant. You'll hold an admin license in it."
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <UFormField
          label="Name"
          required
        >
          <UInput
            v-model="form.name"
            placeholder="e.g. Engineering"
            class="w-full"
            @keyup.enter="submit"
          />
        </UFormField>

        <UFormField
          label="Identifier"
          hint="optional"
        >
          <UInput
            v-model="form.identifier"
            placeholder="Leave blank unless you need a stable key"
            class="w-full"
          />
        </UFormField>

        <div class="flex gap-3">
          <UButton
            :disabled="!form.name.trim()"
            :loading="props.creating"
            @click="submit"
          >
            Create workspace
          </UButton>
          <UButton
            variant="ghost"
            color="neutral"
            @click="reset"
          >
            Cancel
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
