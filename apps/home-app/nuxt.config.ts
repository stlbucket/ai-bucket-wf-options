// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  extends: ['@function-bucket/fnb-tenant-layer'],

  modules: ['@nuxt/eslint'],

  devtools: {
    enabled: true
  },

  runtimeConfig: {
    // '' sentinels — real values come from NUXT_PUBLIC_* runtime env (docker-compose ${VAR:?}).
    // Do not put defaults here: host `pnpm build` evaluates this config without the dev env.
    public: {
      authAppUrl: '',
      graphqlApiUrl: ''
      // sentryDsn is inherited from auth-layer's runtimeConfig.public.
    }
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
  }
})
