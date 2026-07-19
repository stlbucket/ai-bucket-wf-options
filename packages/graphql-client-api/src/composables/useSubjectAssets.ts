import { computed, unref } from 'vue'
import type { MaybeRef } from 'vue'
import type { Asset } from '@function-bucket/fnb-types'
import { useAssetsBySubjectQuery } from '../generated/fnb-graphql-api'
import { toAsset } from '../mappers/asset'

const nonNull = <T>(v: T): v is NonNullable<T> => v != null

// Assets stacked onto one subject (todo / support-ticket detail pages) — RLS-scoped to the
// caller's tenant. urn-registry stacking v2: subject_urn replaced the context/owning_entity_id
// loose-ref pair. The query filters assetStatus: ACTIVE (entity pages never show soft-deleted
// rows; the site-admin useSiteAssets deliberately shows everything) and parentAssetId: null
// (originals only). Pauses until the subject urn is known — detail pages resolve it from their
// entity query. asset-storage: graphql.data.md §4.
export function useSubjectAssets(subjectUrn: MaybeRef<string | null | undefined>) {
  const { data, fetching, error, executeQuery } = useAssetsBySubjectQuery({
    variables: computed(() => ({ subjectUrn: unref(subjectUrn) ?? '' })),
    pause: computed(() => !unref(subjectUrn)),
  })

  const assets = computed<Asset[]>(() => (data.value?.assets ?? []).filter(nonNull).map(toAsset))

  const refresh = () => executeQuery({ requestPolicy: 'network-only' })

  return { assets, fetching, error, refresh }
}
