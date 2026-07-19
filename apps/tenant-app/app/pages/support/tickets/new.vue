<script setup lang="ts">
const toast = useToast()
const router = useRouter()

const { submitTicket } = useSupportTickets()

const form = reactive({ title: '', description: '' })
const submitting = ref(false)

async function submit() {
  if (!form.title.trim() || !form.description.trim()) return
  submitting.value = true
  try {
    const id = await submitTicket(form.title, form.description)
    await router.push(`/support/tickets/${id}`)
  } catch {
    toast.add({ title: 'Failed to submit ticket', color: 'error' })
    submitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-4 p-6 sm:p-9">
    <UButton variant="link" color="neutral" icon="i-lucide-arrow-left" to="/support/tickets" size="sm" class="-ml-2 text-muted">
      Tickets
    </UButton>

    <UCard>
      <template #header>
        <h1 class="text-lg font-semibold">Submit a Support Ticket</h1>
      </template>

      <div class="flex flex-col gap-4">
        <UFormField label="Title" required>
          <UInput v-model="form.title" placeholder="Brief summary of the issue" class="w-full" />
        </UFormField>

        <UFormField label="Description" required>
          <UTextarea
            v-model="form.description"
            placeholder="Describe the problem in detail…"
            :rows="6"
            class="w-full"
          />
        </UFormField>

        <div class="flex gap-3">
          <UButton
            :loading="submitting"
            :disabled="!form.title.trim() || !form.description.trim()"
            @click="submit"
          >
            Submit Ticket
          </UButton>
          <UButton variant="ghost" color="neutral" to="/support/tickets">Cancel</UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
