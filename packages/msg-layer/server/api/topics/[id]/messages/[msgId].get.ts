import { defineEventHandler, createError, getRouterParam } from 'h3'
import { withClaims, selectMessageWithSenderById } from '@function-bucket/fnb-db-access'

export default defineEventHandler(async (event) => {
  const { claims } = event.context
  if (!claims) throw createError({ statusCode: 401, message: 'Not authenticated' })
  const msgId = getRouterParam(event, 'msgId')!
  return withClaims(claims, (client) => selectMessageWithSenderById(client, msgId))
})
