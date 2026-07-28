<script setup lang="ts">
const props = defineProps<{
  creating?: boolean
}>()

const emit = defineEmits<{
  (e: 'create', name: string, email: string): void
}>()

const open = ref(false)
const form = reactive({
  name: '',
  email: ''
})

const valid = computed(() => !!form.name.trim() && /^\S+@\S+\.\S+$/.test(form.email.trim()))

function submit() {
  if (!valid.value) return
  emit('create', form.name.trim(), form.email.trim())
}

function reset() {
  open.value = false
  form.name = ''
  form.email = ''
}

defineExpose({ reset })
</script>

<template>
  <UButton
    icon="i-lucide-plus"
    size="sm"
    @click="open = true"
  >
    New Tenant
  </UButton>

  <UModal
    v-model:open="open"
    title="New Tenant"
    description="Creates a customer tenant. The admin email is invited as the tenant admin and auto-subscribe license packs are applied."
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <UFormField
          label="Name"
          required
        >
          <UInput
            v-model="form.name"
            placeholder="e.g. Acme Corp"
            class="w-full"
            @keyup.enter="submit"
          />
        </UFormField>

        <UFormField
          label="Admin email"
          required
        >
          <UInput
            v-model="form.email"
            type="email"
            placeholder="admin@example.com"
            class="w-full"
            @keyup.enter="submit"
          />
        </UFormField>

        <div class="flex gap-3">
          <UButton
            :disabled="!valid"
            :loading="props.creating"
            @click="submit"
          >
            Create tenant
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
