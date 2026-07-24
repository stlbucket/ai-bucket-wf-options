<script setup lang="ts">
import { formatUrn } from '@function-bucket/fnb-types'
import type { QuestionDraft, OptionDraft, AnswerDraft } from '@function-bucket/fnb-graphql-client-api'
import type { ResultsVisibility } from '@function-bucket/fnb-types'

const route = useRoute()
const toast = useToast()
const pollId = route.params.id as string

const { user } = useAuth()
const myUrn = computed(() => {
  const u = user.value
  if (!u?.residentId || !u?.tenantId) return ''
  return formatUrn({ tenantId: u.tenantId, module: 'app', resourceType: 'resident', id: u.residentId })
})
const hasPerm = (k: string) => user.value?.permissions?.includes(k) ?? false

const {
  poll,
  results,
  attributed,
  fetching,
  updatePoll,
  setPollOptions,
  setStatus,
  deletePoll,
  upsertQuestion,
  deleteQuestion,
  upsertOption,
  deleteOption,
  saveResponse,
  submitResponse,
} = usePollDetail(pollId, myUrn)

watch([poll, fetching], () => {
  if (!fetching.value && !poll.value) navigateTo('/tools/poll')
})

const canAdmin = computed(
  () => !!poll.value && (hasPerm('p:poll-admin') || poll.value.createdByResidentUrn === myUrn.value),
)
const isDraft = computed(() => poll.value?.status === 'DRAFT')
const isOpen = computed(() => poll.value?.status === 'OPEN')
const isClosed = computed(() => poll.value?.status === 'CLOSED')

const showEditor = computed(() => canAdmin.value && isDraft.value)
const resultsVisible = computed(
  () => !!poll.value && (poll.value.resultsVisibility !== 'HIDDEN' || canAdmin.value),
)
const locked = computed(
  () =>
    !!poll.value &&
    !poll.value.allowChangeAfterSubmit &&
    !!poll.value.myResponse?.submittedAt,
)
const formReadonly = computed(() => isClosed.value || locked.value)

const statusColor = (s: string) => (s === 'OPEN' ? 'success' : s === 'DRAFT' ? 'neutral' : 'info')
const visColor = (v: string) =>
  v === 'ATTRIBUTED' ? 'primary' : v === 'AGGREGATE' ? 'info' : 'neutral'

const confirmDelete = ref(false)

async function guard(fn: () => Promise<void>, failMsg: string) {
  try {
    await fn()
  } catch (e) {
    toast.add({ title: failMsg, description: (e as Error)?.message, color: 'error' })
  }
}

const onOpen = () => guard(() => setStatus('OPEN'), 'Could not open the poll')
const onClose = () => guard(() => setStatus('CLOSED'), 'Could not close the poll')
const onReopen = () => guard(() => setStatus('OPEN'), 'Could not reopen the poll')
const onSaveSettings = (p: {
  allowChangeAfterSubmit: boolean
  resultsVisibility: ResultsVisibility
  closesAt: Date | null
}) =>
  guard(async () => {
    await setPollOptions(p.allowChangeAfterSubmit, p.resultsVisibility)
    await updatePoll({ closesAt: p.closesAt })
    toast.add({ title: 'Settings saved', color: 'success' })
  }, 'Could not save settings')

async function onDelete() {
  confirmDelete.value = false
  await guard(async () => {
    await deletePoll()
    await navigateTo('/tools/poll')
  }, 'Could not delete the poll')
}

const onUpsertQuestion = (q: QuestionDraft) =>
  guard(() => upsertQuestion(q), 'Could not save the question')
const onDeleteQuestion = (id: string) =>
  guard(() => deleteQuestion(id), 'Could not delete the question')
const onUpsertOption = (questionId: string, o: OptionDraft) =>
  guard(() => upsertOption(questionId, o), 'Could not save the option')
const onDeleteOption = (id: string) => guard(() => deleteOption(id), 'Could not delete the option')

const onSave = (answers: AnswerDraft[]) =>
  guard(async () => {
    await saveResponse(answers)
    toast.add({ title: 'Saved', color: 'success' })
  }, 'Could not save your answers')
const onSubmit = (answers: AnswerDraft[]) =>
  guard(async () => {
    await submitResponse(answers)
    toast.add({ title: 'Submitted', color: 'success' })
  }, 'Could not submit your answers')
</script>

<template>
  <ClientOnly>
    <!-- draft = single column (3xl); published = two columns (5xl): Q&A left, discussion right -->
    <div class="mx-auto space-y-5 p-6 sm:p-9" :class="isDraft ? 'max-w-3xl' : 'max-w-5xl'">
      <ULink to="/tools/poll" class="text-sm text-muted">← All polls</ULink>

      <div v-if="fetching && !poll" class="py-8 text-center text-sm text-muted">Loading…</div>

      <template v-else-if="poll">
        <!-- header -->
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 class="text-2xl font-semibold text-highlighted">{{ poll.title }}</h1>
            <p v-if="poll.description" class="mt-1 text-sm text-muted">{{ poll.description }}</p>
            <div class="mt-2 flex flex-wrap items-center gap-1.5">
              <UBadge :color="statusColor(poll.status)" variant="subtle" size="sm">
                {{ poll.status.toLowerCase() }}
              </UBadge>
              <UBadge :color="visColor(poll.resultsVisibility)" variant="outline" size="sm">
                results: {{ poll.resultsVisibility.toLowerCase() }}
              </UBadge>
              <UBadge v-if="poll.createdByName" color="neutral" variant="subtle" size="sm">
                by {{ poll.createdByName }}
              </UBadge>
            </div>
          </div>

          <div v-if="canAdmin" class="flex flex-wrap items-center gap-2">
            <UButton v-if="isDraft" icon="i-lucide-play" size="sm" @click="onOpen">Open</UButton>
            <UButton
              v-else-if="isOpen"
              icon="i-lucide-square"
              size="sm"
              color="neutral"
              variant="outline"
              @click="onClose"
            >
              Close
            </UButton>
            <UButton
              v-else-if="isClosed"
              icon="i-lucide-rotate-ccw"
              size="sm"
              color="neutral"
              variant="outline"
              @click="onReopen"
            >
              Reopen
            </UButton>
            <PollSettingsModal :poll="poll" @save="onSaveSettings" />
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="sm"
              @click="confirmDelete = true"
            />
            <!-- OTP "Copy quick-login link" / "Send to residents" go here once otp-login ships -->
          </div>
        </div>

        <!-- draft editor -->
        <UCard v-if="showEditor">
          <template #header>
            <span class="font-medium text-highlighted">Questions</span>
          </template>
          <PollQuestionEditor
            :poll="poll"
            @upsert-question="onUpsertQuestion"
            @delete-question="onDeleteQuestion"
            @upsert-option="onUpsertOption"
            @delete-option="onDeleteOption"
          />
        </UCard>

        <!-- draft, non-admin -->
        <UAlert
          v-else-if="isDraft"
          color="neutral"
          variant="subtle"
          icon="i-lucide-clock"
          title="Not open yet"
          description="This poll is still being prepared. Check back once it opens."
        />

        <!-- published: two columns — questions/answers (with inline results) left, discussion right -->
        <div
          v-else
          class="grid gap-5 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:items-start"
        >
          <div class="space-y-5">
            <UCard>
              <template #header>
                <div class="flex items-center justify-between">
                  <span class="font-medium text-highlighted">
                    {{ isClosed ? 'Your answers' : 'Answer' }}
                  </span>
                  <UBadge
                    v-if="poll.myResponse?.submittedAt"
                    color="success"
                    variant="subtle"
                    size="sm"
                  >
                    Submitted
                  </UBadge>
                </div>
              </template>

              <UAlert
                v-if="locked"
                class="mb-4"
                color="warning"
                variant="subtle"
                icon="i-lucide-lock"
                title="Your answers are locked"
                description="This poll does not allow changes after submitting."
              />
              <UAlert
                v-else-if="isClosed"
                class="mb-4"
                color="neutral"
                variant="subtle"
                icon="i-lucide-square"
                title="This poll is closed"
              />
              <UAlert
                v-if="!resultsVisible"
                class="mb-4"
                color="neutral"
                variant="subtle"
                icon="i-lucide-eye-off"
                title="Results aren't shared for this poll"
              />

              <PollResponseForm
                :poll="poll"
                :readonly="formReadonly"
                :results="results"
                :attributed="attributed"
                :show-results="resultsVisible"
                @save="onSave"
                @submit="onSubmit"
              />
            </UCard>
          </div>

          <!-- discussion (published polls only — hidden while drafting) -->
          <UCard>
            <template #header>
              <span class="font-medium text-highlighted">Discussion</span>
            </template>
            <PollMsg :poll-urn="poll.urn" :poll-title="poll.title" />
          </UCard>
        </div>
      </template>
    </div>

    <UModal v-model:open="confirmDelete" title="Delete poll?">
      <template #body>
        <p class="text-sm text-muted">
          This permanently deletes the poll and every response. This cannot be undone.
        </p>
        <div class="mt-4 flex gap-3">
          <UButton color="error" @click="onDelete">Delete</UButton>
          <UButton variant="ghost" color="neutral" @click="confirmDelete = false">Cancel</UButton>
        </div>
      </template>
    </UModal>
  </ClientOnly>
</template>
