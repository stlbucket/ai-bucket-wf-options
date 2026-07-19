import { handleTrigger } from '../../lib/trigger-handler'

// Static route: the server/api/trigger/exerciser/ directory (resume endpoint) shadows the
// [key] param route for the exact /api/trigger/exerciser path — see lib/trigger-handler.ts.
export default defineEventHandler(async (event) => {
  return handleTrigger(event, 'exerciser')
})
