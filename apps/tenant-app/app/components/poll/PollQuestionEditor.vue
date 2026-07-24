<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import type { PollDetailView, QuestionDraft, OptionDraft } from '@function-bucket/fnb-graphql-client-api'
import type { PollQuestion, QuestionType } from '@function-bucket/fnb-types'

const props = defineProps<{ poll: PollDetailView }>()
const emit = defineEmits<{
  (e: 'upsert-question', q: QuestionDraft): void
  (e: 'delete-question', id: string): void
  (e: 'upsert-option', questionId: string, o: OptionDraft): void
  (e: 'delete-option', id: string): void
}>()

const typeItems = [
  { label: 'Yes / No', value: 'YES_NO' },
  { label: 'Multiple choice', value: 'MULTIPLE_CHOICE' },
  { label: 'Date list (yes/no per date)', value: 'DATE_YES_NO' },
]
const selModeItems = [
  { label: 'Single answer', value: 'single' },
  { label: 'Any number', value: 'multi' },
]
const typeLabel = (t: QuestionType) =>
  t === 'YES_NO' ? 'Yes / No' : t === 'DATE_YES_NO' ? 'Date list' : 'Multiple choice'

// --- new-question form state ---
const nqType = ref<QuestionType>('YES_NO')
const nqPrompt = ref('')
const nqRequired = ref(true)
const nqAllowOther = ref(false)
const nqAllowNote = ref(false)
const nqCollectDatetime = ref(false)
const nqContextAt = ref('')
const nqSelMode = ref<'single' | 'multi'>('single')

// notes default ON for the date-list type (spec D13)
watch(nqType, (t, prev) => {
  if (t === 'DATE_YES_NO') nqAllowNote.value = true
  else if (prev === 'DATE_YES_NO') nqAllowNote.value = false
})

function addQuestion() {
  if (!nqPrompt.value.trim()) return
  const isDate = nqType.value === 'DATE_YES_NO'
  emit('upsert-question', {
    questionType: nqType.value,
    prompt: nqPrompt.value.trim(),
    required: nqRequired.value,
    allowOther: nqType.value === 'MULTIPLE_CHOICE' ? nqAllowOther.value : false,
    allowNote: nqAllowNote.value,
    maxSelections:
      nqType.value === 'MULTIPLE_CHOICE' && nqSelMode.value === 'single' ? 1 : null,
    collectDatetime: isDate ? false : nqCollectDatetime.value,
    contextAt: !isDate && nqContextAt.value ? new Date(nqContextAt.value) : null,
  })
  nqPrompt.value = ''
  nqContextAt.value = ''
  nqAllowOther.value = false
  nqAllowNote.value = nqType.value === 'DATE_YES_NO'
  nqCollectDatetime.value = false
}

// --- per-question option/date adder ---
const newOptionLabel = reactive<Record<string, string>>({})
const newOptionAt = reactive<Record<string, string>>({})

function addOption(q: PollQuestion) {
  const label = (newOptionLabel[q.id] ?? '').trim()
  const at = newOptionAt[q.id]
  if (q.questionType === 'DATE_YES_NO') {
    if (!at) return // a date row requires candidate_at
    emit('upsert-option', q.id, { label: label || null, candidateAt: new Date(at) })
  } else {
    if (!label) return
    emit('upsert-option', q.id, { label, candidateAt: at ? new Date(at) : null })
  }
  newOptionLabel[q.id] = ''
  newOptionAt[q.id] = ''
}

function fmtOption(o: { label: string | null; candidateAt: Date | null }) {
  if (o.label && o.candidateAt) return `${o.label} — ${o.candidateAt.toLocaleString()}`
  return o.label ?? o.candidateAt?.toLocaleString() ?? '—'
}

function selModeLabel(q: PollQuestion) {
  if (q.questionType !== 'MULTIPLE_CHOICE') return ''
  return q.maxSelections === 1 ? 'single-select' : 'multi-select'
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <!-- existing questions -->
    <div v-if="poll.questions.length" class="flex flex-col gap-4">
      <UCard v-for="(q, i) in poll.questions" :key="q.id" :ui="{ body: 'p-4 sm:p-4' }">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-xs text-dimmed">Q{{ i + 1 }}</span>
              <span class="font-medium text-highlighted">{{ q.prompt }}</span>
            </div>
            <div class="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
              <UBadge color="neutral" variant="subtle" size="sm">
                {{ typeLabel(q.questionType) }}
              </UBadge>
              <UBadge v-if="selModeLabel(q)" color="info" variant="subtle" size="sm">
                {{ selModeLabel(q) }}
              </UBadge>
              <UBadge v-if="q.allowOther" color="neutral" variant="outline" size="sm">
                + Other
              </UBadge>
              <UBadge v-if="q.allowNote" color="neutral" variant="outline" size="sm">
                + notes
              </UBadge>
              <UBadge v-if="q.collectDatetime" color="neutral" variant="outline" size="sm">
                asks date/time
              </UBadge>
              <span v-if="q.contextAt" class="text-muted">
                · {{ q.contextAt.toLocaleString() }}
              </span>
              <span v-if="!q.required" class="text-muted">· optional</span>
            </div>
          </div>
          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            size="xs"
            @click="emit('delete-question', q.id)"
          />
        </div>

        <!-- options (multiple choice) / dates (date list) -->
        <div
          v-if="q.questionType === 'MULTIPLE_CHOICE' || q.questionType === 'DATE_YES_NO'"
          class="mt-3 flex flex-col gap-2 pl-4"
        >
          <div
            v-for="o in q.options"
            :key="o.id"
            class="flex items-center justify-between gap-2 text-sm"
          >
            <span>{{ fmtOption(o) }}</span>
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="xs"
              @click="emit('delete-option', o.id)"
            />
          </div>

          <!-- date list adder: date required, label optional -->
          <div v-if="q.questionType === 'DATE_YES_NO'" class="flex flex-wrap items-end gap-2">
            <UInput v-model="newOptionAt[q.id]" type="datetime-local" size="sm" />
            <UInput
              v-model="newOptionLabel[q.id]"
              placeholder="Label (optional)…"
              size="sm"
              class="w-40"
              @keyup.enter="addOption(q)"
            />
            <UButton
              icon="i-lucide-plus"
              variant="outline"
              color="neutral"
              size="xs"
              :disabled="!newOptionAt[q.id]"
              @click="addOption(q)"
            >
              Add date
            </UButton>
          </div>

          <!-- choice adder: label required -->
          <div v-else class="flex flex-wrap items-end gap-2">
            <UInput
              v-model="newOptionLabel[q.id]"
              placeholder="Option label…"
              size="sm"
              class="w-48"
              @keyup.enter="addOption(q)"
            />
            <UInput v-model="newOptionAt[q.id]" type="datetime-local" size="sm" />
            <UButton
              icon="i-lucide-plus"
              variant="outline"
              color="neutral"
              size="xs"
              :disabled="!(newOptionLabel[q.id] || '').trim()"
              @click="addOption(q)"
            >
              Add option
            </UButton>
          </div>
        </div>
      </UCard>
    </div>

    <!-- add question -->
    <UCard :ui="{ body: 'p-4 sm:p-4' }">
      <div class="flex flex-col gap-3">
        <span class="text-sm font-medium text-highlighted">Add a question</span>
        <UFormField label="Prompt" required>
          <UInput v-model="nqPrompt" placeholder="Ask something…" class="w-full" />
        </UFormField>
        <div class="flex flex-wrap gap-4">
          <UFormField label="Type">
            <URadioGroup v-model="nqType" :items="typeItems" orientation="horizontal" />
          </UFormField>
          <UFormField v-if="nqType === 'MULTIPLE_CHOICE'" label="Selection">
            <URadioGroup v-model="nqSelMode" :items="selModeItems" orientation="horizontal" />
          </UFormField>
        </div>
        <div class="flex flex-wrap items-center gap-4">
          <UFormField label="Required"><USwitch v-model="nqRequired" /></UFormField>
          <UFormField v-if="nqType === 'MULTIPLE_CHOICE'" label="Allow “Other”">
            <USwitch v-model="nqAllowOther" />
          </UFormField>
          <UFormField label="Allow notes"><USwitch v-model="nqAllowNote" /></UFormField>
          <UFormField v-if="nqType !== 'DATE_YES_NO'" label="Ask for a date/time">
            <USwitch v-model="nqCollectDatetime" />
          </UFormField>
          <UFormField v-if="nqType !== 'DATE_YES_NO'" label="Context date/time (optional)">
            <UInput v-model="nqContextAt" type="datetime-local" size="sm" />
          </UFormField>
        </div>
        <p v-if="nqType === 'DATE_YES_NO'" class="text-xs text-muted">
          Add the candidate dates to the question after creating it — members answer yes/no per
          date{{ nqAllowNote ? ' and can attach a note' : '' }}.
        </p>
        <div>
          <UButton
            icon="i-lucide-plus"
            size="sm"
            :disabled="!nqPrompt.trim()"
            @click="addQuestion"
          >
            Add question
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
