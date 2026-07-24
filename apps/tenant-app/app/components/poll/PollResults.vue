<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AttributedResponseView } from '@function-bucket/fnb-graphql-client-api'
import type { PollAnswer, PollQuestion, PollQuestionResult } from '@function-bucket/fnb-types'

// Inline, per-question results: a collapsed one-line summary that expands to the full
// breakdown (+ attributed rows incl. notes when the caller may see them). Rendered by
// PollResponseForm under each question block (spec [id].ui.md Mode C).
const props = defineProps<{
  question: PollQuestion
  rows: PollQuestionResult[] // pre-filtered to this question
  attributed: AttributedResponseView[] // full list; filtered to this question here
}>()

const open = ref(false)

const respondentCount = computed(() => props.rows[0]?.respondentCount ?? 0)

const yesNoRow = computed(
  () => props.rows.find((r) => r.optionId == null && r.label == null) ?? null,
)
const optionRows = computed(() =>
  props.question.options.map((o) => ({
    option: o,
    row: props.rows.find((r) => r.optionId === o.id) ?? null,
  })),
)
const otherRow = computed(() => props.rows.find((r) => r.label === 'Other') ?? null)

function fmtOption(o: { label: string | null; candidateAt: Date | null }) {
  if (o.label && o.candidateAt) return `${o.label} — ${o.candidateAt.toLocaleString()}`
  return o.label ?? o.candidateAt?.toLocaleString() ?? '—'
}
function pct(count: number, denom: number) {
  return denom > 0 ? Math.round((count / denom) * 100) : 0
}

// winning date option (date_yes_no): most yes votes
const bestDate = computed(() => {
  if (props.question.questionType !== 'DATE_YES_NO') return null
  let best: (typeof optionRows.value)[number] | null = null
  for (const or of optionRows.value) {
    if ((or.row?.yesCount ?? 0) > 0 && (or.row?.yesCount ?? 0) > (best?.row?.yesCount ?? 0)) {
      best = or
    }
  }
  return best
})
// leading choice (multiple_choice): most votes
const leading = computed(() => {
  if (props.question.questionType !== 'MULTIPLE_CHOICE') return null
  let best: (typeof optionRows.value)[number] | null = null
  for (const or of optionRows.value) {
    if ((or.row?.voteCount ?? 0) > 0 && (or.row?.voteCount ?? 0) > (best?.row?.voteCount ?? 0)) {
      best = or
    }
  }
  return best
})

const summary = computed(() => {
  const n = respondentCount.value
  const suffix = `${n} response${n === 1 ? '' : 's'}`
  if (props.question.questionType === 'YES_NO') {
    const y = yesNoRow.value?.yesCount ?? 0
    const no = yesNoRow.value?.noCount ?? 0
    return `${y} yes · ${no} no · ${suffix}`
  }
  if (props.question.questionType === 'DATE_YES_NO') {
    return bestDate.value
      ? `Best date: ${fmtOption(bestDate.value.option)} · ${suffix}`
      : `No votes yet · ${suffix}`
  }
  return leading.value
    ? `Leading: ${fmtOption(leading.value.option)} · ${suffix}`
    : `No votes yet · ${suffix}`
})

// attributed rows for THIS question (RLS already decided whether other members' rows exist)
const attributedForQuestion = computed(() =>
  props.attributed
    .map((r) => ({
      id: r.id,
      displayName: r.displayName,
      submittedAt: r.submittedAt,
      answers: r.answers.filter((a) => a.questionId === props.question.id),
    }))
    .filter((r) => r.answers.length > 0),
)

function answerText(a: PollAnswer): string {
  const parts: string[] = []
  if (props.question.questionType === 'DATE_YES_NO') {
    const o = props.question.options.find((x) => x.id === a.optionId)
    parts.push(`${o ? fmtOption(o) : '—'}: ${a.yesNo ? 'Yes' : 'No'}`)
  } else if (a.yesNo != null) {
    parts.push(a.yesNo ? 'Yes' : 'No')
  } else if (a.optionId) {
    const o = props.question.options.find((x) => x.id === a.optionId)
    parts.push(o ? fmtOption(o) : '—')
  } else if (a.otherText) {
    parts.push(`Other: ${a.otherText}`)
  }
  if (a.answerAt) parts.push(a.answerAt.toLocaleString())
  if (a.note) parts.push(`“${a.note}”`)
  return parts.join(' · ')
}
</script>

<template>
  <UCollapsible v-model:open="open" :ui="{ content: 'pt-2' }">
    <button
      type="button"
      class="flex w-full items-center justify-between gap-2 rounded-md bg-elevated/50 px-2.5 py-1.5 text-left text-xs text-muted transition-colors hover:text-highlighted"
    >
      <span class="flex min-w-0 items-center gap-1.5">
        <UIcon name="i-lucide-chart-bar" class="size-3.5 shrink-0" />
        <span class="truncate">{{ summary }}</span>
      </span>
      <UIcon
        name="i-lucide-chevron-down"
        class="size-3.5 shrink-0 transition-transform duration-150"
        :class="open ? '' : '-rotate-90'"
      />
    </button>

    <template #content>
      <div class="flex flex-col gap-3 px-1">
        <!-- yes / no -->
        <template v-if="question.questionType === 'YES_NO'">
          <div
            v-for="opt in [
              { label: 'Yes', count: yesNoRow?.yesCount ?? 0 },
              { label: 'No', count: yesNoRow?.noCount ?? 0 },
            ]"
            :key="opt.label"
          >
            <div class="mb-0.5 flex justify-between text-sm">
              <span>{{ opt.label }}</span>
              <span class="text-muted">
                {{ opt.count }} ·
                {{ pct(opt.count, (yesNoRow?.yesCount ?? 0) + (yesNoRow?.noCount ?? 0)) }}%
              </span>
            </div>
            <div class="h-2 w-full overflow-hidden rounded-full bg-elevated">
              <div
                class="h-full rounded-full bg-primary"
                :style="{
                  width:
                    pct(opt.count, (yesNoRow?.yesCount ?? 0) + (yesNoRow?.noCount ?? 0)) + '%',
                }"
              />
            </div>
          </div>
        </template>

        <!-- date list: per-date yes/no tallies -->
        <template v-else-if="question.questionType === 'DATE_YES_NO'">
          <div v-for="or in optionRows" :key="or.option.id">
            <div class="mb-0.5 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span class="flex items-center gap-1.5">
                {{ fmtOption(or.option) }}
                <UBadge
                  v-if="bestDate && bestDate.option.id === or.option.id"
                  color="primary"
                  variant="subtle"
                  size="sm"
                >
                  best
                </UBadge>
              </span>
              <span class="text-muted">
                {{ or.row?.yesCount ?? 0 }} yes · {{ or.row?.noCount ?? 0 }} no
              </span>
            </div>
            <div class="h-2 w-full overflow-hidden rounded-full bg-elevated">
              <div
                class="h-full rounded-full bg-primary"
                :style="{
                  width:
                    pct(
                      or.row?.yesCount ?? 0,
                      (or.row?.yesCount ?? 0) + (or.row?.noCount ?? 0),
                    ) + '%',
                }"
              />
            </div>
          </div>
        </template>

        <!-- multiple choice -->
        <template v-else>
          <div v-for="or in optionRows" :key="or.option.id">
            <div class="mb-0.5 flex justify-between text-sm">
              <span>{{ fmtOption(or.option) }}</span>
              <span class="text-muted">
                {{ or.row?.voteCount ?? 0 }} ·
                {{ pct(or.row?.voteCount ?? 0, respondentCount) }}%
              </span>
            </div>
            <div class="h-2 w-full overflow-hidden rounded-full bg-elevated">
              <div
                class="h-full rounded-full bg-primary"
                :style="{ width: pct(or.row?.voteCount ?? 0, respondentCount) + '%' }"
              />
            </div>
          </div>
          <div v-if="question.allowOther && (otherRow?.otherCount ?? 0) > 0" class="text-sm text-muted">
            Other: {{ otherRow?.otherCount }}
          </div>
        </template>

        <!-- attributed detail (names + notes — only ever populated when RLS allows) -->
        <div v-if="attributedForQuestion.length" class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-dimmed">
                <th class="py-1 pr-4">Member</th>
                <th class="py-1">Answer</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in attributedForQuestion" :key="r.id" class="border-t border-default">
                <td class="py-1.5 pr-4 align-top whitespace-nowrap">{{ r.displayName ?? '—' }}</td>
                <td class="py-1.5 text-muted">
                  <div v-for="a in r.answers" :key="a.id">{{ answerText(a) }}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </UCollapsible>
</template>
