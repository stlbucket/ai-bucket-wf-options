// auth-app extends auth-layer directly (not tenant-layer), so it registers the
// shared claims middleware itself. See applyEventClaims.
export default defineEventHandler(async (event) => {
  await applyEventClaims(event)
})
