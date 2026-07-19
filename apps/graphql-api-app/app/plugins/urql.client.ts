import urql, { cacheExchange, fetchExchange, mapExchange } from '@urql/vue'

export default defineNuxtPlugin((nuxtApp) => {
  const { public: pub } = useRuntimeConfig()

  nuxtApp.vueApp.use(urql, {
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
})
