import { computed, unref } from 'vue'
import type { MaybeRef } from 'vue'
import type { Asset } from '@function-bucket/fnb-types'
import { useAssetDetailQuery } from '../generated/fnb-graphql-api'
import { toAsset } from '../mappers/asset'

// Composable view type (R4): the asset plus the uploader's display name, folded in from the
// `resident` relation the mapper doesn't see (`tenantName` already lives on Asset).
export interface AssetDetailView extends Asset {
  uploaderName: string | null
}

const nonNull = <T>(v: T): v is NonNullable<T> => v != null

// Single-asset detail — RLS-scoped like the list: own-tenant users see their tenant's asset,
// super-admins see any. `asset` is null when the id is unknown OR RLS hides the row (the page
// renders a not-found state either way). `children` are the derived assets (thumbnails) — the one
// place children surface (every list filters parentAssetId: null). asset-storage: asset-detail.data.md.
export function useAssetDetail(id: MaybeRef<string>) {
  const { data, fetching, error, executeQuery } = useAssetDetailQuery({
    variables: computed(() => ({ id: unref(id) })),
  })
  const asset = computed<AssetDetailView | null>(() => {
    const n = data.value?.asset
    if (!n) return null
    return {
      ...toAsset(n),
      tenantName: n.tenant?.name ?? null,
      uploaderName: n.uploader?.resident?.displayName ?? null,
    }
  })
  const children = computed<Asset[]>(() => (data.value?.children ?? []).filter(nonNull).map(toAsset))
  const refresh = () => executeQuery({ requestPolicy: 'network-only' })
  return { asset, children, fetching, error, refresh }
}
