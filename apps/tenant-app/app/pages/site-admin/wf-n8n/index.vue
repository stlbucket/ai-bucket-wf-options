<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { N8nWorkflowRun } from '@function-bucket/fnb-types'
import { useN8nWorkflowRuns } from '~/composables/useN8nWorkflowRuns'
import { useTriggerWorkflow } from '~/composables/useTriggerWorkflow'

const toast = useToast()

const { runs, fetching, error, refresh } = useN8nWorkflowRuns()
const { triggerWorkflow, fetching: triggering } = useTriggerWorkflow()
const editorUrl = useRuntimeConfig().public.n8nEditorUrl

// Mirrors the triggerable entries of the trigger plugin's WORKFLOW_REGISTRY (n8n is the sole
// engine — agentic-decommission spec). asset-scan is absent (upload-endpoint + reaper only).
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
    // respond-immediately webhook: accepted, no runId in the response by contract
    if (result.accepted) {
      toast.add({ title: 'Accepted — workflow started', color: 'success' })
    } else {
      toast.add({ title: 'Trigger was not accepted', color: 'warning' })
    }
    refresh()
  } catch {
    toast.add({ title: 'Workflow trigger failed', color: 'error' })
  }
}

const columns: TableColumn<N8nWorkflowRun>[] = [
  { accessorKey: 'workflowKey', header: 'Workflow' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'n8nExecutionId', header: 'Execution' },
  { accessorKey: 'startedAt', header: 'Started' },
  { id: 'duration', header: 'Duration' },
  { accessorKey: 'tenantId', header: 'Tenant' }
]

const statusColor = (status: N8nWorkflowRun['status']) =>
  ({ RUNNING: 'info', SUCCESS: 'success', ERROR: 'error' } as const)[status] ?? 'neutral'

function duration(run: N8nWorkflowRun) {
  if (!run.finishedAt) return '…'
  const s = Math.round((run.finishedAt.getTime() - run.startedAt.getTime()) / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
}
</script>

<template>
  <div class="max-w-5xl mx-auto space-y-5 p-6 sm:p-9">
    <PageHeader
      title="n8n Workflows"
      subtitle="Runs of the parallel n8n engine"
    />

    <UCard>
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <span class="font-medium">Trigger a workflow</span>
          <UButton
            v-if="editorUrl"
            icon="i-lucide-external-link"
            variant="outline"
            :to="editorUrl"
            target="_blank"
          >
            Open n8n editor
          </UButton>
        </div>
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
        icon="i-lucide-workflow"
        title="No n8n runs yet"
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
          <template #n8nExecutionId-cell="{ row }">
            <span class="font-mono text-xs">{{ row.original.n8nExecutionId ?? '—' }}</span>
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
