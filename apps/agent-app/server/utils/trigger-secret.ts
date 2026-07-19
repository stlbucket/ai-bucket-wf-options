import { timingSafeEqual } from 'node:crypto'
import { createError, getHeader, type H3Event } from 'h3'
import { requiredEnv } from '../lib/required-env'

// Shared-secret trigger auth (_shared.data.md → Trigger contract): every /api/trigger/* route
// requires X-Fnb-Trigger-Secret to equal $AGENT_TRIGGER_SECRET. 401 otherwise.
export function requireTriggerSecret(event: H3Event): void {
  const provided = getHeader(event, 'x-fnb-trigger-secret') ?? ''
  const expected = requiredEnv('AGENT_TRIGGER_SECRET')
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw createError({ statusCode: 401, message: 'invalid trigger secret' })
  }
}
