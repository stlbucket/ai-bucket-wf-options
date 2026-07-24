<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type {
  PollDetailView,
  AnswerDraft,
  DateAnswerDraft,
  AttributedResponseView,
} from '@function-bucket/fnb-graphql-client-api'
import type { PollQuestion, PollQuestionResult } from '@function-bucket/fnb-types'

const props = defineProps<{
  poll: PollDetailView
  readonly?: boolean
  // inline per-question results (spec [id].ui.md Mode C) — empty/hidden when not visible
  results?: PollQuestionResult[]
  attributed?: AttributedResponseView[]
  showResults?: boolean
}>()
const emit = defineEmits<{
  (e: 'save', answers: AnswerDraft[]): void
  (e: 'submit', answers: AnswerDraft[]): void
}>()

const OTHER = '__other__'

interface DateState {
  yesNo: boolean | null
  note: string
}
interface QState {
  single: string | null // optionId or OTHER
  multi: string[]
  otherChecked: boolean
  yesNo: boolean | null
  otherText: string
  note: string
  answerAt: string
  dates: Record<string, DateState> // date_yes_no: per option
}

const state = reactive<Record<string, QState>>({})

function toLocal(d: Date | null): string {
  if (!d) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function seed() {
  for (const q of props.poll.questions) {
    const mine = (props.poll.myResponse?.answers ?? []).filter((a) => a.questionId === q.id)
    const other = mine.find((a) => a.otherText != null)
    const at = mine.find((a) => a.answerAt != null)?.answerAt ?? null
    const dates: Record<string, DateState> = {}
    if (q.questionType === 'DATE_YES_NO') {
      for (const o of q.options) {
        const a = mine.find((x) => x.optionId === o.id)
        dates[o.id] = { yesNo: a?.yesNo ?? null, note: a?.note ?? '' }
      }
    }
    state[q.id] = {
      single:
        q.questionType === 'MULTIPLE_CHOICE' && q.maxSelections === 1
          ? (other ? OTHER : (mine.find((a) => a.optionId)?.optionId ?? null))
          : null,
      multi:
        q.questionType === 'MULTIPLE_CHOICE'
          ? mine.filter((a) => a.optionId).map((a) => a.optionId as string)
          : [],
      otherChecked: !!other,
      yesNo: q.questionType === 'YES_NO' ? (mine.find((a) => a.yesNo != null)?.yesNo ?? null) : null,
      otherText: other?.otherText ?? '',
      note: q.questionType !== 'DATE_YES_NO' ? (mine.find((a) => a.note != null)?.note ?? '') : '',
      answerAt: toLocal(at),
      dates,
    }
  }
}
watch(() => props.poll.id + ':' + (props.poll.myResponse?.id ?? ''), seed, { immediate: true })

function isMulti(q: PollQuestion) {
  return q.questionType === 'MULTIPLE_CHOICE' && q.maxSelections !== 1
}
function yesNoItems() {
  return [
    { label: 'Yes', value: true },
    { label: 'No', value: false },
  ]
}
function fmtOption(o: { label: string | null; candidateAt: Date | null }) {
  if (o.label && o.candidateAt) return `${o.label} — ${o.candidateAt.toLocaleString()}`
  return o.label ?? o.candidateAt?.toLocaleString() ?? '—'
}
function optionItems(q: PollQuestion) {
  const items = q.options.map((o) => ({ label: fmtOption(o), value: o.id }))
  if (q.allowOther) items.push({ label: 'Other…', value: OTHER })
  return items
}

function toggleMulti(qId: string, optionId: string, checked: boolean) {
  const s = state[qId]!
  if (checked) {
    if (!s.multi.includes(optionId)) s.multi.push(optionId)
  } else {
    s.multi = s.multi.filter((id) => id !== optionId)
  }
}

const resultRowsByQuestion = computed(() => {
  const map = new Map<string, PollQuestionResult[]>()
  for (const r of props.results ?? []) {
    if (!map.has(r.questionId)) map.set(r.questionId, [])
    map.get(r.questionId)!.push(r)
  }
  return map
})
function rowsFor(q: PollQuestion) {
  return resultRowsByQuestion.value.get(q.id) ?? []
}

function build(): AnswerDraft[] {
  const out: AnswerDraft[] = []
  for (const q of props.poll.questions) {
    const s = state[q.id]
    if (!s) continue
    const answerAt = q.collectDatetime && s.answerAt ? new Date(s.answerAt) : null
    const note = q.allowNote && s.note.trim() ? s.note.trim() : undefined
    if (q.questionType === 'YES_NO') {
      if (s.yesNo != null) out.push({ questionId: q.id, yesNo: s.yesNo, note, answerAt })
    } else if (q.questionType === 'DATE_YES_NO') {
      const dateAnswers: DateAnswerDraft[] = []
      for (const o of q.options) {
        const d = s.dates[o.id]
        if (d && d.yesNo != null) {
          dateAnswers.push({
            optionId: o.id,
            yesNo: d.yesNo,
            note: q.allowNote && d.note.trim() ? d.note.trim() : undefined,
          })
        }
      }
      if (dateAnswers.length) out.push({ questionId: q.id, dateAnswers })
    } else if (q.maxSelections === 1) {
      if (s.single === OTHER && s.otherText.trim()) {
        out.push({ questionId: q.id, otherText: s.otherText.trim(), note, answerAt })
      } else if (s.single && s.single !== OTHER) {
        out.push({ questionId: q.id, optionIds: [s.single], note, answerAt })
      }
    } else {
      const optionIds = [...s.multi]
      const otherText = s.otherChecked && s.otherText.trim() ? s.otherText.trim() : undefined
      if (optionIds.length || otherText) {
        out.push({ questionId: q.id, optionIds, otherText, note, answerAt })
      }
    }
  }
  return out
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div v-for="(q, i) in poll.questions" :key="q.id" class="flex flex-col gap-2">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs text-dimmed">Q{{ i + 1 }}</span>
        <span class="font-medium text-highlighted">{{ q.prompt }}</span>
        <span v-if="q.required" class="text-error">*</span>
      </div>
      <p v-if="q.contextAt" class="text-xs text-muted">
        Concerning {{ q.contextAt.toLocaleString() }}
      </p>

      <!-- yes / no -->
      <URadioGroup
        v-if="q.questionType === 'YES_NO'"
        v-model="state[q.id]!.yesNo"
        :items="yesNoItems()"
        :disabled="readonly"
        orientation="horizontal"
      />

      <!-- date list: yes/no (+ note) per date -->
      <div v-else-if="q.questionType === 'DATE_YES_NO'" class="flex flex-col gap-2">
        <div
          v-for="o in q.options"
          :key="o.id"
          class="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md bg-elevated/40 px-2.5 py-1.5"
        >
          <span class="min-w-40 text-sm">{{ fmtOption(o) }}</span>
          <URadioGroup
            v-model="state[q.id]!.dates[o.id]!.yesNo"
            :items="yesNoItems()"
            :disabled="readonly"
            orientation="horizontal"
            size="sm"
          />
          <UInput
            v-if="q.allowNote"
            v-model="state[q.id]!.dates[o.id]!.note"
            placeholder="Note…"
            :disabled="readonly"
            size="sm"
            class="w-full sm:w-56"
          />
        </div>
      </div>

      <!-- multiple choice, single -->
      <template v-else-if="!isMulti(q)">
        <URadioGroup
          v-model="state[q.id]!.single"
          :items="optionItems(q)"
          :disabled="readonly"
        />
        <UInput
          v-if="state[q.id]!.single === OTHER"
          v-model="state[q.id]!.otherText"
          placeholder="Your answer…"
          :disabled="readonly"
          class="w-full max-w-sm"
        />
      </template>

      <!-- multiple choice, multi -->
      <template v-else>
        <div class="flex flex-col gap-1.5">
          <UCheckbox
            v-for="o in q.options"
            :key="o.id"
            :model-value="state[q.id]!.multi.includes(o.id)"
            :disabled="readonly"
            :label="fmtOption(o)"
            @update:model-value="(v: boolean | 'indeterminate') => toggleMulti(q.id, o.id, v === true)"
          />
          <template v-if="q.allowOther">
            <UCheckbox
              v-model="state[q.id]!.otherChecked"
              :disabled="readonly"
              label="Other…"
            />
            <UInput
              v-if="state[q.id]!.otherChecked"
              v-model="state[q.id]!.otherText"
              placeholder="Your answer…"
              :disabled="readonly"
              class="w-full max-w-sm"
            />
          </template>
        </div>
      </template>

      <!-- respondent note (yes_no / multiple_choice; date rows carry their own) -->
      <UFormField
        v-if="q.allowNote && q.questionType !== 'DATE_YES_NO'"
        label="Add a note (optional)"
        class="max-w-sm"
      >
        <UInput v-model="state[q.id]!.note" placeholder="Note…" :disabled="readonly" />
      </UFormField>

      <!-- respondent-supplied date/time -->
      <UFormField v-if="q.collectDatetime" label="Your date/time" class="max-w-xs">
        <UInput v-model="state[q.id]!.answerAt" type="datetime-local" :disabled="readonly" />
      </UFormField>

      <!-- inline results: collapsed summary, expandable (spec Mode C) -->
      <PollResults
        v-if="showResults && rowsFor(q).length"
        :question="q"
        :rows="rowsFor(q)"
        :attributed="attributed ?? []"
      />
    </div>

    <div v-if="!readonly" class="flex gap-3">
      <UButton variant="outline" color="neutral" @click="emit('save', build())">Save draft</UButton>
      <UButton @click="emit('submit', build())">Submit</UButton>
    </div>
  </div>
</template>
