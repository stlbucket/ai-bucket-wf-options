<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { AgentWorkflowRun } from '@function-bucket/fnb-types'
import { useAgentWorkflowRuns } from '~/composables/useAgentWorkflowRuns'
import { useTriggerWorkflow } from '~/composables/useTriggerWorkflow'

const toast = useToast()

const { runs, fetching, error, refresh } = useAgentWorkflowRuns()
const { triggerWorkflow, fetching: triggering } = useTriggerWorkflow()

// Mirrors the agent-engine entries of the trigger plugin's WORKFLOW_REGISTRY
// (asset-scan is deliberately absent — upload-endpoint-only).
const triggerableKeys = ['exerciser', 'sync-breweries', 'sync-airports']
const selectedKey = ref('exerciser')
const inputJson = ref('')

async function onTrigger() {
  let input: Record<string, unknown> = {}
  if (inputJson.value.trim()) {
    try {
      input = JSON.parse(inputJson.value)
    } catch {
      toast.add({ title: 'Input data is not valid JSON', color: 'error' })
      return
    }
  }
  try {
    const result = await triggerWorkflow(selectedKey.value, input)
    if (result.accepted) {
      toast.add({ title: `Accepted — run ${result.runId ?? '(started)'}`, color: 'success' })
    } else {
      toast.add({ title: 'Not started — already running', color: 'warning' })
    }
    refresh()
  } catch {
    toast.add({ title: 'Workflow trigger failed', color: 'error' })
  }
}

const columns: TableColumn<AgentWorkflowRun>[] = [
  { accessorKey: 'workflowKey', header: 'Workflow' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'model', header: 'Model' },
  { id: 'cost', header: 'Cost' },
  { accessorKey: 'startedAt', header: 'Started' },
  { id: 'duration', header: 'Duration' },
  { accessorKey: 'tenantId', header: 'Tenant' }
]

const statusColor = (status: AgentWorkflowRun['status']) =>
  ({ RUNNING: 'info', SUCCESS: 'success', ERROR: 'error' } as const)[status] ?? 'neutral'

function duration(run: AgentWorkflowRun) {
  if (!run.finishedAt) return '…'
  const s = Math.round((run.finishedAt.getTime() - run.startedAt.getTime()) / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
}

const cost = (run: AgentWorkflowRun) =>
  typeof run.usage.total_cost_usd === 'number' ? `$${run.usage.total_cost_usd.toFixed(4)}` : '—'
</script>

<template>
  <div class="max-w-5xl mx-auto space-y-5 p-6 sm:p-9">
    <PageHeader
      title="Agentic Workflows"
      subtitle="Runs of the Claude Agent SDK engine (agent-app)"
    />

    <UCard>
      <template #header>
        <span class="font-medium">Trigger a workflow</span>
      </template>
      <div class="flex flex-wrap items-start gap-3">
        <USelect
          v-model="selectedKey"
          :items="triggerableKeys"
          class="w-full sm:w-64"
        />
        <UButton
          icon="i-lucide-play"
          :loading="triggering"
          @click="onTrigger"
        >
          Trigger
        </UButton>
      </div>
      <UTextarea
        v-model="inputJson"
        placeholder="Input data (JSON, optional)"
        class="mt-3 w-full font-mono"
        :rows="3"
      />
    </UCard>

    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <span class="font-medium">Recent runs</span>
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
        title="Failed to load runs"
        :description="String(error)"
      />
      <UEmpty
        v-else-if="!fetching && runs.length === 0"
        icon="i-lucide-bot"
        title="No agentic runs yet"
      />
      <div
        v-else
        class="overflow-x-auto"
      >
        <UTable
          :data="runs"
          :columns="columns"
        >
          <template #status-cell="{ row }">
            <UBadge
              :color="statusColor(row.original.status)"
              variant="subtle"
            >
              {{ row.original.status }}
            </UBadge>
          </template>
          <template #model-cell="{ row }">
            {{ row.original.model ?? '—' }}
          </template>
          <template #cost-cell="{ row }">
            {{ cost(row.original) }}
          </template>
          <template #startedAt-cell="{ row }">
            {{ row.original.startedAt.toLocaleString() }}
          </template>
          <template #duration-cell="{ row }">
            {{ duration(row.original) }}
          </template>
          <template #tenantId-cell="{ row }">
            <span class="font-mono text-xs">{{ row.original.tenantId?.slice(0, 8) ?? '—' }}</span>
          </template>
        </UTable>
      </div>
    </UCard>
  </div>
</template>
