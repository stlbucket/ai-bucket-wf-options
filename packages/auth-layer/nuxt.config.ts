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
    // Dev-startup performance (issue 0370). Both keys are dev-server-only — `nuxt build`
    // ignores them — and live here in the root layer so all six apps inherit them via
    // Nuxt's defu merge of extended-layer `vite` config.
    optimizeDeps: {
      // Prebundle heavy shared BROWSER deps at boot so Vite does not discover them
      // mid-request and force a full-page reload ("new dependencies optimized: …,
      // reloading"). Only bare specifiers resolvable from an app root belong here —
      // transitive-only deps (@urql/core, graphql under @urql/vue; tailwind-variants,
      // @internationalized/date under @nuxt/ui) warn "Unresolvable" and are already
      // bundled inside their parent's prebundle, so listing @urql/vue + @nuxt/ui
      // covers them. Server-only deps (pg, @aws-sdk, nitropack, h3) are NOT listed —
      // this is the browser graph. (App-specific heavy deps, e.g. tenant-app's
      // mapbox-gl, are pinned in that app's own optimizeDeps.include, not here.)
      include: [
        '@nuxtjs/color-mode',
        '@urql/vue',
        '@vueuse/core',
        '@nuxt/ui',
        'reka-ui',
      ],
    },
    server: {
      // Transform each app's page graph at startup instead of on first click. Glob
      // resolves against the consuming app's rootDir (Nuxt 4 pages at app/pages/), so
      // one entry warms every app's own pages. Merges with each app's `vite.server.hmr`.
      warmup: {
        clientFiles: ['./app/pages/**/*.vue'],
      },
    },
  },
})
