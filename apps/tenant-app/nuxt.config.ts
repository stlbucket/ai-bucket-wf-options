// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // storage-layer extends tenant-layer itself; listing both keeps tenant-app's direct parent
  // explicit. storage-layer contributes the asset UI (AssetList/AssetUploader, /assets pages),
  // useAssetUpload/useAssetDelete, and the public.uploadUrl runtimeConfig (issue 0330).
  extends: ['@function-bucket/fnb-storage-layer', '@function-bucket/fnb-tenant-layer'],

  modules: ['@nuxt/eslint', 'nuxt-mapbox'],

  devtools: {
    enabled: true
  },

  runtimeConfig: {
    // '' sentinels — real values come from NUXT_* runtime env (docker-compose ${VAR:?}).
    // Do not put defaults here: host `pnpm build` evaluates this config without the dev env.
    msgAppInternalUrl: '',
    public: {
      authAppUrl: '',
      graphqlApiUrl: '',
      msgAppUrl: ''
    }
  },

  routeRules: {
    // /assets pages are inherited from storage-layer; tenant-app's urql plugin is client-only
    // (urql.client.ts), so they must be CSR like every other data page here.
    '/assets/**': { ssr: false },
    '/msg/**': { ssr: false },
    '/admin/**': { ssr: false },
    '/loc/**': { ssr: false },
    '/site-admin/**': { ssr: false },
    '/support/**': { ssr: false },
    '/tools/**': { ssr: false },
    '/datasets/**': { ssr: false }
  },

  compatibilityDate: '2025-01-15',

  vite: {
    server: {
      // Only configure HMR when the browser-facing port is provided (dev via compose); host
      // `pnpm build` has no VITE_HMR_CLIENT_PORT and must not hard-require it.
      ...(process.env.VITE_HMR_CLIENT_PORT
        ? { hmr: { clientPort: parseInt(process.env.VITE_HMR_CLIENT_PORT) } }
        : {})
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  mapbox: {
    // Read at config-eval time (nuxt-mapbox), so it cannot be a NUXT_* runtime override. Real
    // value flows from compose (MAPBOX_ACCESS_TOKEN) at dev start; '' at host `pnpm build` is fine.
    accessToken: process.env.MAPBOX_ACCESS_TOKEN ?? ''
  }
})
