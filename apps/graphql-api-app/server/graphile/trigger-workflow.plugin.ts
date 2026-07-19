import { makeExtendSchemaPlugin, gql } from 'postgraphile/utils'
import { context, lambda } from 'postgraphile/grafast'
import { requiredEnv } from '../lib/required-env.js'

// The app-originated trigger surface (agentic-workflow-engine/_shared.data.md →
// triggerWorkflow). Replaces the retired queue-workflow mutation. R7-thin transport code:
// claims 401 gate → static allow-map → POST to agent-app with the shared secret → pass the
// { accepted, runId } through. asset-scan is deliberately ABSENT from the map — only the
// upload endpoint fires it.
//
// Allow-map values: null = any authenticated user; a 'p:' key = require that permission
// (exerciser is a diagnostic tool — super-admin only, deliberately tighter than the old gate).
const ALLOW_MAP: Record<string, string | null> = {
  'sync-breweries': null,
  'sync-airports': null,
  exerciser: 'p:app-admin-super'
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
            if (!(workflowKey in ALLOW_MAP)) {
              throw new Error(`unknown workflow: ${workflowKey}`)
            }
            const requiredPermission = ALLOW_MAP[workflowKey]
            if (requiredPermission && !(claims.permissions ?? []).includes(requiredPermission)) {
              throw new Error('30000: NOT AUTHORIZED')
            }

            const response = await fetch(
              `${requiredEnv('AGENT_INTERNAL_URL')}/api/trigger/${workflowKey}`,
              {
                method: 'POST',
                headers: {
                  'content-type': 'application/json',
                  'x-fnb-trigger-secret': requiredEnv('AGENT_TRIGGER_SECRET')
                },
                body: JSON.stringify({
                  ...(inputData ?? {}),
                  tenantId: claims.tenantId,
                  profileId: claims.profileId
                })
              }
            )
            if (!response.ok && response.status !== 202) {
              throw new Error(`workflow trigger failed: ${response.status}`)
            }
            const result = (await response.json()) as { accepted?: boolean; runId?: string }
            return { accepted: result.accepted === true, runId: result.runId ?? null }
          }
        )
      }
    }
  }
}))

export default TriggerWorkflowPlugin
