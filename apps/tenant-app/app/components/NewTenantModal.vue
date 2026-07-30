<script setup lang="ts">
// Emit contract for the New Tenant form (spec: site-admin/tenant/index.ui.md); the page feeds
// it straight into useCreateTenant's CreateTenantInput
export interface NewTenantPayload {
  name: string
  email: string
  firstName: string
  lastName: string
  phone: string | null
}

const props = defineProps<{
  creating?: boolean
}>()

const emit = defineEmits<{
  (e: 'create', payload: NewTenantPayload): void
}>()

const open = ref(false)
const form = reactive({
  name: '',
  firstName: '',
  lastName: '',
  email: '',
  // E.164 from PhoneSegments ('' while incomplete — treated as "not provided")
  phone: ''
})

const valid = computed(
  () =>
    !!form.name.trim()
    && !!form.firstName.trim()
    && !!form.lastName.trim()
    && /^\S+@\S+\.\S+$/.test(form.email.trim())
)

function submit() {
  if (!valid.value) return
  emit('create', {
    name: form.name.trim(),
    email: form.email.trim(),
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    phone: form.phone || null
  })
}

function reset() {
  open.value = false
  form.name = ''
  form.firstName = ''
  form.lastName = ''
  form.email = ''
  form.phone = ''
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
          label="Admin first name"
          required
        >
          <UInput
            v-model="form.firstName"
            placeholder="Jane"
            class="w-full"
            @keyup.enter="submit"
          />
        </UFormField>

        <UFormField
          label="Admin last name"
          required
        >
          <UInput
            v-model="form.lastName"
            placeholder="Smith"
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

        <UFormField label="Admin phone">
          <PhoneSegments v-model="form.phone" />
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
