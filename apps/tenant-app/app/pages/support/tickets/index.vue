<script setup lang="ts">
const { tickets, fetching } = useSupportTickets()

const statusKeys = computed(() => [...new Set(tickets.value.map((t) => t.status as string))].sort())
const selectedStatuses = ref<Set<string>>(new Set())

watch(statusKeys, (keys) => {
  selectedStatuses.value = new Set(keys)
}, { immediate: true })

function toggleStatus(key: string) {
  const next = new Set(selectedStatuses.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  selectedStatuses.value = next
}

const allStatusesSelected = computed(() => selectedStatuses.value.size === statusKeys.value.length)
function toggleAllStatuses() {
  selectedStatuses.value = allStatusesSelected.value ? new Set() : new Set(statusKeys.value)
}

const search = ref('')

const filteredTickets = computed(() => {
  const q = search.value.trim().toLowerCase()
  return tickets.value.filter((t) => {
    if (!selectedStatuses.value.has(t.status as string)) return false
    if (!q) return true
    return t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
  })
})
</script>

<template>
  <div class="space-y-5 p-6 sm:p-9">
    <PageHeader title="Support Tickets" :subtitle="`${tickets.length} tickets`">
      <template #actions>
        <UButton icon="i-lucide-plus" color="secondary" to="/support/tickets/new">
          New Ticket
        </UButton>
      </template>
    </PageHeader>

    <div v-if="fetching" class="rounded-[10px] border border-default bg-default py-8 text-center text-sm text-muted">
      Loading…
    </div>

    <div v-else class="flex flex-col gap-4">
      <!-- Filter bar -->
      <div class="flex flex-wrap items-center gap-3">
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Search by title or description…"
            class="w-64"
            :trailing-icon="search ? 'i-lucide-x' : undefined"
            @click:trailing="search = ''"
          />

          <USeparator orientation="vertical" class="h-6 hidden sm:block" />

          <div v-if="statusKeys.length" class="flex items-center gap-3">
            <span class="text-xs font-semibold uppercase tracking-wider text-muted">Status</span>
            <UCheckbox
              :model-value="allStatusesSelected"
              label="All"
              :indeterminate="selectedStatuses.size > 0 && !allStatusesSelected"
              @update:model-value="toggleAllStatuses"
            />
            <UCheckbox
              v-for="key in statusKeys"
              :key="key"
              :model-value="selectedStatuses.has(key)"
              :label="key"
              @update:model-value="toggleStatus(key)"
            />
          </div>
        </div>

      <div class="overflow-hidden rounded-[10px] border border-default bg-default">
        <TicketList :tickets="filteredTickets" />
      </div>
    </div>
  </div>
</template>
