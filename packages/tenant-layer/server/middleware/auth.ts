import { defineEventHandler } from 'h3'

// Populates event.context.claims and keeps the readable `auth.user` cookie fresh
// on every request, for every app that extends tenant-layer. See applyEventClaims.
export default defineEventHandler(async (event) => {
  await applyEventClaims(event)
})
