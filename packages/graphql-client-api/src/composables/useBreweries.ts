import { computed, onScopeDispose, ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { Brewery, BreweryType as FnbBreweryType } from '@function-bucket/fnb-types'
import { useBrewerySyncStatusQuery, useSearchBreweriesQuery } from '../generated/fnb-graphql-api'
import type { BreweryType } from '../generated/fnb-graphql-api'
import { toBrewery, toBrewerySyncStatus } from '../mappers/brewery'
import { useTriggerWorkflow } from './useTriggerWorkflow'

// composable view type (R4): the reactive search/filter/paging state the page binds to
export interface SearchBreweriesOptions {
  searchText: string | null
  breweryType: FnbBreweryType | null
  state: string | null
  country: string | null
  isGeolocated: boolean | null // true = geocoded only; null = all
  itemLimit: number
  pageOffset: number
}

const SYNC_POLL_MS = 10_000

export function useBreweries() {
  const options: Ref<SearchBreweriesOptions> = ref({
    searchText: null,
    breweryType: null,
    state: null,
    country: null,
    isGeolocated: null,
    itemLimit: 25,
    pageOffset: 0,
  })

  const variables = computed(() => ({
    options: {
      searchText: options.value.searchText || null,
      breweryType: (options.value.breweryType as unknown as BreweryType) ?? null,
      state: options.value.state || null,
      country: options.value.country || null,
      isGeolocated: options.value.isGeolocated,
      pagingOptions: {
        itemOffset: null,
        pageOffset: options.value.pageOffset,
        itemLimit: options.value.itemLimit,
      },
    },
  }))

  const { data, fetching, error, executeQuery } = useSearchBreweriesQuery({ variables })
  const {
    data: statusData,
    error: statusError,
    executeQuery: executeStatusQuery,
  } = useBrewerySyncStatusQuery()
  const { triggerWorkflow } = useTriggerWorkflow()

  const breweries = computed(() =>
    (data.value?.searchBreweriesList ?? [])
      .filter((b): b is NonNullable<typeof b> => b != null)
      .map(toBrewery),
  )

  const syncStatus = computed(() => {
    const s = statusData.value?.brewerySyncStatus
    return s ? toBrewerySyncStatus(s) : null
  })

  function refreshSyncStatus() {
    executeStatusQuery({ requestPolicy: 'network-only' })
  }

  // throws on mutation error (page shows the error toast); on success re-polls status
  async function queueSync() {
    await triggerWorkflow('sync-breweries', {})
    refreshSyncStatus()
  }

  // Poll status while a sync instance runs, then refresh the list once it finishes.
  // Lives here so the page stays transport-free (R1). Client-only — no SSR timers.
  if (typeof window !== 'undefined') {
    let timer: ReturnType<typeof setInterval> | null = null
    watch(
      () => syncStatus.value?.inProgress ?? false,
      (inProgress) => {
        if (inProgress && !timer) {
          timer = setInterval(refreshSyncStatus, SYNC_POLL_MS)
        } else if (!inProgress && timer) {
          clearInterval(timer)
          timer = null
          executeQuery({ requestPolicy: 'network-only' })
          refreshSyncStatus()
        }
      },
      { immediate: true },
    )
    onScopeDispose(() => {
      if (timer) clearInterval(timer)
    })
  }

  return {
    breweries,
    fetching,
    error,
    statusError,
    options,
    syncStatus,
    queueSync,
    refreshSyncStatus,
  }
}
