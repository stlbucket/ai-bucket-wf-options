<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { AttachmentFile } from '~/components/AttachmentsPanel.vue'

const route = useRoute()
const toast = useToast()
const { user } = useAuth()

const {
  ticket,
  comments,
  fetching,
  closeTicket,
  reopenTicket,
  deleteTicket,
  parkTicket,
  markDuplicateTicket,
  addComment,
} = useSupportTicket(String(route.params.id))

const submitter = computed(() => ticket.value?.resident)
const tenant = computed(() => ticket.value?.tenant)

const COMMENTER_COLORS = [
  'text-primary',
  'text-info',
  'text-success',
  'text-warning',
  'text-error',
  'text-secondary',
]

function commenterColor(residentId: string): string {
  const hash = [...residentId].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return COMMENTER_COLORS[hash % COMMENTER_COLORS.length] ?? 'text-primary'
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || '?'
  )
}

function formatDay(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatMoment(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const claims = computed(() => user.value)
const isSubmitter = computed(() => ticket.value?.residentId === claims.value?.residentId)
const isAdmin = computed(() => claims.value?.permissions?.includes('p:app-admin') ?? false)
const isSupport = computed(() => claims.value?.permissions?.includes('p:app-admin-support') ?? false)
const canAdminAct = computed(() => isAdmin.value || isSupport.value)

const newComment = ref('')
const commentSubmitting = ref(false)

// Right rail visibility — persisted per user. Default open on desktop; the rail
// is `hidden lg:flex`, so the mobile accordion covers small screens regardless.
const railOpen = ref(true)
onMounted(() => {
  const saved = localStorage.getItem('ticket-detail-rail-open')
  if (saved !== null) railOpen.value = saved === 'true'
})
watch(railOpen, (v) => localStorage.setItem('ticket-detail-rail-open', String(v)))

// Mobile-only accordion between description and comments.
const attachmentsOpen = ref(false)

// Placeholder attachments — the shared upload service is not wired up yet
// (same status as the todo detail rail).
const attachments: AttachmentFile[] = [
  { name: 'keypad-error-e41.jpg', size: '1.8 MB', by: 'Marcus Reed', kind: 'image' },
  { name: 'vendor-work-order.pdf', size: '240 KB', by: 'Dana Whitfield', kind: 'pdf' },
]

async function doAction(fn: () => Promise<void>, label: string) {
  try {
    await fn()
    toast.add({ title: `Ticket ${label}`, color: 'success' })
  } catch {
    toast.add({ title: `Failed to ${label} ticket`, color: 'error' })
  }
}

const showDeleteConfirm = ref(false)

type TicketAction = { key: string, label: string, run: () => void }

// Ordered candidate actions — same gating as the previous button row. The first
// entry becomes the primary button; the rest fall into the ⋯ menu. Delete is
// always menu-only (red) and sits last.
const actions = computed<TicketAction[]>(() => {
  const t = ticket.value
  if (!t) return []
  const s = t.status
  const list: TicketAction[] = []
  const canAct = isSubmitter.value || canAdminAct.value

  if (canAct && ['open', 'parked'].includes(s)) {
    list.push({ key: 'close', label: 'Close ticket', run: () => doAction(closeTicket, 'closed') })
  }
  if (
    (isSubmitter.value && ['closed', 'duplicate', 'parked'].includes(s))
    || (canAdminAct.value && ['closed', 'parked', 'duplicate'].includes(s))
  ) {
    list.push({ key: 'reopen', label: 'Reopen', run: () => doAction(reopenTicket, 'reopened') })
  }
  if (canAdminAct.value && s === 'open') {
    list.push({ key: 'park', label: 'Park', run: () => doAction(parkTicket, 'parked') })
  }
  if (canAdminAct.value && ['open', 'parked'].includes(s)) {
    list.push({
      key: 'duplicate',
      label: 'Mark duplicate',
      run: () => doAction(markDuplicateTicket, 'marked duplicate'),
    })
  }
  if (isSubmitter.value && s !== 'deleted') {
    list.push({ key: 'delete', label: 'Delete…', run: () => (showDeleteConfirm.value = true) })
  }
  return list
})

const primaryAction = computed(() => actions.value.find((a) => a.key !== 'delete') ?? null)
const menuActions = computed(() => actions.value.filter((a) => a !== primaryAction.value))

function toMenuGroups(list: TicketAction[]): DropdownMenuItem[][] {
  const regular = list
    .filter((a) => a.key !== 'delete')
    .map((a) => ({ label: a.label, onSelect: a.run }))
  const del = list
    .filter((a) => a.key === 'delete')
    .map((a) => ({ label: a.label, icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: a.run }))
  return [regular, del].filter((g) => g.length)
}

// Desktop ⋯ excludes the primary (shown as its own button); mobile ⋯ folds
// everything in, since the primary button is hidden below `lg`.
const desktopMenuItems = computed(() => toMenuGroups(menuActions.value))
const mobileMenuItems = computed(() => toMenuGroups(actions.value))

async function submitComment() {
  if (!newComment.value.trim()) return
  commentSubmitting.value = true
  try {
    await addComment(newComment.value)
    newComment.value = ''
  } catch {
    toast.add({ title: 'Failed to add comment', color: 'error' })
  } finally {
    commentSubmitting.value = false
  }
}
</script>

<template>
  <div v-if="fetching" class="py-8 text-center text-sm text-muted">
    Loading…
  </div>

  <UCard
    v-else-if="ticket"
    class="w-full"
    :ui="{ body: 'p-0 sm:p-0' }"
  >
    <template #header>
      <div class="flex flex-col gap-2.5">
        <!-- Back link + mobile actions -->
        <div class="flex items-center justify-between gap-2">
          <UButton
            variant="link"
            color="neutral"
            size="xs"
            icon="i-lucide-arrow-left"
            to="/support/tickets"
            class="-ml-1 px-1 text-muted"
          >
            Tickets
          </UButton>
          <UDropdownMenu
            v-if="mobileMenuItems.length"
            :items="mobileMenuItems"
            :content="{ align: 'end' }"
            class="lg:hidden"
          >
            <UButton
              variant="outline"
              color="neutral"
              size="sm"
              icon="i-lucide-ellipsis"
              aria-label="More actions"
            />
          </UDropdownMenu>
        </div>

        <!-- Title row -->
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
            <h1 class="text-xl font-semibold text-highlighted">{{ ticket.title }}</h1>
            <UBadge
              :color="statusColor('ticket', ticket.status)"
              variant="subtle"
              :label="statusLabel(ticket.status)"
            />
          </div>
          <div class="hidden shrink-0 items-start gap-2 lg:flex">
            <UButton
              variant="outline"
              color="neutral"
              size="sm"
              class="whitespace-nowrap"
              :trailing-icon="railOpen ? 'i-lucide-panel-right-close' : 'i-lucide-panel-right-open'"
              @click="railOpen = !railOpen"
            >
              Attachments {{ attachments.length }}
            </UButton>
            <UButton
              v-if="primaryAction"
              variant="outline"
              color="neutral"
              size="sm"
              class="whitespace-nowrap"
              @click="primaryAction.run()"
            >
              {{ primaryAction.label }}
            </UButton>
            <UDropdownMenu
              v-if="desktopMenuItems.length"
              :items="desktopMenuItems"
              :content="{ align: 'end' }"
            >
              <UButton
                variant="outline"
                color="neutral"
                size="sm"
                icon="i-lucide-ellipsis"
                aria-label="More actions"
              />
            </UDropdownMenu>
          </div>
        </div>

        <!-- Meta row -->
        <div class="flex flex-wrap items-center gap-x-3.5 gap-y-2 text-sm">
          <div class="flex items-center gap-2">
            <span
              class="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-blue-50 text-[10px] font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300"
            >
              {{ initials(submitter?.displayName ?? submitter?.email ?? '?') }}
            </span>
            <span class="text-highlighted">{{ submitter?.displayName ?? submitter?.email ?? 'Unknown' }}</span>
            <span v-if="submitter?.displayName && submitter?.email" class="text-[11px] text-dimmed">
              {{ submitter.email }}
            </span>
            <UButton
              v-if="canAdminAct && submitter?.profileId"
              variant="link"
              color="neutral"
              size="xs"
              icon="i-lucide-arrow-up-right"
              :to="`/site-admin/user/${submitter.profileId}`"
              class="p-0 text-dimmed"
              aria-label="View resident"
            />
          </div>

          <span class="h-[18px] w-px bg-[var(--ui-border)]" />

          <div class="flex items-center gap-2">
            <span class="text-[11px] font-semibold uppercase tracking-wider text-dimmed">Tenant</span>
            <span class="text-highlighted">{{ tenant?.name ?? ticket.tenantId }}</span>
            <UBadge
              v-if="tenant?.status"
              :color="statusColor('tenant', String(tenant.status))"
              variant="subtle"
              size="sm"
              :label="statusLabel(String(tenant.status))"
            />
            <UButton
              v-if="canAdminAct && tenant"
              variant="link"
              color="neutral"
              size="xs"
              icon="i-lucide-arrow-up-right"
              :to="`/site-admin/tenant/${ticket.tenantId}`"
              class="p-0 text-dimmed"
              aria-label="View tenant"
            />
          </div>

          <span class="h-[18px] w-px bg-[var(--ui-border)]" />

          <span class="text-muted">Opened {{ formatDay(ticket.createdAt) }}</span>
        </div>
      </div>
    </template>

    <!-- Body -->
    <div class="flex min-h-[24rem] flex-col items-stretch lg:flex-row">
      <!-- Main column -->
      <div class="flex min-w-0 flex-1 flex-col gap-6 p-5 sm:px-6">
        <!-- Description -->
        <section>
          <div class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
            Description
          </div>
          <p class="max-w-[62ch] whitespace-pre-wrap text-sm leading-relaxed text-toned">
            {{ ticket.description }}
          </p>
        </section>

        <!-- Attachments accordion (mobile only) -->
        <section class="lg:hidden">
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-lg border border-default bg-muted px-3.5 py-3 text-left"
            @click="attachmentsOpen = !attachmentsOpen"
          >
            <UIcon
              :name="attachmentsOpen ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
              class="size-4 text-dimmed"
            />
            <span class="text-xs font-semibold text-toned">Attachments</span>
            <span class="font-mono text-[11px] text-dimmed">{{ attachments.length }}</span>
            <span class="flex-1" />
            <span class="text-[11px] font-semibold text-primary">Upload</span>
          </button>
          <div v-if="attachmentsOpen" class="pt-3">
            <AttachmentsPanel :files="attachments" />
          </div>
        </section>

        <!-- Comments -->
        <section class="flex flex-1 flex-col">
          <div class="mb-2.5 flex items-baseline gap-2">
            <span class="text-[11px] font-semibold uppercase tracking-wider text-muted">Comments</span>
            <span class="font-mono text-[11px] text-muted">{{ comments.length }}</span>
          </div>

          <UEmpty
            v-if="!comments.length"
            icon="i-lucide-message-square"
            label="No comments yet."
          />
          <div v-else class="flex flex-col gap-2.5">
            <div
              v-for="comment in comments"
              :key="comment.id"
              class="flex flex-col gap-1 rounded-lg border border-default px-3.5 py-2.5"
            >
              <div class="flex items-baseline gap-2">
                <span :class="['text-xs font-semibold', commenterColor(comment.residentId)]">
                  {{ comment.resident?.displayName ?? comment.resident?.email ?? 'Unknown' }}
                </span>
                <span class="text-[11px] text-dimmed">{{ formatMoment(comment.createdAt) }}</span>
              </div>
              <p class="whitespace-pre-wrap text-[13px] leading-relaxed text-toned">{{ comment.body }}</p>
            </div>
          </div>

          <!-- Composer -->
          <div v-if="ticket.status !== 'DELETED'" class="mt-auto flex flex-col gap-2 pt-4">
            <UTextarea v-model="newComment" placeholder="Add a comment…" :rows="3" class="w-full" />
            <div class="flex justify-end">
              <UButton
                :loading="commentSubmitting"
                :disabled="!newComment.trim()"
                size="sm"
                class="max-lg:w-full max-lg:justify-center max-lg:py-2.5"
                @click="submitComment"
              >
                Add comment
              </UButton>
            </div>
          </div>
        </section>
      </div>

      <!-- Attachments rail (desktop only) -->
      <aside
        v-if="railOpen"
        class="hidden w-80 shrink-0 flex-col gap-3 border-l border-default bg-muted p-[18px] lg:flex"
      >
        <div class="flex items-center justify-between">
          <div class="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Attachments · {{ attachments.length }}
          </div>
          <button type="button" class="text-[11px] font-semibold text-primary hover:underline">
            Upload
          </button>
        </div>
        <AttachmentsPanel :files="attachments" />
      </aside>
    </div>
  </UCard>

  <div v-else class="text-sm text-muted">Ticket not found.</div>

  <!-- Delete confirmation -->
  <UModal v-model:open="showDeleteConfirm">
    <template #header>
      <h3 class="text-base font-semibold">Delete ticket</h3>
    </template>
    <template #body>
      <p class="text-sm">
        Are you sure you want to delete this ticket? This cannot be undone.
      </p>
    </template>
    <template #footer>
      <div class="flex gap-2">
        <UButton
          color="error"
          @click="() => { showDeleteConfirm = false; doAction(deleteTicket, 'deleted') }"
        >
          Delete
        </UButton>
        <UButton variant="ghost" color="neutral" @click="showDeleteConfirm = false">
          Cancel
        </UButton>
      </div>
    </template>
  </UModal>
</template>
