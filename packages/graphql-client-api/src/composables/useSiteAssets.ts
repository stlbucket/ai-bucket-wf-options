import { computed } from 'vue'
import { useAllAssetsQuery } from '../generated/fnb-graphql-api'
import { toAsset } from '../mappers/asset'

// Site-admin asset list — RLS-scoped: super-admins get every tenant's rows
// (manage_all_super_admin), everyone else their own tenant's (manage_all_for_tenant).
// The same composable serves both audiences (asset-storage: assets-page.data.md).
export function useSiteAssets() {
  const { data, fetching, error, executeQuery } = useAllAssetsQuery()

  function refresh() {
    executeQuery({ requestPolicy: 'network-only' })
  }

  const assets = computed(() =>
    (data.value?.assets ?? [])
      .filter((a): a is NonNullable<typeof a> => a != null)
      .map((a) => ({ ...toAsset(a), tenantName: a.tenant?.name ?? null })),
  )

  return { assets, fetching, error, refresh }
}
