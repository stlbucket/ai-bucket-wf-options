// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  extends: ['@function-bucket/fnb-auth-layer'],

  modules: ['@nuxt/eslint'],

  devtools: {
    enabled: true
  },

  runtimeConfig: {
    // '' sentinels — real values come from NUXT_* runtime env (docker-compose ${VAR:?}).
    // Do not put defaults here: host `pnpm build` evaluates this config without the dev env.
    // ZITADEL OIDC (server-only — see server/utils/oidc.ts):
    //   zitadelIssuer       NUXT_ZITADEL_ISSUER        external issuer (browser + iss validation)
    //   zitadelInternalUrl  NUXT_ZITADEL_INTERNAL_URL  container-reachable origin for token/JWKS
    //   zitadelSeedFile     NUXT_ZITADEL_SEED_FILE     { issuer, clientId } handoff volume file
    zitadelIssuer: '',
    zitadelInternalUrl: '',
    zitadelSeedFile: '',
    public: {
      authAppUrl: '',
      graphqlApiUrl: ''
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
