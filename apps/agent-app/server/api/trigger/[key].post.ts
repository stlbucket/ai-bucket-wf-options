import { handleTrigger } from '../../lib/trigger-handler'

export default defineEventHandler(async (event) => {
  return handleTrigger(event, getRouterParam(event, 'key')!)
})
