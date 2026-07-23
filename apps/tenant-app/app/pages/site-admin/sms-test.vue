<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Notification } from '@function-bucket/fnb-types'
import { useSendTest } from '~/composables/useSendTest'
import { useRecentNotifications } from '~/composables/useRecentNotifications'

// SMS-Test page (notifications spec, sms-test.ui.md / sms-test.data.md). Dev SMS uses the log-sink
// (D11 — nothing is dispatched), so THIS page is the "Mailpit for SMS": it composes an SMS through
// the shared send-notification chokepoint (reusing useSendTest with channel SMS) and renders the
// captured notify.notification rows — body and all — as the in-app inbox. p:app-admin-super (the
// notify_api.notifications read fn + the triggerWorkflow send key both enforce it in SQL, R12).
const toast = useToast()

const { send, fetching: sending } = useSendTest()
const { notifications, fetching, error, refresh } = useRecentNotifications('SMS')

// Static v1 template list (mirrors send-test). phone-verify/zitadel-otp land with Phase 1/5+.
const templateItems = ['sms-test', 'phone-verify', 'zitadel-otp']

const templateKey = ref('sms-test')
const to = ref('')
const body = ref('Hello from the fnb sms-test harness.')

// The log-sink stores the send `vars` in notify.notification.payload (no dispatch), so the captured
// SMS body is payload.body for a free-text sms-test, or payload.code for a templated OTP.
const smsBody = (row: Notification): string => {
  const p = row.payload ?? {}
  if (typeof p.body === 'string') return p.body
  if (typeof p.code === 'string') return `code: ${p.code}`
  return Object.keys(p).length ? JSON.stringify(p) : '—'
}

async function onSend() {
  if (!to.value) {
    toast.add({ title: 'Enter a 10-digit US mobile number', color: 'error' })
    return
  }
  try {
    const result = await send({
      channel: 'SMS',
      templateKey: templateKey.value,
      to: to.value,
      vars: { body: body.value },
    })
    if (result.accepted) {
      toast.add({ title: 'Captured — see the SMS inbox below', color: 'success' })
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
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'templateKey', header: 'Template' },
  { accessorKey: 'recipient', header: 'To' },
  { accessorKey: 'payload', header: 'Message' },
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
      title="SMS Test"
      subtitle="Compose an SMS and read it back from the dev log-sink inbox (Mailpit for SMS)"
    />

    <UAlert
      color="info"
      variant="subtle"
      icon="i-lucide-info"
      title="Dev sink"
      description="SMS is captured, not delivered (NOTIFY_SMS_PROVIDER=log-sink). The message — including any verification code — appears in the inbox below."
    />

    <UCard>
      <template #header>
        <span class="font-medium">Compose</span>
      </template>
      <div class="grid gap-3 sm:grid-cols-2">
        <UFormField label="Template">
          <USelect
            v-model="templateKey"
            :items="templateItems"
            class="w-full"
          />
        </UFormField>
        <UFormField label="To">
          <PhoneSegments v-model="to" />
        </UFormField>
        <UFormField
          label="Message"
          class="sm:col-span-2"
        >
          <UTextarea
            v-model="body"
            class="w-full"
            :rows="3"
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
          <span class="font-medium">SMS inbox</span>
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
        title="Failed to load SMS"
        :description="String(error)"
      />
      <UEmpty
        v-else-if="!fetching && notifications.length === 0"
        icon="i-lucide-message-square-text"
        title="No SMS captured yet"
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
          <template #recipient-cell="{ row }">
            <span class="font-mono text-xs">{{ row.original.recipient }}</span>
          </template>
          <template #payload-cell="{ row }">
            <span class="text-sm">{{ smsBody(row.original) }}</span>
          </template>
          <template #provider-cell="{ row }">
            <span class="font-mono text-xs">{{ row.original.provider ?? '—' }}</span>
          </template>
        </UTable>
      </div>
    </UCard>
  </div>
</template>
