import { makeExtendSchemaPlugin, gql } from 'postgraphile/utils'
import { context, lambda } from 'postgraphile/grafast'
import { requiredEnv } from '../lib/required-env.js'

// The app-originated trigger surface (agentic-workflow-engine/_shared.data.md →
// triggerWorkflow; engine routing per n8n-parallel-engine/_shared.data.md). Replaces the
// retired queue-workflow mutation. R7-thin transport code: claims 401 gate → registry check →
// POST to the workflow's engine with that engine's shared secret → pass { accepted, runId }
// through. asset-scan is deliberately ABSENT from the registry — only the upload endpoint
// fires it.
//
// Registry: engine 'agent' POSTs the agent-app trigger route (202 { accepted, runId });
// engine 'n8n' POSTs the n8n webhook (respond-immediately 200, no runId → runId stays null).
// permission null = any authenticated user; a 'p:' key = require that permission (the
// exercisers are diagnostic tools — super-admin only). Moving a workflow between engines is
// a one-line edit here (plus whatever DB grants the workflow needs on the target side).
type WorkflowEngine = 'agent' | 'n8n'
const WORKFLOW_REGISTRY: Record<string, { engine: WorkflowEngine, permission: string | null }> = {
  'sync-breweries': { engine: 'agent', permission: null },
  // moved to n8n 2026-07-20 (dataset-sync.workflow.data.md §Engine move); the agentic
  // definition stays in the tree dormant as the rollback
  'sync-airports': { engine: 'n8n', permission: null },
  'exerciser': { engine: 'agent', permission: 'p:app-admin-super' },
  'n8n-exerciser': { engine: 'n8n', permission: 'p:app-admin-super' },
  // Parallel n8n twin of the agentic breweries sync — operator-triggered (the datasets UI
  // keeps the agentic key above); n8n-parallel-engine/dataset-sync.workflow.data.md.
  'n8n-sync-breweries': { engine: 'n8n', permission: 'p:app-admin-super' }
}

interface TriggerClaims {
  profileId: string | null
  tenantId: string | null
  permissions: string[] | null
}

export const TriggerWorkflowPlugin = makeExtendSchemaPlugin(() => ({
  typeDefs: gql`
    type TriggerWorkflowResult {
      accepted: Boolean!
      runId: UUID
    }
    extend type Mutation {
      triggerWorkflow(workflowKey: String!, inputData: JSON): TriggerWorkflowResult
    }
  `,
  plans: {
    Mutation: {
      triggerWorkflow(_$root: unknown, fieldArgs: { getRaw: (path: string[]) => unknown }) {
        const $claims = context().get('claims')
        const $key = fieldArgs.getRaw(['workflowKey'])
        const $input = fieldArgs.getRaw(['inputData'])
        return lambda(
          [$claims, $key, $input],
          async ([claims, workflowKey, inputData]: [
            TriggerClaims | undefined,
            string,
            Record<string, unknown> | null | undefined
          ]) => {
            if (!claims) {
              throw new Error('401: not authenticated') // parity with the retired wf queue gate
            }
            const entry = WORKFLOW_REGISTRY[workflowKey]
            if (!entry) {
              throw new Error(`unknown workflow: ${workflowKey}`)
            }
            if (entry.permission && !(claims.permissions ?? []).includes(entry.permission)) {
              throw new Error('30000: NOT AUTHORIZED')
            }

            const body = JSON.stringify({
              ...(inputData ?? {}),
              tenantId: claims.tenantId,
              profileId: claims.profileId
            })
            const response
              = entry.engine === 'n8n'
                ? await fetch(`${requiredEnv('N8N_INTERNAL_URL')}/webhook/${workflowKey}`, {
                    method: 'POST',
                    headers: {
                      'content-type': 'application/json',
                      'x-fnb-webhook-secret': requiredEnv('N8N_WEBHOOK_SECRET')
                    },
                    body
                  })
                : await fetch(`${requiredEnv('AGENT_INTERNAL_URL')}/api/trigger/${workflowKey}`, {
                    method: 'POST',
                    headers: {
                      'content-type': 'application/json',
                      'x-fnb-trigger-secret': requiredEnv('AGENT_TRIGGER_SECRET')
                    },
                    body
                  })
            if (!response.ok && response.status !== 202) {
              throw new Error(`workflow trigger failed: ${response.status}`)
            }
            if (entry.engine === 'n8n') {
              // respond-immediately webhook: 200 = accepted, no runId in the response
              return { accepted: response.ok, runId: null }
            }
            const result = (await response.json()) as { accepted?: boolean, runId?: string }
            return { accepted: result.accepted === true, runId: result.runId ?? null }
          }
        )
      }
    }
  }
}))

export default TriggerWorkflowPlugin
