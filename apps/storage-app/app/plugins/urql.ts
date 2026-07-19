import urql, { Client, cacheExchange, fetchExchange, mapExchange } from '@urql/vue'

export default defineNuxtPlugin((nuxtApp) => {
  const { public: pub } = useRuntimeConfig()

  const client = new Client({
    url: pub.graphqlApiUrl,
    preferGetMethod: false,
    exchanges: [
      cacheExchange,
      mapExchange({
        onError(error) {
          console.error('[urql]', error)
        },
      }),
      fetchExchange,
    ],
  })

  nuxtApp.vueApp.use(urql, client)
  // Expose the client on the Nuxt app so useAuth().refreshClaims() can reach it outside setup.
  return { provide: { urqlClient: client } }
})
