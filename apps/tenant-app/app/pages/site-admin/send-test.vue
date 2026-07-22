<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Notification, NotificationChannel } from '@function-bucket/fnb-types'
import { useSendTest } from '~/composables/useSendTest'
import { useRecentNotifications } from '~/composables/useRecentNotifications'

const toast = useToast()

const { send, fetching: sending } = useSendTest()
const { notifications, fetching, error, refresh } = useRecentNotifications()

// v1 ships email only; SMS dispatch is a later phase (notifications spec, sms-2fa.future.md).
const channelItems = [
  { label: 'Email', value: 'EMAIL' },
  { label: 'SMS (coming soon)', value: 'SMS', disabled: true },
]
const templateItems = ['test', 'user-invitation', 'zitadel-init']

const channel = ref<NotificationChannel>('EMAIL')
const templateKey = ref('test')
const to = ref('')
const subject = ref('fnb test notification')
const body = ref('<p>Hello from the fnb send-test harness.</p>')

async function onSend() {
  if (!to.value.trim()) {
    toast.add({ title: 'Recipient is required', color: 'error' })
    return
  }
  try {
    const result = await send({
      channel: channel.value,
      templateKey: templateKey.value,
      to: to.value.trim(),
      subject: subject.value,
      vars: { body: body.value },
    })
    if (result.accepted) {
      toast.add({ title: 'Queued — check Mailpit', color: 'success' })
    } else {
      toast.add({ title: 'Send was not accepted', color: 'warning' })
    }
    refresh()
  } catch {
    toast.add({ title: 'Send failed', color: 'error' })
  }
}

const columns: TableColumn<Notification>[] = [
  { accessorKey: 'createdAt', header: 'Created' },
  { accessorKey: 'channel', header: 'Channel' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'templateKey', header: 'Template' },
  { accessorKey: 'recipient', header: 'Recipient' },
  { accessorKey: 'provider', header: 'Provider' },
]

const statusColor = (status: Notification['status']) =>
  ({
    QUEUED: 'neutral',
    SENT: 'info',
    DELIVERED: 'success',
    OPENED: 'success',
    BOUNCED: 'error',
    FAILED: 'error',
  } as const)[status] ?? 'neutral'
</script>

<template>
  <div class="max-w-5xl mx-auto space-y-5 p-6 sm:p-9">
    <PageHeader
      title="Send Test"
      subtitle="Compose and send a notification through the send-notification pipeline"
    />

    <UCard>
      <template #header>
        <span class="font-medium">Compose</span>
      </template>
      <div class="grid gap-3 sm:grid-cols-2">
        <UFormField label="Channel">
          <USelect
            v-model="channel"
            :items="channelItems"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Template">
          <USelect
            v-model="templateKey"
            :items="templateItems"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="To"
          class="sm:col-span-2"
        >
          <UInput
            v-model="to"
            placeholder="recipient@example.com"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Subject"
          class="sm:col-span-2"
        >
          <UInput
            v-model="subject"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Body (HTML)"
          class="sm:col-span-2"
        >
          <UTextarea
            v-model="body"
            class="w-full font-mono"
            :rows="4"
          />
        </UFormField>
      </div>
      <template #footer>
        <UButton
          icon="i-lucide-send"
          :loading="sending"
          @click="onSend"
        >
          Send
        </UButton>
      </template>
    </UCard>

    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <span class="font-medium">Recent sends</span>
          <UButton
            icon="i-lucide-refresh-cw"
            variant="ghost"
            :loading="fetching"
            @click="refresh()"
          />
        </div>
      </template>

      <UAlert
        v-if="error"
        color="error"
        title="Failed to load notifications"
        :description="String(error)"
      />
      <UEmpty
        v-else-if="!fetching && notifications.length === 0"
        icon="i-lucide-inbox"
        title="No notifications yet"
      />
      <div
        v-else
        class="overflow-x-auto"
      >
        <UTable
          :data="notifications"
          :columns="columns"
        >
          <template #createdAt-cell="{ row }">
            {{ row.original.createdAt.toLocaleString() }}
          </template>
          <template #status-cell="{ row }">
            <UBadge
              :color="statusColor(row.original.status)"
              variant="subtle"
            >
              {{ row.original.status }}
            </UBadge>
          </template>
          <template #provider-cell="{ row }">
            <span class="font-mono text-xs">{{ row.original.provider ?? '—' }}</span>
          </template>
        </UTable>
      </div>
    </UCard>
  </div>
</template>
