<script setup lang="ts">
import type { TenantSubscription } from '@function-bucket/fnb-types'
import { useAdminSubscriptions } from '~/composables/useAdminSubscriptions'

const toast = useToast()
const { data: subsData, deactivateSubscription, reactivateSubscription } = useAdminSubscriptions()

const subscriptions = computed(() => subsData.value ?? [])

const activeSubscriptions = computed(() =>
  subscriptions.value.filter(s => s.status === 'ACTIVE')
)
const inactiveSubscriptions = computed(() =>
  subscriptions.value.filter(s => s.status !== 'ACTIVE')
)

const tabs = [
  { label: 'Active', slot: 'active' as const },
  { label: 'Inactive', slot: 'inactive' as const }
]

async function deactivate(id: string) {
  try {
    await deactivateSubscription(id)
    toast.add({ title: 'Subscription deactivated', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to deactivate subscription', color: 'error' })
  }
}

async function reactivate(id: string) {
  try {
    await reactivateSubscription(id)
    toast.add({ title: 'Subscription reactivated', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to reactivate subscription', color: 'error' })
  }
}
</script>

<template>
  <div class="space-y-5 p-6 sm:p-9">
    <PageHeader title="Subscriptions" :subtitle="`${subscriptions.length} subscriptions`" />

    <UTabs :items="tabs">
        <template #active>
          <div class="mt-3">
            <UEmpty
              v-if="!activeSubscriptions.length"
              icon="i-lucide-package-check"
              label="No active subscriptions."
            />
            <div v-else class="overflow-hidden rounded-[10px] border border-default bg-default">
              <SubscriptionList
                :subscriptions="activeSubscriptions"
                @deactivate="deactivate"
                @reactivate="reactivate"
              />
            </div>
          </div>
        </template>
        <template #inactive>
          <div class="mt-3">
            <UEmpty
              v-if="!inactiveSubscriptions.length"
              icon="i-lucide-package-x"
              label="No inactive subscriptions."
            />
            <div v-else class="overflow-hidden rounded-[10px] border border-default bg-default">
              <SubscriptionList
                :subscriptions="inactiveSubscriptions"
                @deactivate="deactivate"
                @reactivate="reactivate"
              />
            </div>
          </div>
        </template>
      </UTabs>
  </div>
</template>
