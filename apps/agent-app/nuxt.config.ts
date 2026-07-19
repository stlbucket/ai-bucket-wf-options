// https://nuxt.com/docs/api/configuration/nuxt-config
// Headless agent host — no pages, no nginx entry, no layers (so no auth middleware, no UI).
// Runs the Claude Agent SDK workflow harness: trigger routes (server/api/trigger/) guarded by
// the shared-secret header, the croner scheduler plugin, and the closed per-workflow toolboxes.
// Reachable only compose-internal at http://agent-app:3000 (AGENT_INTERNAL_URL).
export default defineNuxtConfig({
  devtools: {
    enabled: false
  },

  compatibilityDate: '2025-01-15'
})
