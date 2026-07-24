<script setup lang="ts">
import { formatUrn } from '@function-bucket/fnb-types'
import type { PollStatus } from '@function-bucket/fnb-types'

const toast = useToast()
const { user } = useAuth()
const myUrn = computed(() => {
  const u = user.value
  if (!u?.residentId || !u?.tenantId) return ''
  return formatUrn({ tenantId: u.tenantId, module: 'app', resourceType: 'resident', id: u.residentId })
})

const { polls, fetching, search, createPoll } = usePollList(myUrn)

const searchTerm = ref('')
const statusFilter = ref<PollStatus | undefined>(undefined)
const mineOnly = ref(false)

const statusItems = [
  { label: 'All', value: undefined },
  { label: 'Open', value: 'OPEN' },
  { label: 'Closed', value: 'CLOSED' },
  { label: 'Drafts', value: 'DRAFT' },
]

let debounceTimer: ReturnType<typeof setTimeout> | null = null
watch(searchTerm, (val) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => search(val, statusFilter.value, mineOnly.value), 300)
})
watch([statusFilter, mineOnly], () => search(searchTerm.value, statusFilter.value, mineOnly.value))

async function handleCreate(title: string, description?: string) {
  try {
    const { id } = await createPoll(title, description)
    await navigateTo(`/tools/poll/${id}`)
  } catch {
    toast.add({ title: 'Failed to create poll', color: 'error' })
  }
}
</script>

<template>
  <div class="space-y-5 p-6 sm:p-9">
    <PageHeader title="Polls" :subtitle="`${polls.length} poll${polls.length === 1 ? '' : 's'}`">
      <template #actions>
        <PollModal @create="handleCreate" />
      </template>
    </PageHeader>

    <div class="flex flex-wrap items-center gap-3">
      <UInput
        v-model="searchTerm"
        icon="i-lucide-search"
        placeholder="Search polls…"
        class="w-64"
        :trailing-icon="searchTerm ? 'i-lucide-x' : undefined"
        @click:trailing="searchTerm = ''"
      />
      <USelect
        v-model="statusFilter"
        :items="statusItems"
        value-key="value"
        placeholder="All"
        class="w-36"
      />
      <USwitch v-model="mineOnly" label="Only mine" />
    </div>

    <div
      v-if="fetching"
      class="rounded-[10px] border border-default bg-default py-8 text-center text-sm text-muted"
    >
      Loading…
    </div>

    <template v-else-if="polls.length">
      <div class="hidden overflow-hidden rounded-[10px] border border-default bg-default md:block">
        <PollList :polls="polls" />
      </div>
      <div class="block rounded-[10px] border border-default bg-default px-4 md:hidden">
        <PollListSmall :polls="polls" />
      </div>
    </template>

    <UEmpty
      v-else
      icon="i-lucide-vote"
      label="No polls yet"
      description="Create a poll to gather answers from everyone in your workspace."
    />
  </div>
</template>
