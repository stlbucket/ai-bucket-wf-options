import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import type { Resource, Urn } from '@function-bucket/fnb-types'
import { useResolveUrnQuery } from '../generated/fnb-graphql-api'
import { toResource } from '../mappers/resource'

// Resolve a URN to its registry row (existence + visibility check, hub entry point).
// RLS applies: a URN the caller cannot see resolves to null, same as a missing one.
export function useResource(urn: MaybeRefOrGetter<Urn | string>) {
  const variables = computed(() => ({ urn: String(toValue(urn)) }))
  const { data, fetching, error, executeQuery } = useResolveUrnQuery({ variables })

  const resource = computed<Resource | null>(() => {
    const r = data.value?.resolveUrn
    return r ? toResource(r) : null
  })

  return { resource, fetching, error, executeQuery }
}
