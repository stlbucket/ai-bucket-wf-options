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

  // Provide for component useQuery hooks…
  nuxtApp.vueApp.use(urql, client)
  // …and expose the same client on the Nuxt app so useAuth().refreshClaims() can reach it
  // outside of component setup (plugins, route middleware).
  return { provide: { urqlClient: client } }
})
