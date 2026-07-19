import { defineEventHandler } from 'h3'

// Populates event.context.claims from the sealed `session` cookie on every request,
// for every app that extends tenant-layer. See applyEventClaims.
export default defineEventHandler(async (event) => {
  await applyEventClaims(event)
})
