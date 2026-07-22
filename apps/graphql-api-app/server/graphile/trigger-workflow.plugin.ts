import { makeExtendSchemaPlugin, gql } from 'postgraphile/utils'
import { context, lambda } from 'postgraphile/grafast'
import { requiredEnv } from '../lib/required-env.js'

// The app-originated trigger surface (agentic-decommission/_shared.data.md → triggerWorkflow).
// n8n is the sole workflow engine (R22): claims 401 gate → registry check → POST the n8n webhook
// with the shared secret → pass { accepted, runId } through. asset-scan is deliberately ABSENT
// from the registry — only the upload endpoint + reaper fire it.
//
// `permission`: null = any authenticated user; a single 'p:' key = require that key; an array =
// any-of (parity with the DB's `jwt.enforce_any_permission`). game-event uses the array form
// because the game module gates every DB/RLS layer on `{p:app-user, p:app-admin}` — an admin
// without p:app-user can still create and play a game, so must also be able to trigger the referee.
const WORKFLOW_REGISTRY: Record<string, { permission: string | string[] | null }> = {
  'sync-breweries': { permission: null },
  'sync-airports': { permission: null },
  // the sole diagnostic exerciser (rekeyed from n8n-exerciser at the agentic decommission)
  'exerciser': { permission: 'p:app-admin-super' },
  // The game referee (game-server spec): { op: 'setup' | 'event', gameId }. Any app user may
  // trigger — rogue/duplicate calls no-op in the referee, and record_referee_result's
  // advisory lock + still-pending re-checks make concurrent duplicates harmless. Any-of gate
  // mirrors the game module's `jwt.enforce_any_permission('{p:app-user,p:app-admin}')`.
  'game-event': { permission: ['p:app-user', 'p:app-admin'] },
  // The single outbound-notification chokepoint (notifications spec, R22): { channel, templateKey,
  // to, subject?, vars?, tenantId?, profileId? }. v1's only caller is the site-admin send-test
  // page, so it is gated p:app-admin-super; loosen when invitation/other senders land.
  'send-notification': { permission: 'p:app-admin-super' },
  // User invitation (user-invitation spec, R22): { displayName, email }. tenantId/profileId are
  // injected from the inviting admin's claims by the plugin. Gated p:app-admin — tenant admins
  // invite into their own tenant. The workflow creates the resident (app_fn.invite_user as
  // n8n_worker) + the ZITADEL human user + email #1; fire-and-forget (accepted:true, runId:null).
  'invite-user': { permission: 'p:app-admin' }
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
            if (entry.permission) {
              const required = Array.isArray(entry.permission)
                ? entry.permission
                : [entry.permission]
              const held = claims.permissions ?? []
              if (!required.some((p) => held.includes(p))) {
                throw new Error('30000: NOT AUTHORIZED')
              }
            }

            const body = JSON.stringify({
              ...(inputData ?? {}),
              tenantId: claims.tenantId,
              profileId: claims.profileId
            })
            const response = await fetch(
              `${requiredEnv('N8N_INTERNAL_URL')}/webhook/${workflowKey}`,
              {
                method: 'POST',
                headers: {
                  'content-type': 'application/json',
                  'x-fnb-webhook-secret': requiredEnv('N8N_WEBHOOK_SECRET')
                },
                body
              }
            )
            if (!response.ok) {
              throw new Error(`workflow trigger failed: ${response.status}`)
            }
            // respond-immediately webhook: 200 = accepted, no runId in the response
            return { accepted: response.ok, runId: null }
          }
        )
      }
    }
  }
}))

export default TriggerWorkflowPlugin
