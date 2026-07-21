import { defineNuxtConfig } from 'nuxt/config'
import { createResolver } from '@nuxt/kit'

const { resolve } = createResolver(import.meta.url)

export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxt/fonts'],
  css: [resolve('app/assets/css/main.css')],
  compatibilityDate: '2025-01-15',

  // function-bucket brand favicons (plan 0500). Assets live in this root layer's public/
  // dir, so every app that extends the chain inherits them. Root-absolute hrefs are
  // rewritten by each app's NUXT_APP_BASE_URL (e.g. /tenant/favicon-32.png).
  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon-180.png' },
      ],
    },
  },

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
