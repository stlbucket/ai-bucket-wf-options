import { defineNuxtConfig } from 'nuxt/config'
import { createResolver } from '@nuxt/kit'

const { resolve } = createResolver(import.meta.url)

export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxt/fonts'],
  css: [resolve('app/assets/css/main.css')],
  compatibilityDate: '2025-01-15',

  runtimeConfig: {
    // '' sentinels — real values come from NUXT_* runtime env (docker-compose ${VAR:?}).
    // No defaults: host `pnpm build` evaluates this without the dev env.
    authAppInternalUrl: '',
    cookieDomain: '',
    // NUXT_SESSION_SECRET — seals the httpOnly `session` cookie (issue 0010, >= 32 chars).
    // server/utils/session.ts fails closed (500) when unset; every app that parses the
    // session cookie needs it (all tenant-layer descendants + auth-app).
    sessionSecret: '',
  },

  vite: {
    optimizeDeps: {
      include: ['@nuxtjs/color-mode', '@urql/vue', '@vueuse/core'],
    },
  },
})
