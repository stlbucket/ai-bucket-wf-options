import { computed, unref } from 'vue'
import type { MaybeRef } from 'vue'
import { useBreweryQuery } from '../generated/fnb-graphql-api'
import { toBrewery } from '../mappers/brewery'

export function useBrewery(id: MaybeRef<string>) {
  const variables = computed(() => ({ id: unref(id) }))
  const { data, fetching, error } = useBreweryQuery({ variables })

  const brewery = computed(() => {
    const b = data.value?.brewery
    return b ? toBrewery(b) : null
  })

  return { brewery, fetching, error }
}
