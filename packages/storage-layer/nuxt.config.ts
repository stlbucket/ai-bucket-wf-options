import { defineNuxtConfig } from 'nuxt/config'

// storage-layer extends tenant-layer → inherits the claims middleware (applyEventClaims),
// nav system, and dashboard layout. No WebSocket (unlike msg-layer); the layer's server/ dir
// hosts the upload endpoint only — the asset-scan pipeline runs in apps/agent-app (the
// agentic workflow engine; triggered post-commit by the upload endpoint).
export default defineNuxtConfig({
  extends: ['@function-bucket/fnb-tenant-layer'],
  runtimeConfig: {
    public: {
      // '' sentinel — real value comes from NUXT_PUBLIC_UPLOAD_URL runtime env
      // (docker-compose ${VAR:?}). No default: host `pnpm build` evaluates this without the dev env.
      uploadUrl: '',
    },
  },
})
