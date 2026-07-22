import { useTriggerWorkflow } from './useTriggerWorkflow'
import type { NotificationChannel } from '@function-bucket/fnb-types'

// Site-admin send-test dispatch (notifications spec, send-test.data.md). Sends through the existing
// engine-agnostic triggerWorkflow surface (the trigger plugin injects tenantId/profileId + gates
// p:app-admin-super for the 'send-notification' key) — no bespoke route, no new mutation. The
// send-notification workflow is the single outbound chokepoint (R22); the notify.notification row
// + Mailpit are the evidence.
export interface SendTestInput {
  channel: NotificationChannel
  templateKey: string
  to: string
  subject?: string | null
  vars?: Record<string, unknown>
}

export function useSendTest() {
  const { triggerWorkflow, fetching } = useTriggerWorkflow()

  async function send(input: SendTestInput) {
    return triggerWorkflow('send-notification', {
      // the notify_fn writers + the workflow's channel switch use the lowercase enum values
      channel: input.channel.toLowerCase(),
      templateKey: input.templateKey,
      to: input.to,
      subject: input.subject ?? null,
      vars: input.vars ?? {},
    })
  }

  return { send, fetching }
}
